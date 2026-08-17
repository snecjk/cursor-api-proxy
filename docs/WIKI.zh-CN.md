# cursor-api-proxy — 中文使用手册

**cursor-api-proxy** 是一个小型 **Node.js / TypeScript** 服务。它提供兼容 OpenAI 的 HTTP API（同时支持 Anthropic 风格的 `POST /v1/messages`），并把聊天请求转发给 Cursor CLI Agent（`cursor-agent` / ACP）。项目由早期的单文件 **claude-cursor-bridge** 方案演进而来，现已封装为 npm 包，并支持 TLS、账号池、严格模型匹配等功能。

本页面介绍本地控制台、浏览器中的 Markdown 使用手册，以及 `cursor-api-proxy` Shell 启动脚本。

---

## 目录

1. [浏览器功能](#浏览器功能)
2. [快速开始](#快速开始)
3. [CLI 启动器](#cli-启动器)
4. [安装启动脚本](#安装启动脚本)
5. [macOS 自动启动](#macos-自动启动)
6. [HTTP 路由](#http-路由)
7. [文件与目录](#文件与目录)
8. [故障排查](#故障排查)

---

## 浏览器功能

代理运行后，可以打开：

| URL | 用途 |
|-----|------|
| `http://127.0.0.1:8765/` | **控制台**：查看运行状态、当前配置、`sessions.log` 请求统计、实时日志，并执行常用操作 |
| `http://127.0.0.1:8765/wiki` | **使用手册**：根据当前语言显示 `docs/WIKI.zh-CN.md` 或 `docs/WIKI.md` |
| `http://127.0.0.1:8765/healthz` | 返回纯文本 **`ok`**，用于脚本和存活检查 |
| `http://127.0.0.1:8765/health` | 返回 JSON 格式的健康信息，包括版本、工作目录、默认模型等 |

默认端口为 **`8765`**（`CURSOR_BRIDGE_PORT`），默认监听地址为 **`127.0.0.1`**（`CURSOR_BRIDGE_HOST`）。

控制台和使用手册不要求提供 `CURSOR_BRIDGE_API_KEY`；该密钥只保护 LLM API 流量。生产环境中请保持服务仅监听本机回环地址。

页面右上角可以切换中文和 English，选择结果会保存在浏览器中。

---

## 快速开始

```bash
cd /path/to/cursor-api-proxy
npm install
npm run build

# 前台运行，可以直接查看输出：
npm start

# 或在安装启动脚本后使用：
cursor-api-proxy start
cursor-api-proxy health
```

然后打开 `http://127.0.0.1:8765/`。如果修改过监听地址或端口，请使用对应地址。

CLI 会根据系统语言自动选择中文或英文。也可以显式设置：

```bash
export CURSOR_API_PROXY_LANG=zh-CN
cursor-api-proxy --help
```

---

## CLI 启动器

`~/.local/bin/cursor-api-proxy` 中的 bash 脚本可以启动或停止 Node 进程、检查 `/healthz`，并可选安装 launchd 配置。

| 命令 | 行为 |
|------|------|
| `cursor-api-proxy` | 不带参数时先显示健康状态，再进入简易交互菜单 |
| `cursor-api-proxy start` | 后台启动，标准输出和错误追加到 `~/.cursor-api-proxy/proxy.log`，并等待 `/healthz` 就绪 |
| `cursor-api-proxy stop` | 先发送 `SIGTERM`，必要时再发送 `SIGKILL` |
| `cursor-api-proxy restart` | 依次执行 `stop` 和 `start` |
| `cursor-api-proxy health` | 显示 PID、端口、launchd 状态、HTTP 探测结果和最新日志 |
| `cursor-api-proxy requests` | 从 `sessions.log` 读取并格式化显示最近完成的请求 |
| `cursor-api-proxy enable` | 写入 `~/Library/LaunchAgents/com.cursor-api-proxy.plist` 并加载服务 |
| `cursor-api-proxy disable` | 卸载 launchd 服务并删除 plist |
| `cursor-api-proxy run` | 在前台运行 `node …/dist/cli.js`，供 launchd 调用 |

请求查看器选项：

```bash
cursor-api-proxy requests --limit 50
cursor-api-proxy requests --watch --interval 1
```

查看器会直接读取 `CURSOR_BRIDGE_SESSIONS_LOG`，默认路径为 `~/.cursor-api-proxy/sessions.log`，因此代理停止后仍可查看。设置 `NO_COLOR=1` 可以关闭 ANSI 颜色。

启动脚本支持以下环境变量：

| 变量 | 含义 |
|------|------|
| `CURSOR_API_PROXY_ROOT` | Git 项目目录；执行 `npm run build` 后其中必须包含 `dist/cli.js` |
| `CURSOR_API_PROXY_LANG` | 界面语言：`zh-CN` 或 `en`；未设置时跟随系统语言 |
| `CURSOR_BRIDGE_PORT` | HTTP 端口，默认 **8765** |
| `CURSOR_BRIDGE_HOST` | 监听地址，默认 **127.0.0.1** |

---

## 安装启动脚本

在克隆的项目目录中执行：

```bash
chmod +x scripts/cursor-api-proxy
mkdir -p ~/.local/bin
ln -sf "$(pwd)/scripts/cursor-api-proxy" ~/.local/bin/cursor-api-proxy
export CURSOR_API_PROXY_ROOT="$(pwd)"   # 如需永久生效，请加入 ~/.zshrc
cursor-api-proxy health
```

如果通过 npm 全局安装，请把 `CURSOR_API_PROXY_ROOT` 指向包含 `dist/cli.js` 的包目录，例如 `$(npm root -g)/cursor-api-proxy`。

---

## macOS 自动启动

```bash
cursor-api-proxy enable
launchctl list | grep cursor-api-proxy
```

plist 标签为 **`com.cursor-api-proxy`**。如果希望进程停止后不再自动拉起，请先执行 **`cursor-api-proxy disable`**，再执行 **`stop`**；否则 launchd 的 **KeepAlive** 可能重新启动进程。

---

## HTTP 路由

**LLM 与健康检查**

- `GET /health`、`GET /healthz`、`GET /v1/models`
- `POST /v1/chat/completions`、`POST /v1/messages`

**控制台（无需 API 密钥）**

- `GET /`、`GET /wiki`、`GET /static/*`
- `GET /api/status`、`GET /api/config`、`GET /api/log`、`GET /api/stats`
- `GET /api/wiki?lang=zh-CN` 或 `GET /api/wiki?lang=en`
- `POST /api/control`，请求体为 `{ "action": "start" | "stop" | "restart" | "enable" | "disable" }`。该接口会在后台运行 `~/.local/bin/cursor-api-proxy` 脚本。

---

## 文件与目录

| 路径 | 作用 |
|------|------|
| `dist/cli.js` | 编译后的服务入口 |
| `public/` | 控制台、使用手册页面和静态资源 |
| `docs/WIKI.md` | 英文使用手册源文件 |
| `docs/WIKI.zh-CN.md` | 中文使用手册源文件 |
| `scripts/cursor-api-proxy` | 启动脚本，也是符号链接的目标 |
| `~/.cursor-api-proxy/sessions.log` | 默认请求日志，每个已完成响应占一行 |
| `~/.cursor-api-proxy/proxy.log` | 启动器和后台进程的标准输出、错误日志 |
| `~/.cursor-api-proxy/proxy.pid` | 运行中的 Node 进程写入的 PID 文件 |

---

## 故障排查

**点击操作按钮时提示 `CLI not found`**

请按[安装启动脚本](#安装启动脚本)中的步骤，将启动器安装到 `~/.local/bin/cursor-api-proxy`。

**提示 `Started, but no health response`**

- 确认已执行 `npm run build`，并且 `dist/cli.js` 存在。
- 检查 `CURSOR_API_PROXY_ROOT` 是否正确。
- 如果端口已被占用，请把 `CURSOR_BRIDGE_PORT` 改为空闲端口。环境变量和 plist 中的值必须一致；修改后请重新执行 `enable`。

**控制台显示“暂无请求”**

统计数据来自代理写入 `sessions.log` 的记录，格式为 `ISO8601 METHOD PATH REMOTE STATUS`。如果通过 `CURSOR_BRIDGE_SESSIONS_LOG` 修改了日志路径，控制台会读取新路径。

**CLI 没有显示中文**

设置 `CURSOR_API_PROXY_LANG=zh-CN`。如果使用 launchd，请重新执行 `cursor-api-proxy enable`，让语言设置写入新的 plist。

---

## 与 claude-cursor-bridge 的关系

| 功能 | claude-cursor-bridge | cursor-api-proxy |
|------|----------------------|------------------|
| Anthropic → Cursor | 支持 | 支持，并额外兼容 OpenAI Chat Schema |
| 本地控制台和使用手册 | 支持 | 支持 |
| bash 启动器和 launchd | `claude-bridge` | `cursor-api-proxy` |
| npm 包与 TypeScript | 不支持 | 支持 |
