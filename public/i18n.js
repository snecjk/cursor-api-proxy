(() => {
  'use strict';

  const STORAGE_KEY = 'cursor-api-proxy.locale';
  const DEFAULT_LOCALE = 'zh-CN';
  let runtimeLocale = null;

  const messages = {
    en: {
      'title.dashboard': 'Dashboard — cursor-api-proxy',
      'title.wiki': 'Wiki — cursor-api-proxy',
      'common.dashboard': 'Dashboard',
      'common.wiki': 'Wiki',
      'common.viewSource': 'View source',
      'common.loading': 'Loading…',
      'common.error': 'Error: {message}',
      'common.yes': 'yes',
      'common.no': 'no',
      'status.title': 'Status',
      'status.refresh': 'Refresh',
      'status.notRunning': 'not running',
      'status.unreachable': 'unreachable',
      'status.summaryRunning': 'v{version} · PID {pid} · :{port} · up {uptime}',
      'status.enabled': 'enabled',
      'status.disabled': 'disabled',
      'status.running': 'running',
      'status.down': 'down',
      'status.cursorKeySet': 'CURSOR_API_KEY set',
      'status.cursorKeyMissing': 'no CURSOR_API_KEY',
      'status.bridgeKeyRequired': 'CURSOR_BRIDGE_API_KEY required',
      'status.bridgeKeyOpen': 'no bridge API key gate',
      'status.process': 'Process',
      'status.listening': 'Listening',
      'status.uptime': 'Uptime',
      'status.since': 'since {time}',
      'status.autostart': 'Autostart',
      'status.cursorAuth': 'Cursor auth',
      'status.inboundKey': 'Inbound API key',
      'status.node': 'Node',
      'status.package': 'Package',
      'status.sessionsLog': 'Sessions log',
      'status.serviceLog': 'Service log',
      'status.health': 'health',
      'status.requestFailed': 'Status request failed: {message}',
      'config.title': 'Proxy configuration',
      'config.setting': 'Setting',
      'config.value': 'Value',
      'actions.title': 'Actions',
      'actions.hint': 'runs cursor-api-proxy <cmd> in background',
      'actions.restart': 'Restart proxy',
      'actions.stop': 'Stop proxy',
      'actions.enable': 'Enable autostart',
      'actions.disable': 'Disable autostart',
      'actions.stopConfirm': 'Stop the proxy? Clients will fail until you restart.',
      'actions.restartConfirm': 'Restart the proxy? The dashboard will briefly disconnect.',
      'actions.scheduled': 'Scheduled: cursor-api-proxy {action}',
      'actions.reconnecting': 'Reconnecting…',
      'actions.failed': 'Action failed: {message}',
      'stats.title': 'Request stats (sessions log)',
      'stats.recent': 'Recent requests',
      'stats.total': '{total} requests · {errors} errors ({hours}h window)',
      'stats.none': 'no requests in window',
      'stats.noLines': 'No lines matched in the sessions log for this window.',
      'stats.noRequests': 'No requests yet.',
      'stats.when': 'When',
      'stats.method': 'Method',
      'stats.path': 'Path',
      'stats.status': 'Status',
      'logs.title': 'Live log tail',
      'logs.interval': 'interval',
      'logs.seconds': 's',
      'logs.autoscroll': 'autoscroll',
      'logs.pause': 'Pause',
      'logs.resume': 'Resume',
      'logs.clear': 'Clear',
      'logs.empty': 'Log is empty.',
      'logs.invalidInterval': 'Invalid interval. Use a number in seconds.',
      'logs.clearConfirm': 'Clear and archive current sessions log?',
      'logs.archived': 'Archived log to {path}',
      'logs.clearFailed': 'Clear failed: {message}',
      'popup.confirmTitle': 'Please confirm',
      'popup.confirm': 'Confirm',
      'popup.cancel': 'Cancel',
      'popup.notice': 'Notice',
      'popup.ok': 'OK',
      'duration.seconds': '{count}s',
      'duration.minutes': '{minutes}m {seconds}s',
      'duration.hours': '{hours}h {minutes}m',
      'wiki.failed': 'Failed to load wiki: {message}',
    },
    'zh-CN': {
      'title.dashboard': '控制台 — cursor-api-proxy',
      'title.wiki': '使用手册 — cursor-api-proxy',
      'common.dashboard': '控制台',
      'common.wiki': '使用手册',
      'common.viewSource': '查看源文件',
      'common.loading': '加载中…',
      'common.error': '错误：{message}',
      'common.yes': '是',
      'common.no': '否',
      'status.title': '运行状态',
      'status.refresh': '刷新',
      'status.notRunning': '未运行',
      'status.unreachable': '无法连接',
      'status.summaryRunning': 'v{version} · PID {pid} · 端口 {port} · 已运行 {uptime}',
      'status.enabled': '已启用',
      'status.disabled': '未启用',
      'status.running': '运行中',
      'status.down': '已停止',
      'status.cursorKeySet': '已设置 CURSOR_API_KEY',
      'status.cursorKeyMissing': '未设置 CURSOR_API_KEY',
      'status.bridgeKeyRequired': '需要 CURSOR_BRIDGE_API_KEY',
      'status.bridgeKeyOpen': '未启用代理 API 密钥验证',
      'status.process': '进程',
      'status.listening': '监听地址',
      'status.uptime': '运行时间',
      'status.since': '启动于 {time}',
      'status.autostart': '开机自启',
      'status.cursorAuth': 'Cursor 认证',
      'status.inboundKey': '访问代理的 API 密钥',
      'status.node': 'Node',
      'status.package': '项目目录',
      'status.sessionsLog': '会话日志',
      'status.serviceLog': '服务日志',
      'status.health': '健康检查',
      'status.requestFailed': '获取状态失败：{message}',
      'config.title': '代理配置',
      'config.setting': '配置项',
      'config.value': '当前值',
      'actions.title': '快捷操作',
      'actions.hint': '在后台运行 cursor-api-proxy <命令>',
      'actions.restart': '重启代理',
      'actions.stop': '停止代理',
      'actions.enable': '启用开机自启',
      'actions.disable': '关闭开机自启',
      'actions.stopConfirm': '确定停止代理吗？重新启动前，客户端请求都会失败。',
      'actions.restartConfirm': '确定重启代理吗？控制台会短暂断开连接。',
      'actions.scheduled': '已安排执行：cursor-api-proxy {action}',
      'actions.reconnecting': '正在重新连接…',
      'actions.failed': '操作失败：{message}',
      'stats.title': '请求统计（会话日志）',
      'stats.recent': '最近请求',
      'stats.total': '共 {total} 个请求 · {errors} 个错误（最近 {hours} 小时）',
      'stats.none': '统计时段内没有请求',
      'stats.noLines': '会话日志中没有符合当前统计时段的记录。',
      'stats.noRequests': '暂无请求。',
      'stats.when': '时间',
      'stats.method': '方法',
      'stats.path': '路径',
      'stats.status': '状态',
      'logs.title': '实时日志',
      'logs.interval': '刷新间隔',
      'logs.seconds': '秒',
      'logs.autoscroll': '自动滚动',
      'logs.pause': '暂停',
      'logs.resume': '继续',
      'logs.clear': '清空',
      'logs.empty': '日志为空。',
      'logs.invalidInterval': '刷新间隔无效，请输入秒数。',
      'logs.clearConfirm': '确定清空并归档当前会话日志吗？',
      'logs.archived': '日志已归档到 {path}',
      'logs.clearFailed': '清空失败：{message}',
      'popup.confirmTitle': '请确认',
      'popup.confirm': '确认',
      'popup.cancel': '取消',
      'popup.notice': '提示',
      'popup.ok': '知道了',
      'duration.seconds': '{count} 秒',
      'duration.minutes': '{minutes} 分 {seconds} 秒',
      'duration.hours': '{hours} 小时 {minutes} 分',
      'wiki.failed': '加载使用手册失败：{message}',
    },
  };

  function normalizeLocale(value) {
    return String(value || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  }

  function getLocale() {
    if (runtimeLocale) return runtimeLocale;

    const queryLocale = new URLSearchParams(window.location.search).get('lang');
    if (queryLocale) return normalizeLocale(queryLocale);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return normalizeLocale(stored);
    } catch {
      // localStorage may be unavailable in privacy-restricted contexts.
    }

    const preferred = Array.isArray(navigator.languages)
      ? navigator.languages[0]
      : navigator.language;
    return preferred ? normalizeLocale(preferred) : DEFAULT_LOCALE;
  }

  function setLocale(locale) {
    const normalized = normalizeLocale(locale);
    runtimeLocale = normalized;
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Keep the current page usable even when persistence is unavailable.
    }
    return normalized;
  }

  function t(key, values = {}) {
    const locale = getLocale();
    const template = messages[locale][key] ?? messages.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : `{${name}}`);
  }

  function applyTranslations(root = document) {
    document.documentElement.lang = getLocale();
    for (const node of root.querySelectorAll('[data-i18n]')) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const node of root.querySelectorAll('[data-i18n-title]')) {
      node.setAttribute('title', t(node.dataset.i18nTitle));
    }
    for (const node of root.querySelectorAll('[data-locale-link]')) {
      const url = new URL(node.getAttribute('href'), window.location.origin);
      url.searchParams.set('lang', getLocale());
      node.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function bindLanguageSelect(id = 'language-select') {
    const select = document.getElementById(id);
    if (!select) return;
    select.value = getLocale();
    select.addEventListener('change', () => {
      const locale = setLocale(select.value);
      const url = new URL(window.location.href);
      url.searchParams.set('lang', locale);
      window.location.assign(url.href);
    });
  }

  window.CursorProxyI18n = {
    applyTranslations,
    bindLanguageSelect,
    getLocale,
    normalizeLocale,
    setLocale,
    t,
  };
})();
