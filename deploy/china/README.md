# deploy/china — 大陆服务器：cursor-api-proxy + 专用 Mihomo

在已有 `newapi-net` / Caddy 栈上，增加 **仅本服务走全局代理** 的 Cursor OpenAI 兼容网关，并用域名打开仪表盘。

## 已定参数

| 项 | 值 |
|----|-----|
| 仪表盘域名 | `https://cursor.litemall.asia` |
| API 门禁 | 仅 `CURSOR_BRIDGE_API_KEY`（保护 `/v1`） |
| 出网 | 独立容器 `mihomo`，`mode: global` |
| 影响范围 | **只有** `cursor-api-proxy` 设置 `HTTP_PROXY`；new-api 等不受影响 |

> 说明：上游项目对仪表盘静态页与 `/api/status` 等管理接口**不校验** Bridge Key（设计如此）；Chat 等 `/v1` 必须带 Key。请保管好域名与密钥。

## 拓扑

```
浏览器 ──https://cursor.litemall.asia──▶ caddy
                                          │
                                          ▼
                                   cursor-api-proxy:8765
                                          │ HTTP_PROXY
                                          ▼
                                       mihomo:7890 (global)
                                          │
                                          ▼ 订阅节点
                                       Cursor 上游

new-api / mysql8 / redis6 ── 不经过 mihomo
```

## 部署顺序

在服务器上先确保 `newapi-net`、`caddy` 已按 `new-api/deploy/china` 跑通。

```bash
# 0) 把本目录同步到服务器，例如：
#    /data/cursor-api-proxy/deploy/china/

# 1) 启动专用 Mihomo（global）
sudo CLASH_SUBSCRIPTION_URL='https://你的订阅URL' \
  bash deploy-mihomo.sh start

# 2) 写入密钥
sudo mkdir -p /data/cursor-api-proxy
sudo tee /data/cursor-api-proxy/.env <<'EOF'
CURSOR_API_KEY=cursor官方integrations密钥
CURSOR_BRIDGE_API_KEY=你自己设的强随机串
CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE=false
EOF
sudo chmod 600 /data/cursor-api-proxy/.env

# 3) 构建并启动 cursor-api-proxy
sudo bash deploy-cursor-proxy.sh start

# 4) 更新 Caddy（写入 cursor.litemall.asia）并重载
#    使用已改过的 new-api/deploy/china/deploy-domain.sh：
cd /path/to/new-api/deploy/china
sudo bash deploy-domain.sh restart
```

DNS：`cursor.litemall.asia` A/AAAA 指向本机；安全组放行 `80/443`。

## 验证

```bash
# 仅 proxy 容器走代理（应成功访问外网，视节点而定）
sudo docker exec cursor-api-proxy curl -fsSI -m 20 https://www.google.com | head -n1

# new-api 不应使用 mihomo（对比：未设 HTTP_PROXY）
sudo docker exec new-api env | grep -i proxy || echo 'new-api 无代理环境变量（预期）'

# 健康与域名
curl -fsS https://cursor.litemall.asia/healthz
curl -fsS -H "Authorization: Bearer $CURSOR_BRIDGE_API_KEY" \
  https://cursor.litemall.asia/v1/models
```

浏览器打开：https://cursor.litemall.asia/

## new-api 渠道

| 项 | 值 |
|----|-----|
| Base URL | `http://cursor-api-proxy:8765/v1` |
| API Key | 与 `CURSOR_BRIDGE_API_KEY` 相同 |
| 模型 | `auto` 等 |

## 目录与容器

| 路径/容器 | 说明 |
|-----------|------|
| `/data/mihomo` | Mihomo 配置与订阅缓存 |
| `/data/cursor-api-proxy/.env` | 密钥 |
| `/data/cursor-api-proxy/{src,data,logs}` | 源码克隆、数据、日志 |
| `mihomo` | 不映射公网端口 |
| `cursor-api-proxy` | 默认不映射宿主机端口，只经 Caddy |

## 运维命令

```bash
sudo bash deploy-mihomo.sh status|logs|update
sudo bash deploy-cursor-proxy.sh status|logs|update
# 重建 proxy 后若 502：
sudo docker restart caddy
```

## 注意

- 订阅 URL 等同账号，勿提交 Git、勿贴到公开 Issue。
- 镜像构建需经 mihomo 访问 `cursor.com` 安装 CLI；若构建失败，可在能联网机器构建后 `docker save/load`，或 `SOURCE_MODE=local` 上传源码。
- `deploy-domain.sh` 的 `write_caddyfile` 会重写整个 Caddyfile；请使用已包含 `CURSOR_DOMAIN` 的版本，避免丢站点。
