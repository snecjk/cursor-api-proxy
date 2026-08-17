#!/usr/bin/env bash
#
# deploy-cursor-proxy.sh
#
# 在 newapi-net 部署 cursor-api-proxy：仅本容器经 mihomo 全局代理出网，
# 公网通过 Caddy 域名 https://cursor.litemall.asia 访问仪表盘与 API。
#
# 前置：
#   1) newapi-net 已存在（deploy-newapi / install 脚本）
#   2) sudo bash deploy-mihomo.sh start
#   3) 域名 cursor.litemall.asia 已解析；deploy-domain 已加入该站点后 restart caddy
#
# 用法（服务器 root）：
#   sudo CURSOR_API_KEY=... CURSOR_BRIDGE_API_KEY=... bash deploy-cursor-proxy.sh start
#   sudo bash deploy-cursor-proxy.sh stop | restart | status | logs | update
#
# 鉴权：只用 CURSOR_BRIDGE_API_KEY 保护 /v1 API（仪表盘静态页按上游项目设计不校验 Key）。

set -euo pipefail

PROXY_IMAGE="${PROXY_IMAGE:-cursor-api-proxy:latest}"
PROXY_CONTAINER="${PROXY_CONTAINER:-cursor-api-proxy}"
MIHOMO_CONTAINER="${MIHOMO_CONTAINER:-mihomo}"
SHARED_NETWORK="${SHARED_NETWORK:-newapi-net}"
CADDY_CONTAINER="${CADDY_CONTAINER:-caddy}"

REPO_URL="${REPO_URL:-https://github.com/snecjk/cursor-api-proxy.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
SOURCE_DIR="${SOURCE_DIR:-/data/cursor-api-proxy/src}"
SOURCE_MODE="${SOURCE_MODE:-git}"   # git | local

PROXY_DATA_DIR="${PROXY_DATA_DIR:-/data/cursor-api-proxy/data}"
PROXY_LOG_DIR="${PROXY_LOG_DIR:-/data/cursor-api-proxy/logs}"
ENV_FILE="${ENV_FILE:-/data/cursor-api-proxy/.env}"

CURSOR_DOMAIN="${CURSOR_DOMAIN:-cursor.litemall.asia}"
TZ="${TZ:-Asia/Shanghai}"

# 必填（也可写在 ENV_FILE）
CURSOR_API_KEY="${CURSOR_API_KEY:-}"
CURSOR_BRIDGE_API_KEY="${CURSOR_BRIDGE_API_KEY:-}"

CURSOR_BRIDGE_DEFAULT_MODEL="${CURSOR_BRIDGE_DEFAULT_MODEL:-auto}"
CURSOR_BRIDGE_TIMEOUT_MS="${CURSOR_BRIDGE_TIMEOUT_MS:-300000}"
CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE="${CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE:-false}"
CURSOR_BRIDGE_VERBOSE="${CURSOR_BRIDGE_VERBOSE:-false}"

HTTP_PROXY_URL="${HTTP_PROXY_URL:-http://${MIHOMO_CONTAINER}:7890}"
NO_PROXY_LIST="${NO_PROXY_LIST:-localhost,127.0.0.1,${MIHOMO_CONTAINER},new-api,mysql8,redis6,caddy,${PROXY_CONTAINER}}"

# 留空=不映射宿主机端口（推荐，只走 Caddy）；设 127.0.0.1 便于本机 curl 调试
DEBUG_BIND="${DEBUG_BIND:-}"

HEALTH_WAIT_ROUNDS="${HEALTH_WAIT_ROUNDS:-30}"
HEALTH_WAIT_INTERVAL="${HEALTH_WAIT_INTERVAL:-2}"

