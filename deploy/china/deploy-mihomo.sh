#!/usr/bin/env bash
#
# deploy-mihomo.sh
#
# 在 newapi-net 上启动独立 mihomo 容器，供 cursor-api-proxy 专用出网代理。
# mode=global 仅作用于「连到本容器 7890」的客户端；不要给其他服务配 HTTP_PROXY。
#
# 用法（服务器 root）：
#   sudo CLASH_SUBSCRIPTION_URL='https://...' bash deploy-mihomo.sh start
#   sudo bash deploy-mihomo.sh stop | restart | status | logs | update
#
# 数据目录：/data/mihomo
# 端口：仅 newapi-net 内 7890（mixed），不映射公网。

set -euo pipefail

MIHOMO_IMAGE="${MIHOMO_IMAGE:-metacubex/mihomo:latest}"
MIHOMO_CONTAINER="${MIHOMO_CONTAINER:-mihomo}"
MIHOMO_BASE_DIR="${MIHOMO_BASE_DIR:-/data/mihomo}"
SHARED_NETWORK="${SHARED_NETWORK:-newapi-net}"
CLASH_SUBSCRIPTION_URL="${CLASH_SUBSCRIPTION_URL:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/mihomo/config.yaml.template"

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

ensure_network() {
  if docker network ls --format '{{.Name}}' | grep -qx "${SHARED_NETWORK}"; then
    log "共享网络 ${SHARED_NETWORK} 已存在。"
  else
    log "创建共享网络 ${SHARED_NETWORK}..."
    docker network create "${SHARED_NETWORK}" >/dev/null
    ok "网络 ${SHARED_NETWORK} 已创建。"
  fi
}

write_config() {
  if [[ -z "${CLASH_SUBSCRIPTION_URL}" ]]; then
    if [[ -f "${MIHOMO_BASE_DIR}/.subscription_url" ]]; then
      CLASH_SUBSCRIPTION_URL="$(tr -d ' \n\r' < "${MIHOMO_BASE_DIR}/.subscription_url")"
    fi
  fi
  if [[ -z "${CLASH_SUBSCRIPTION_URL}" ]]; then
    err "请设置 CLASH_SUBSCRIPTION_URL（Clash 订阅完整 URL）。"
    exit 1
  fi

  mkdir -p "${MIHOMO_BASE_DIR}/providers"
  if [[ ! -f "${TEMPLATE}" ]]; then
    err "缺少模板：${TEMPLATE}"
    exit 1
  fi

  # 用 python 做安全替换，避免 sed 与 URL 特殊字符冲突
  CLASH_SUBSCRIPTION_URL="${CLASH_SUBSCRIPTION_URL}" python3 - "${TEMPLATE}" "${MIHOMO_BASE_DIR}/config.yaml" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]
url = os.environ["CLASH_SUBSCRIPTION_URL"]
text = open(src, encoding="utf-8").read().replace("__CLASH_SUBSCRIPTION_URL__", url)
open(dst, "w", encoding="utf-8").write(text)
PY

  printf '%s\n' "${CLASH_SUBSCRIPTION_URL}" > "${MIHOMO_BASE_DIR}/.subscription_url"
  chmod 600 "${MIHOMO_BASE_DIR}/.subscription_url" "${MIHOMO_BASE_DIR}/config.yaml"
  ok "已写入 ${MIHOMO_BASE_DIR}/config.yaml（mode: global）"
}

container_exists()  { docker ps -a --format '{{.Names}}' | grep -qx "${MIHOMO_CONTAINER}"; }
container_running() { docker ps --format '{{.Names}}'    | grep -qx "${MIHOMO_CONTAINER}"; }

create_container() {
  log "拉取镜像 ${MIHOMO_IMAGE}..."
  docker pull "${MIHOMO_IMAGE}"

  # 仅本机 7890：方便 docker build --network=host 走代理；不对公网开放
  log "启动 ${MIHOMO_CONTAINER}（仅 127.0.0.1:7890 + ${SHARED_NETWORK}）..."
  docker run -d \
    --name "${MIHOMO_CONTAINER}" \
    --restart always \
    --network "${SHARED_NETWORK}" \
    -p 127.0.0.1:7890:7890 \
    -v "${MIHOMO_BASE_DIR}:/root/.config/mihomo" \
    "${MIHOMO_IMAGE}" \
    -d /root/.config/mihomo -f /root/.config/mihomo/config.yaml
}

wait_ready() {
  log "等待 mihomo 就绪..."
  local i=0
  while (( i < 20 )); do
    if container_running; then
      # 7890 = 0x1ED2（/proc/net/tcp 端口字段）
      if docker exec "${MIHOMO_CONTAINER}" \
          sh -c 'grep -q ":1ED2 " /proc/net/tcp /proc/net/tcp6 2>/dev/null'; then
        ok "mihomo mixed-port 7890 已监听。"
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 1
  done
  if container_running; then
    ok "mihomo 容器已运行（请用 logs 确认订阅是否拉取成功）。"
    return 0
  fi
  warn "mihomo 未就绪，请查看：sudo bash $0 logs"
  return 1
}

cmd_start() {
  ensure_network
  write_config

  if container_running; then
    ok "mihomo 已在运行中。"
    return 0
  fi
  if container_exists; then
    log "容器已存在但停止，直接启动..."
    docker start "${MIHOMO_CONTAINER}" >/dev/null
  else
    create_container >/dev/null
  fi
  wait_ready || true
  ok "仅 cursor-api-proxy 应设置 HTTP_PROXY=http://${MIHOMO_CONTAINER}:7890"
}

cmd_stop() {
  if ! container_exists; then
    warn "mihomo 容器不存在。"
    return 0
  fi
  if container_running; then
    docker stop "${MIHOMO_CONTAINER}" >/dev/null
    ok "已停止。"
  else
    warn "已处于停止状态。"
  fi
}

cmd_restart() {
  cmd_stop
  # 重启时重写配置（便于更换订阅）
  ensure_network
  write_config
  if container_exists; then
    docker start "${MIHOMO_CONTAINER}" >/dev/null
  else
    create_container >/dev/null
  fi
  wait_ready || true
}

cmd_status() {
  if ! container_exists; then
    warn "mihomo 容器不存在。"
    return 0
  fi
  docker ps -a --filter "name=^${MIHOMO_CONTAINER}$" \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

cmd_logs() {
  if ! container_exists; then
    err "mihomo 容器不存在。"
    exit 1
  fi
  docker logs -f --tail 200 "${MIHOMO_CONTAINER}"
}

cmd_update() {
  log "更新：重写配置 + 拉镜像 + 重建容器..."
  ensure_network
  write_config
  if container_exists; then
    docker rm -f "${MIHOMO_CONTAINER}" >/dev/null
  fi
  create_container >/dev/null
  wait_ready || true
  ok "mihomo 已更新。"
}

usage() {
  cat <<EOF
用法: sudo CLASH_SUBSCRIPTION_URL=<订阅URL> bash $0 <command>

命令:
  start     部署或启动 mihomo（global 模式）
  stop      停止
  restart   重启（重写配置）
  status    状态
  logs      日志
  update    拉最新镜像并重建

环境变量:
  CLASH_SUBSCRIPTION_URL  Clash 订阅 URL（首次必填；之后可读 /data/mihomo/.subscription_url）
  MIHOMO_IMAGE            默认 metacubex/mihomo:latest
  MIHOMO_CONTAINER        默认 mihomo
  MIHOMO_BASE_DIR         默认 /data/mihomo
  SHARED_NETWORK          默认 newapi-net
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
