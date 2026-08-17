export type AppLocale = "en" | "zh-CN";

const en = {
  "error.generic": "Error: {message}",
  "parse.limitRequires": "--limit requires a positive integer",
  "parse.limitRange": "--limit must be an integer between 1 and 5000",
  "parse.intervalRange":
    "--interval requires a positive number between 0.001 and 86400 seconds",
  "parse.modeRequires": "--mode requires a value (agent, ask, or plan)",
  "parse.modeInvalid": "invalid mode: {mode}. Expected agent, ask, or plan.",
  "parse.unknown": "Unknown argument: {argument}",
  "parse.requestOptions":
    "--limit, --watch, and --interval require requests command",
  "parse.languageRequires": "--lang requires a value (zh-CN or en)",
  "parse.languageInvalid":
    "Unsupported language: {language}. Use zh-CN or en.",
  "help.body": `Usage:
  cursor-api-proxy [options]

Commands:
  login [name]              Log into a Cursor account (saved to ~/.cursor-api-proxy/accounts/)
  login [name] --proxy=...  Same, but open Chrome through a random proxy from a comma-separated list
  logout <name>             Remove a saved Cursor account
  accounts                  List saved accounts with plan info
  reset-hwid                Reset Cursor machine/telemetry IDs (anti-ban)
  reset-hwid --deep-clean   Also wipe session storage and cookies
  requests                  Show latest completed API requests
  requests --watch          Refresh latest requests continuously

Options:
  --tailscale               Bind to 0.0.0.0 for tailnet/LAN access
  --verbose                 Enable verbose request/model logs
  --mode <agent|ask|plan>   Default Cursor CLI mode (overridden by env or per-request)
  --lang <zh-CN|en>         Output language (defaults to system locale)
  --limit <n>               Requests to show (1-5000, default 20)
  --watch                   Refresh requests continuously
  --interval <s>            Watch refresh interval (default 2)
  -h, --help                Show this help message`,
  "login.usingProxy": "Using proxy: {proxy}",
  "login.chromeFailed": "Could not open Chrome automatically: {message}",
  "login.openUrl": "Please open this URL in a private/incognito window:\n{url}\n",
  "login.start": "Logging into Cursor account: {name}",
  "login.config": "Config: {path}",
  "login.instructions":
    "A Chrome incognito window will open — complete the login there.",
  "login.cancelled": "Login cancelled.",
  "login.cliMissing":
    "Could not find '{binary}'. Make sure the Cursor CLI is installed.",
  "login.launchFailed": "Error launching agent login:",
  "login.saved":
    "Account '{name}' saved — it will be auto-discovered when you start the proxy.",
  "login.failed": "Login failed (exit code {code}).",
  "login.failedError": "Login failed with code {code}",
  "accounts.none":
    "No accounts found. Use 'cursor-api-proxy login' to add one.",
  "accounts.title": "Cursor Accounts:",
  "accounts.canceled": "canceled",
  "accounts.expires": "expires {date}",
  "accounts.authenticated": "Authenticated",
  "accounts.notAuthenticated": "Not authenticated",
  "accounts.tip":
    "Tip: run 'cursor-api-proxy logout <name>' to remove an account.",
  "accounts.nameRequired": "Error: Please specify the account name to remove.",
  "accounts.logoutUsage": "Usage: cursor-api-proxy logout <account-name>",
  "accounts.notFound": "Account '{name}' not found.",
  "accounts.removed": "Account '{name}' removed.",
  "accounts.removeFailed": "Error removing account:",
  "accounts.plan.enterprise": "Enterprise",
  "accounts.plan.free": "Free",
  "usage.proTrial":
    "Pro Trial ({days}d left) — unlimited fast requests",
  "usage.extendedLimits": "{plan} — extended limits",
  "usage.hobby": "Hobby (free) — limited agent requests",
  "usage.fastPremium": "Fast Premium Requests",
  "usage.cursorSmall": "Cursor Small (free)",
  "usage.billingPeriod": "Billing period from {date}",
  "usage.none": "No requests this billing period",
  "usage.requests": "{count} requests",
  "usage.unlimited": "0 requests (unlimited)",
  "requests.title": "Latest requests ({count}) · {path}",
  "requests.none": "No requests found.",
  "requests.when": "WHEN",
  "requests.method": "METHOD",
  "requests.status": "STATUS",
  "requests.from": "FROM",
  "requests.path": "PATH",
  "server.shutdown": "{signal} received — shutting down gracefully…",
  "server.shutdownTimeout":
    "[shutdown] Timed out waiting for connections to drain — forcing exit.",
  "server.portInUse":
    "Port {port} is already in use. Set CURSOR_BRIDGE_PORT to use a different port.",
  "server.error": "Server error:",
  "server.listening": "cursor-api-proxy listening on {url}",
  "server.agentBin": "agent bin",
  "server.launcher": "launcher",
  "server.workspace": "workspace",
  "server.mode": "mode",
  "server.defaultModel": "default model",
  "server.force": "force",
  "server.approveMcps": "approve mcps",
  "server.requiredKey": "required api key",
  "server.sessionsLog": "sessions log",
  "server.chatOnlyWorkspace": "chat-only workspace",
  "server.verboseTraffic": "verbose traffic",
  "server.maxMode": "max mode",
  "server.windowsBudget": "Windows cmdline budget",
  "server.windowsBudgetHint":
    "prompt tail truncation when over limit; Windows only",
  "server.accountPool":
    "account pool: enabled with {count} configuration directories",
  "common.yes": "yes",
  "common.no": "no",
  "common.isolatedTemp": "isolated temp dir",
  "reset.stopping": "Stopping Cursor processes...",
  "reset.stopped": "Cursor stopped (or was not running)",
  "reset.fileMissing": "{file} not found: {path}",
  "reset.fileUpdated": "{file} updated",
  "reset.fileError": "{file} error: {message}",
  "reset.sqliteMissing":
    "sqlite3 not found — skipping state.vscdb (install sqlite3 to fix)",
  "reset.sqliteUnexpected":
    "state.vscdb: skipping update — unexpected key/value format",
  "reset.machineIdUpdated": "machineId file updated ({file})",
  "reset.deepCleaning": "Deep-cleaning session data...",
  "reset.wiped": "Wiped {count} cache/session items",
  "reset.title": "Cursor HWID Reset",
  "reset.description":
    "Resets all machine / telemetry IDs so Cursor sees a fresh install.",
  "reset.closeWarning":
    "Cursor must be closed — it will be killed automatically.",
  "reset.configMissing": "Cursor config not found at:\n   {path}",
  "reset.installHint":
    "Make sure Cursor is installed and has been run at least once.",
  "reset.dryRun": "[DRY RUN] Would reset IDs in:",
  "reset.generated": "Generated new IDs:",
  "reset.updating": "Updating {file}...",
  "reset.complete": "HWID reset complete. You can now restart Cursor.",
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  "error.generic": "错误：{message}",
  "parse.limitRequires": "--limit 需要一个正整数",
  "parse.limitRange": "--limit 必须是 1 到 5000 之间的整数",
  "parse.intervalRange": "--interval 必须是 0.001 到 86400 之间的秒数",
  "parse.modeRequires": "--mode 需要指定模式（agent、ask 或 plan）",
  "parse.modeInvalid": "无效模式：{mode}。可用值为 agent、ask 或 plan。",
  "parse.unknown": "未知参数：{argument}",
  "parse.requestOptions":
    "--limit、--watch 和 --interval 只能与 requests 命令一起使用",
  "parse.languageRequires": "--lang 需要指定语言（zh-CN 或 en）",
  "parse.languageInvalid": "不支持的语言：{language}。请使用 zh-CN 或 en。",
  "help.body": `用法：
  cursor-api-proxy [选项]

命令：
  login [名称]              登录 Cursor 账号（保存到 ~/.cursor-api-proxy/accounts/）
  login [名称] --proxy=...  登录时通过逗号分隔的代理列表随机选择代理打开 Chrome
  logout <名称>             删除已保存的 Cursor 账号
  accounts                  列出已保存账号及套餐信息
  reset-hwid                重置 Cursor 机器与遥测 ID
  reset-hwid --deep-clean   同时清理会话存储和 Cookie
  requests                  显示最近完成的 API 请求
  requests --watch          持续刷新最近请求

选项：
  --tailscale               监听 0.0.0.0，允许 Tailnet/局域网访问
  --verbose                 输出详细的请求和模型日志
  --mode <agent|ask|plan>   默认 Cursor CLI 模式（环境变量或单次请求可覆盖）
  --lang <zh-CN|en>         输出语言（默认跟随系统）
  --limit <数量>            显示的请求数量（1-5000，默认 20）
  --watch                   持续刷新请求
  --interval <秒>           刷新间隔（默认 2 秒）
  -h, --help                显示此帮助`,
  "login.usingProxy": "使用代理：{proxy}",
  "login.chromeFailed": "无法自动打开 Chrome：{message}",
  "login.openUrl": "请在隐私/无痕窗口中打开以下网址：\n{url}\n",
  "login.start": "正在登录 Cursor 账号：{name}",
  "login.config": "配置目录：{path}",
  "login.instructions": "即将打开 Chrome 无痕窗口，请在窗口中完成登录。",
  "login.cancelled": "登录已取消。",
  "login.cliMissing": "找不到“{binary}”，请确认已安装 Cursor CLI。",
  "login.launchFailed": "启动 Agent 登录流程失败：",
  "login.saved": "账号“{name}”已保存，启动代理时会自动发现该账号。",
  "login.failed": "登录失败（退出码 {code}）。",
  "login.failedError": "登录失败，退出码 {code}",
  "accounts.none": "未找到账号。请使用“cursor-api-proxy login”添加账号。",
  "accounts.title": "Cursor 账号：",
  "accounts.canceled": "已取消",
  "accounts.expires": "到期时间 {date}",
  "accounts.authenticated": "已认证",
  "accounts.notAuthenticated": "未认证",
  "accounts.tip": "提示：运行“cursor-api-proxy logout <名称>”可删除账号。",
  "accounts.nameRequired": "错误：请指定要删除的账号名称。",
  "accounts.logoutUsage": "用法：cursor-api-proxy logout <账号名称>",
  "accounts.notFound": "未找到账号“{name}”。",
  "accounts.removed": "账号“{name}”已删除。",
  "accounts.removeFailed": "删除账号失败：",
  "accounts.plan.enterprise": "企业版",
  "accounts.plan.free": "免费版",
  "usage.proTrial": "Pro 试用版（剩余 {days} 天）— 快速请求不限量",
  "usage.extendedLimits": "{plan} — 扩展额度",
  "usage.hobby": "Hobby（免费版）— Agent 请求额度有限",
  "usage.fastPremium": "快速高级请求",
  "usage.cursorSmall": "Cursor Small（免费）",
  "usage.billingPeriod": "计费周期开始于 {date}",
  "usage.none": "本计费周期暂无请求",
  "usage.requests": "{count} 个请求",
  "usage.unlimited": "0 个请求（不限量）",
  "requests.title": "最近请求（{count}）· {path}",
  "requests.none": "未找到请求。",
  "requests.when": "时间",
  "requests.method": "方法",
  "requests.status": "状态",
  "requests.from": "来源",
  "requests.path": "路径",
  "server.shutdown": "收到 {signal}，正在平滑关闭…",
  "server.shutdownTimeout": "[关闭] 等待连接结束超时，正在强制退出。",
  "server.portInUse":
    "端口 {port} 已被占用，请设置 CURSOR_BRIDGE_PORT 使用其他端口。",
  "server.error": "服务器错误：",
  "server.listening": "cursor-api-proxy 正在监听 {url}",
  "server.agentBin": "Agent 程序",
  "server.launcher": "启动器",
  "server.workspace": "工作目录",
  "server.mode": "模式",
  "server.defaultModel": "默认模型",
  "server.force": "强制执行",
  "server.approveMcps": "自动批准 MCP",
  "server.requiredKey": "需要 API 密钥",
  "server.sessionsLog": "会话日志",
  "server.chatOnlyWorkspace": "仅聊天工作目录",
  "server.verboseTraffic": "详细流量日志",
  "server.maxMode": "Max 模式",
  "server.windowsBudget": "Windows 命令行长度上限",
  "server.windowsBudgetHint": "超出限制时截断提示词尾部；仅 Windows",
  "server.accountPool": "账号池：已启用，共 {count} 个配置目录",
  "common.yes": "是",
  "common.no": "否",
  "common.isolatedTemp": "隔离的临时目录",
  "reset.stopping": "正在停止 Cursor 进程…",
  "reset.stopped": "Cursor 已停止（或原本未运行）",
  "reset.fileMissing": "未找到 {file}：{path}",
  "reset.fileUpdated": "{file} 已更新",
  "reset.fileError": "{file} 出错：{message}",
  "reset.sqliteMissing": "找不到 sqlite3，已跳过 state.vscdb（安装 sqlite3 后可处理）",
  "reset.sqliteUnexpected": "state.vscdb 的键值格式异常，已跳过更新",
  "reset.machineIdUpdated": "machineId 文件已更新（{file}）",
  "reset.deepCleaning": "正在深度清理会话数据…",
  "reset.wiped": "已清理 {count} 个缓存/会话项目",
  "reset.title": "重置 Cursor HWID",
  "reset.description": "重置所有机器与遥测 ID，使 Cursor 将其识别为全新安装。",
  "reset.closeWarning": "Cursor 必须关闭，程序将自动结束其进程。",
  "reset.configMissing": "未找到 Cursor 配置：\n   {path}",
  "reset.installHint": "请确认已安装并至少运行过一次 Cursor。",
  "reset.dryRun": "[试运行] 将重置以下位置中的 ID：",
  "reset.generated": "已生成新的 ID：",
  "reset.updating": "正在更新 {file}…",
  "reset.complete": "HWID 重置完成，现在可以重新启动 Cursor。",
};

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en,
  "zh-CN": zh,
};