log()  { echo -e "\033[34m[$(date '+%H:%M:%S')]\033[0m $*"; }
ok()   { echo -e "\033[32m[OK]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  err "请以 root 身份运行：sudo bash $0 <command>"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  err "未检测到 docker。"
  exit 1
fi

load_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    log "加载 ${ENV_FILE}"
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    CURSOR_API_KEY="${CURSOR_API_KEY:-}"
    CURSOR_BRIDGE_API_KEY="${CURSOR_BRIDGE_API_KEY:-}"
  fi
}

require_keys() {
  if [[ -z "${CURSOR_API_KEY}" ]]; then
    err "缺少 CURSOR_API_KEY（Cursor Dashboard → Integrations）。可写入 ${ENV_FILE}"
    exit 1
  fi
  if [[ -z "${CURSOR_BRIDGE_API_KEY}" ]]; then
    err "缺少 CURSOR_BRIDGE_API_KEY（外网访问 /v1 与 new-api 渠道必填）。可写入 ${ENV_FILE}"
    exit 1
  fi
}

ensure_network() {
  if ! docker network ls --format '{{.Name}}' | grep -qx "${SHARED_NETWORK}"; then
    err "docker 网络 ${SHARED_NETWORK} 不存在，请先部署 new-api 栈。"
    exit 1
  fi
}

ensure_mihomo() {
  if ! docker ps --format '{{.Names}}' | grep -qx "${MIHOMO_CONTAINER}"; then
    err "容器 ${MIHOMO_CONTAINER} 未运行。请先：sudo bash deploy-mihomo.sh start"
    exit 1
  fi
}

ensure_dirs() {
  mkdir -p "${PROXY_DATA_DIR}" "${PROXY_LOG_DIR}" "$(dirname "${ENV_FILE}")"
}

write_env_hint() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    cat > "${ENV_FILE}" <<EOF
# cursor-api-proxy 生产环境（权限建议 chmod 600）
CURSOR_API_KEY=
CURSOR_BRIDGE_API_KEY=
CURSOR_BRIDGE_DEFAULT_MODEL=auto
CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=false
EOF
    chmod 600 "${ENV_FILE}"
    warn "已生成空模板 ${ENV_FILE}，请填入密钥后重跑 start。"
  fi
}

ensure_source() {
  if [[ "${SOURCE_MODE}" == "local" ]]; then
    if [[ -f "${SOURCE_DIR}/Dockerfile" ]]; then
      log "SOURCE_MODE=local：使用 ${SOURCE_DIR}"
      return 0
    fi
    err "SOURCE_MODE=local 但 ${SOURCE_DIR} 无 Dockerfile。"
    exit 1
  fi

  if ! command -v git >/dev/null 2>&1; then
    err "需要 git：sudo apt-get install -y git"
    exit 1
  fi

  if [[ -d "${SOURCE_DIR}/.git" ]]; then
    log "拉取最新代码 ${REPO_URL}（${REPO_BRANCH}）..."
    git -C "${SOURCE_DIR}" fetch --quiet origin "+${REPO_BRANCH}:refs/remotes/origin/${REPO_BRANCH}" || true
    git -C "${SOURCE_DIR}" reset --hard --quiet "origin/${REPO_BRANCH}" 2>/dev/null \
      || git -C "${SOURCE_DIR}" pull --ff-only --quiet origin "${REPO_BRANCH}"
    ok "源码：$(git -C "${SOURCE_DIR}" log -1 --format='%h %s' 2>/dev/null || echo ok)"
  else
    [[ -d "${SOURCE_DIR}" ]] && rm -rf "${SOURCE_DIR}"
    mkdir -p "$(dirname "${SOURCE_DIR}")"
    log "浅克隆 ${REPO_URL} → ${SOURCE_DIR}"
    # 构建阶段访问 GitHub/cursor.com 可能需经 mihomo；clone 先直连，失败可改 SOURCE_MODE=local
    if ! git clone --branch "${REPO_BRANCH}" --single-branch --depth 1 --quiet "${REPO_URL}" "${SOURCE_DIR}"; then
      err "git clone 失败。可将本机源码 scp 到 ${SOURCE_DIR} 后设 SOURCE_MODE=local。"
      exit 1
    fi
    ok "源码已克隆。"
  fi
}

