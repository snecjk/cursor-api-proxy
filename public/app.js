(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const i18n = window.CursorProxyI18n;
  const { t } = i18n;

  const state = {
    paused: false,
    autoscroll: true,
    statusTimer: null,
    logTimer: null,
    logIntervalMs: 3000,
    logIntervalApplyTimer: null,
    statsTimer: null,
    lastStatusOk: true,
  };

  function fmtDuration(seconds) {
    if (seconds < 60) return t('duration.seconds', { count: seconds });
    if (seconds < 3600) {
      return t('duration.minutes', {
        minutes: Math.floor(seconds / 60),
        seconds: seconds % 60,
      });
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return t('duration.hours', { hours: h, minutes: m });
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function toast(message, kind = 'ok', ttl = 3500) {
    const t = el('div', { class: `toast ${kind}` }, message);
    $('toasts').appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 200);
    }, ttl);
  }

  function popup({ title, message, okText = t('popup.ok'), cancelText = null, danger = false }) {
    return new Promise(resolve => {
      const overlay = el('div', { class: 'popup-overlay' });
      const card = el('div', { class: 'popup-card' });
      const head = el('div', { class: 'popup-head' }, title);
      const body = el('div', { class: 'popup-body' }, message);
      const actions = el('div', { class: 'popup-actions' });
      const okBtn = el('button', { class: `btn small ${danger ? 'danger' : 'primary'}` }, okText);
      let cancelBtn = null;

      function finish(value) {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(value);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') finish(false);
      }

      if (cancelText) {
        cancelBtn = el('button', { class: 'btn small' }, cancelText);
        cancelBtn.addEventListener('click', () => finish(false));
        actions.appendChild(cancelBtn);
      }
      okBtn.addEventListener('click', () => finish(true));
      actions.appendChild(okBtn);

      overlay.addEventListener('click', e => {
        if (e.target === overlay && cancelText) finish(false);
      });
      document.addEventListener('keydown', onKeyDown);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      setTimeout(() => {
        if (cancelBtn) cancelBtn.focus();
        else okBtn.focus();
      }, 0);
    });
  }

  function confirmPopup(message, danger = false) {
    return popup({
      title: t('popup.confirmTitle'),
      message,
      okText: t('popup.confirm'),
      cancelText: t('popup.cancel'),
      danger,
    });
  }

  function alertPopup(message) {
    return popup({
      title: t('popup.notice'),
      message,
      okText: t('popup.ok'),
      cancelText: null,
      danger: false,
    });
  }

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  function renderStatus(s) {
    const dot = $('status-dot');
    const summary = $('status-summary');
    if (s.running) {
      dot.classList.remove('down');
      summary.textContent = t('status.summaryRunning', {
        version: s.version,
        pid: s.pid,
        port: s.port,
        uptime: fmtDuration(s.uptimeSeconds),
      });
    } else {
      dot.classList.add('down');
      summary.textContent = t('status.notRunning');
    }

    const launchdBadge = s.launchdLoaded
      ? el('span', { class: 'badge green' }, t('status.enabled'))
      : el('span', { class: 'badge muted' }, t('status.disabled'));

    const runBadge = s.running
      ? el('span', { class: 'badge green' }, t('status.running'))
      : el('span', { class: 'badge red' }, t('status.down'));

    const cursorKey = s.apiKeyConfigured
      ? el('span', { class: 'badge green' }, t('status.cursorKeySet'))
      : el('span', { class: 'badge yellow' }, t('status.cursorKeyMissing'));

    const bridgeKey = s.bridgeApiKeyRequired
      ? el('span', { class: 'badge yellow' }, t('status.bridgeKeyRequired'))
      : el('span', { class: 'badge muted' }, t('status.bridgeKeyOpen'));

    const kv = el('div', { class: 'kv' },
      el('div', { class: 'k' }, t('status.process')), el('div', { class: 'v' }, runBadge, ' ', `PID ${s.pid ?? '—'}`),
      el('div', { class: 'k' }, t('status.listening')), el('div', { class: 'v' }, `http://${s.host}:${s.port}`),
      el('div', { class: 'k' }, t('status.uptime')), el('div', { class: 'v' }, fmtDuration(s.uptimeSeconds), el('span', { class: 'dim-text' }, `  (${t('status.since', { time: new Date(s.startedAt).toLocaleString(i18n.getLocale()) })})`)),
      el('div', { class: 'k' }, t('status.autostart')), el('div', { class: 'v' }, launchdBadge, ' ', el('span', { class: 'dim-text mono' }, (s.plistPath || '').replace(/^.*\//, ''))),
      el('div', { class: 'k' }, t('status.cursorAuth')), el('div', { class: 'v' }, cursorKey),
      el('div', { class: 'k' }, t('status.inboundKey')), el('div', { class: 'v' }, bridgeKey),
      el('div', { class: 'k' }, t('status.node')), el('div', { class: 'v' }, `${s.node} (${s.platform})`),
      el('div', { class: 'k' }, t('status.package')), el('div', { class: 'v mono', style: 'font-size: 11px; word-break: break-all;' }, s.packageRoot),
      el('div', { class: 'k' }, t('status.sessionsLog')), el('div', { class: 'v mono', style: 'font-size: 11px; word-break: break-all;' }, s.sessionsLogPath),
      el('div', { class: 'k' }, t('status.serviceLog')), el('div', { class: 'v mono', style: 'font-size: 11px; word-break: break-all;' }, s.serviceLog),
    );

    const copy = el('div', { class: 'copy-row' },
      el('span', { class: 'label' }, t('status.health')),
      el('code', {}, `curl -s http://${s.host}:${s.port}/healthz`),
    );

    $('status-body').replaceChildren(kv, copy);
  }

  function renderConfig(cfg) {
    const skip = new Set(['requiredKey']);
    const formatValue = value => {
      if (typeof value === 'boolean') {
        return t(value ? 'common.yes' : 'common.no');
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    };
    const rows = Object.entries(cfg)
      .filter(([k]) => !skip.has(k))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => el('tr', {},
        el('td', { class: 'mono', style: 'font-size: 12px; color: var(--muted);' }, k),
        el('td', { class: 'model', style: 'font-size: 12px; word-break: break-word;' },
          formatValue(v)),
      ));
    const tbl = el('table', { class: 'mapping' },
      el('thead', {}, el('tr', {}, el('th', {}, t('config.setting')), el('th', {}, t('config.value')))),
      el('tbody', {}, ...rows),
    );
    $('config-body').replaceChildren(tbl);
  }

  function renderStats(stats) {
    $('stats-total').textContent = stats.total > 0
      ? t('stats.total', {
        total: stats.total,
        errors: stats.errors,
        hours: stats.windowHours,
      })
      : t('stats.none');

    if (stats.total === 0) {
      $('stats-body').replaceChildren(el('div', { class: 'empty' }, t('stats.noLines')));
      $('recent-body').replaceChildren(el('div', { class: 'empty' }, t('stats.noRequests')));
      return;
    }

    const paths = Object.entries(stats.byPath).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(...paths.map(([, n]) => n));
    const rows = paths.map(([p, n]) => el('div', { class: 'stat-row' },
      el('div', { class: 'mono', style: 'font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, p),
      el('div', { class: 'bar bar-OTHER' }, el('div', { style: `width: ${max ? Math.round((n / max) * 100) : 0}%` })),
      el('div', { class: 'count' }, String(n)),
    ));
    $('stats-body').replaceChildren(...rows);

    const recentTbl = el('table', { class: 'mapping' },
      el('thead', {}, el('tr', {},
        el('th', {}, t('stats.when')),
        el('th', {}, t('stats.method')),
        el('th', {}, t('stats.path')),
        el('th', {}, t('stats.status')),
      )),
      el('tbody', {}, ...stats.recent.slice(0, 14).map(r => el('tr', {},
        el('td', { class: 'mono', style: 'font-size: 11px;' }, new Date(r.ts).toLocaleTimeString(i18n.getLocale())),
        el('td', { class: 'mono', style: 'font-size: 12px;' }, r.method),
        el('td', { class: 'mono', style: 'font-size: 11px;' }, r.pathname),
        el('td', {}, el('span', { class: r.status >= 400 ? 'badge yellow' : 'badge green' }, String(r.status))),
      ))),
    );
    $('recent-body').replaceChildren(recentTbl);
  }

  function formatLogLine(line) {
    const m = line.match(/^(\S+Z)\s+(.+)$/);
    let tsPart = '';
    let rest = line;
    if (m) {
      tsPart = m[1];
      rest = m[2];
    }
    const wrap = el('div', { class: 'log-line' });
    if (tsPart) {
      const d = new Date(tsPart);
      wrap.appendChild(el('span', { class: 'ts' }, d.toLocaleTimeString(i18n.getLocale()) + ' '));
    }
    if (rest.includes(' ERROR ')) {
      wrap.appendChild(el('span', { class: 'err' }, rest));
    } else if (/\s(5\d\d)\s*$/.test(rest) || /\s(4\d\d)\s*$/.test(rest)) {
      wrap.appendChild(el('span', { class: 'req' }, rest));
    } else if (/listening on/.test(rest)) {
      wrap.appendChild(el('span', { class: 'ok' }, rest));
    } else {
      wrap.appendChild(document.createTextNode(rest));
    }
    return wrap;
  }

  function renderLog(lines) {
    const viewer = $('log-viewer');
    if (!lines.length) {
      viewer.replaceChildren(el('div', { class: 'empty' }, t('logs.empty')));
      return;
    }
    viewer.replaceChildren(...lines.map(formatLogLine));
    if (state.autoscroll) viewer.scrollTop = viewer.scrollHeight;
  }

  function restartLogPolling() {
    if (state.logTimer) clearInterval(state.logTimer);
    state.logTimer = setInterval(refreshLog, state.logIntervalMs);
  }

  function applyLogIntervalFromInput() {
    const raw = $('log-interval-input').value.trim();
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      $('log-interval-input').value = String(state.logIntervalMs / 1000);
      toast(t('logs.invalidInterval'), 'err');
      return;
    }
    const nextMs = Math.max(500, Math.round(seconds * 1000));
    if (nextMs === state.logIntervalMs) return;
    state.logIntervalMs = nextMs;
    restartLogPolling();
  }

  async function refreshStatus() {
    try {
      const s = await fetchJSON('/api/status');
      renderStatus(s);
      state.lastStatusOk = true;
    } catch (e) {
      $('status-dot').classList.add('down');
      $('status-summary').textContent = t('status.unreachable');
      if (state.lastStatusOk) {
        toast(t('status.requestFailed', { message: e.message }), 'err');
      }
      state.lastStatusOk = false;
    }
  }

  async function refreshConfig() {
    try {
      const cfg = await fetchJSON('/api/config');
      renderConfig(cfg);
    } catch (e) {
      $('config-body').replaceChildren(el('div', { class: 'empty' }, t('common.error', { message: e.message })));
    }
  }

  async function refreshStats() {
    try {
      const stats = await fetchJSON('/api/stats?hours=24');
      renderStats(stats);
    } catch (e) {
      $('stats-body').replaceChildren(el('div', { class: 'empty' }, t('common.error', { message: e.message })));
    }
  }

  async function refreshLog() {
    if (state.paused) return;
    try {
      const data = await fetchJSON('/api/log?lines=80');
      renderLog(data.lines);
    } catch (e) {
      $('log-viewer').replaceChildren(el('div', { class: 'empty' }, t('common.error', { message: e.message })));
    }
  }

  async function doControl(action) {
    const confirmMsg = {
      stop: t('actions.stopConfirm'),
      restart: t('actions.restartConfirm'),
      enable: null,
      disable: null,
    };
    const msg = confirmMsg[action];
    if (msg && !(await confirmPopup(msg, action === 'stop'))) return;

    try {
      const r = await fetchJSON('/api/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      toast(t('actions.scheduled', { action: r.action }), 'ok');
      if (action === 'restart' || action === 'stop') {
        toast(t('actions.reconnecting'), 'warn', 6000);
        setTimeout(() => refreshAll(), 1500);
        setTimeout(() => refreshAll(), 3500);
        setTimeout(() => refreshAll(), 5500);
      } else {
        setTimeout(() => refreshAll(), 800);
      }
    } catch (e) {
      const message = t('actions.failed', { message: e.message });
      toast(message, 'err');
      await alertPopup(message);
    }
  }

  function refreshAll() {
    refreshStatus();
    refreshConfig();
    refreshStats();
    refreshLog();
  }

  function bind() {
    $('refresh-btn').addEventListener('click', refreshAll);
    $('pause-btn').addEventListener('click', () => {
      state.paused = !state.paused;
      $('pause-btn').textContent = state.paused ? t('logs.resume') : t('logs.pause');
    });
    $('clear-btn').addEventListener('click', async () => {
      if (!(await confirmPopup(t('logs.clearConfirm'), true))) return;
      try {
        const r = await fetchJSON('/api/log/clear', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        toast(t('logs.archived', { path: r.archivePath }), 'ok', 5000);
        refreshAll();
      } catch (e) {
        const message = t('logs.clearFailed', { message: e.message });
        toast(message, 'err');
        await alertPopup(message);
      }
    });
    $('log-interval-input').addEventListener('input', () => {
      if (state.logIntervalApplyTimer) clearTimeout(state.logIntervalApplyTimer);
      state.logIntervalApplyTimer = setTimeout(() => {
        applyLogIntervalFromInput();
        state.logIntervalApplyTimer = null;
      }, 1000);
    });
    $('autoscroll').addEventListener('change', e => {
      state.autoscroll = e.target.checked;
    });
    for (const btn of document.querySelectorAll('[data-action]')) {
      btn.addEventListener('click', () => doControl(btn.dataset.action));
    }
  }

  function start() {
    i18n.applyTranslations();
    i18n.bindLanguageSelect();
    bind();
    refreshAll();
    state.statusTimer = setInterval(refreshStatus, 5000);
    restartLogPolling();
    state.statsTimer = setInterval(refreshStats, 15000);
  }

  document.addEventListener('DOMContentLoaded', start);
})();