let configuredLocale: AppLocale | undefined;

export function parseLocale(value: string | undefined): AppLocale | undefined {
  const normalized = value?.trim().toLowerCase().replaceAll("_", "-");
  if (!normalized) return undefined;
  if (
    normalized === "zh" ||
    normalized.startsWith("zh-") ||
    normalized.startsWith("zh.")
  ) {
    return "zh-CN";
  }
  if (normalized === "en" || normalized.startsWith("en-") || normalized.startsWith("en.")) {
    return "en";
  }
  return undefined;
}

export function resolveLocale(
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env,
): AppLocale {
  if (explicit?.trim()) return parseLocale(explicit) ?? "en";

  const environmentLocale = [
    env.CURSOR_API_PROXY_LANG,
    env.LC_ALL,
    env.LC_MESSAGES,
    env.LANG,
  ].find((candidate) => candidate?.trim());
  if (environmentLocale) return parseLocale(environmentLocale) ?? "en";

  const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  return parseLocale(systemLocale) ?? "en";
}

export function setLocale(locale?: string): AppLocale {
  configuredLocale = resolveLocale(locale);
  return configuredLocale;
}

export function getLocale(): AppLocale {
  return configuredLocale ?? resolveLocale();
}

export function t(
  key: MessageKey,
  values: Record<string, string | number | null | undefined> = {},
  locale: AppLocale = getLocale(),
): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name] ?? "")
      : match,
  );
}