build_image() {
  log "构建镜像 ${PROXY_IMAGE}（Dockerfile 会安装 Cursor CLI，需能访问 cursor.com）..."
  # 构建期走 mihomo，避免大陆直连失败
  docker build \
    --build-arg "HTTP_PROXY=${HTTP_PROXY_URL}" \
    --build-arg "HTTPS_PROXY=${HTTP_PROXY_URL}" \
    --build-arg "http_proxy=${HTTP_PROXY_URL}" \
    --build-arg "https_proxy=${HTTP_PROXY_URL}" \
    --build-arg "NO_PROXY=${NO_PROXY_LIST}" \
    --build-arg "no_proxy=${NO_PROXY_LIST}" \
    --network "${SHARED_NETWORK}" \
    -t "${PROXY_IMAGE}" \
    "${SOURCE_DIR}"
  ok "镜像构建完成。"
}

container_exists()  { docker ps -a --format '{{.Names}}' | grep -qx "${PROXY_CONTAINER}"; }
container_running() { docker ps --format '{{.Names}}'    | grep -qx "${PROXY_CONTAINER}"; }

create_container() {
  local extra=""
  if [[ -n "${DEBUG_BIND}" ]]; then
    extra+=" -p ${DEBUG_BIND}:8765:8765"
  fi

  log "启动 ${PROXY_CONTAINER}（出网代理 ${HTTP_PROXY_URL}）..."
  # shellcheck disable=SC2086
  docker run -d \
    --name "${PROXY_CONTAINER}" \
    --restart always \
    --init \
    --network "${SHARED_NETWORK}" \
    ${extra} \
    -e "TZ=${TZ}" \
    -e "CURSOR_API_KEY=${CURSOR_API_KEY}" \
    -e "CURSOR_BRIDGE_HOST=0.0.0.0" \
    -e "CURSOR_BRIDGE_PORT=8765" \
    -e "CURSOR_BRIDGE_API_KEY=${CURSOR_BRIDGE_API_KEY}" \
    -e "CURSOR_BRIDGE_DEFAULT_MODEL=${CURSOR_BRIDGE_DEFAULT_MODEL}" \
    -e "CURSOR_BRIDGE_TIMEOUT_MS=${CURSOR_BRIDGE_TIMEOUT_MS}" \
    -e "CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=${CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE}" \
    -e "CURSOR_BRIDGE_VERBOSE=${CURSOR_BRIDGE_VERBOSE}" \
    -e "CURSOR_BRIDGE_SESSIONS_LOG=/data/sessions.log" \
    -e "HTTP_PROXY=${HTTP_PROXY_URL}" \
    -e "HTTPS_PROXY=${HTTP_PROXY_URL}" \
    -e "http_proxy=${HTTP_PROXY_URL}" \
    -e "https_proxy=${HTTP_PROXY_URL}" \
    -e "ALL_PROXY=${HTTP_PROXY_URL}" \
    -e "all_proxy=${HTTP_PROXY_URL}" \
    -e "NO_PROXY=${NO_PROXY_LIST}" \
    -e "no_proxy=${NO_PROXY_LIST}" \
    -v "${PROXY_DATA_DIR}:/data" \
    -v "${PROXY_LOG_DIR}:/var/log/cursor-api-proxy" \
    "${PROXY_IMAGE}"
}

restart_caddy_if_present() {
  if docker ps --format '{{.Names}}' | grep -qx "${CADDY_CONTAINER}"; then
    log "重启 ${CADDY_CONTAINER} 以刷新上游 IP..."
    docker restart "${CADDY_CONTAINER}" >/dev/null
    ok "caddy 已重启。"
  else
    warn "未检测到 caddy；域名入口请先更新 deploy-domain 并 start/restart。"
  fi
}

wait_healthy() {
  log "等待 healthz（最多 $((HEALTH_WAIT_ROUNDS * HEALTH_WAIT_INTERVAL)) 秒）..."
  local i=0
  until docker exec "${PROXY_CONTAINER}" curl -fsS http://127.0.0.1:8765/healthz >/dev/null 2>&1; do
    i=$((i + 1))
    if (( i >= HEALTH_WAIT_ROUNDS )); then
      warn "未就绪，查看：docker logs ${PROXY_CONTAINER}"
      return 1
    fi
    sleep "${HEALTH_WAIT_INTERVAL}"
  done
  ok "healthz 正常。"
}

cmd_start() {
  load_env_file
  write_env_hint
  require_keys
  ensure_network
  ensure_mihomo
  ensure_dirs

  if container_running; then
    ok "cursor-api-proxy 已在运行。"
    return 0
  fi

  if container_exists; then
    log "容器已存在但停止，直接启动..."
    docker start "${PROXY_CONTAINER}" >/dev/null
  else
    ensure_source
    build_image
    create_container >/dev/null
  fi

  wait_healthy || return 1
  restart_caddy_if_present
  ok "仪表盘：https://${CURSOR_DOMAIN}/"
  ok "API：https://${CURSOR_DOMAIN}/v1 （Authorization: Bearer \$CURSOR_BRIDGE_API_KEY）"
  ok "new-api 上游建议：http://${PROXY_CONTAINER}:8765/v1"
}

cmd_stop() {
  if ! container_exists; then
    warn "容器不存在。"
    return 0
  fi
  if container_running; then
    docker stop "${PROXY_CONTAINER}" >/dev/null
    ok "已停止。"
  else
    warn "已停止。"
  fi
}

cmd_restart() {
  load_env_file
  require_keys
  ensure_network
  ensure_mihomo
  if container_exists; then
    docker rm -f "${PROXY_CONTAINER}" >/dev/null
  fi
  create_container >/dev/null
  wait_healthy || return 1
  restart_caddy_if_present
}

cmd_status() {
  if ! container_exists; then
    warn "容器不存在。"
    return 0
  fi
  docker ps -a --filter "name=^${PROXY_CONTAINER}$" \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  if container_running; then
    if docker exec "${PROXY_CONTAINER}" curl -fsS http://127.0.0.1:8765/healthz >/dev/null 2>&1; then
      ok "healthz ok"
    else
      warn "healthz 失败"
    fi
  fi
}

cmd_logs() {
  if ! container_exists; then
    err "容器不存在。"
    exit 1
  fi
  docker logs -f --tail 200 "${PROXY_CONTAINER}"
}

cmd_update() {
  load_env_file
  require_keys
  ensure_network
  ensure_mihomo
  ensure_dirs
  ensure_source
  build_image
  if container_exists; then
    docker rm -f "${PROXY_CONTAINER}" >/dev/null
  fi
  create_container >/dev/null
  wait_healthy || return 1
  restart_caddy_if_present
  ok "已更新。"
}

usage() {
  cat <<EOF
用法: sudo bash $0 <command>

命令:
  start     构建并启动（需 mihomo 已运行）
  stop      停止
  restart   用当前密钥重建容器
  status    状态
  logs      日志
  update    拉代码 + 重建镜像 + 重建容器

密钥（环境变量或 ${ENV_FILE}）:
  CURSOR_API_KEY           Cursor 官方 Integrations Key
  CURSOR_BRIDGE_API_KEY    本代理对外门禁（必填）

常用环境变量:
  CURSOR_DOMAIN            默认 cursor.litemall.asia
  DEBUG_BIND               如 127.0.0.1 则映射本机 8765
  SOURCE_MODE              git（默认）| local
  REPO_URL / SOURCE_DIR    源码来源
EOF
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  update)  cmd_update ;;
  ""|-h|--help) usage ;;
  *) err "未知命令: $1"; usage; exit 1 ;;
esac
