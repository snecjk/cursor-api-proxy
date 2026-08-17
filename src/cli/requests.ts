import {
  readLastLines,
  recentSessionRequests,
  type SessionRequest,
} from "../lib/session-log.js";
import {
  getLocale,
  resolveLocale,
  t,
  type AppLocale,
} from "../lib/i18n.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

export type RequestsOutput = {
  write(chunk: string): unknown;
  columns?: number;
  isTTY?: boolean;
};

export type FormatRequestsOptions = {
  logPath: string;
  width?: number;
  color?: boolean;
  locale?: AppLocale;
};

export type HandleRequestsOptions = {
  logPath: string;
  limit: number;
  watch: boolean;
  intervalMs: number;
  output?: RequestsOutput;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  locale?: AppLocale;
};

function characterWidth(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  if (code === 0 || code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (/\p{Mark}/u.test(character)) return 0;
  return code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6))
    ? 2
    : 1;
}

function displayWidth(value: string): number {
  return Array.from(value).reduce(
    (width, character) => width + characterWidth(character),
    0,
  );
}

function truncate(value: string, width: number): string {
  if (displayWidth(value) <= width) return value;
  if (width <= 1) return width === 1 ? "…" : "";
  let result = "";
  let used = 0;
  for (const character of value) {
    const next = characterWidth(character);
    if (used + next > width - 1) break;
    result += character;
    used += next;
  }
  return `${result}…`;
}

function pad(value: string, width: number): string {
  const truncated = truncate(value, width);
  return truncated + " ".repeat(Math.max(0, width - displayWidth(truncated)));
}

function localTimestamp(value: string): string {
  const date = new Date(value);
  const two = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    two(date.getMonth() + 1),
    "-",
    two(date.getDate()),
    " ",
    two(date.getHours()),
    ":",
    two(date.getMinutes()),
    ":",
    two(date.getSeconds()),
  ].join("");
}

function paint(value: string, code: string, enabled: boolean): string {
  return enabled ? `${code}${value}${ANSI.reset}` : value;
}

function statusColor(status: number): string {
  if (status >= 500) return ANSI.red;
  if (status >= 400) return ANSI.yellow;
  return ANSI.green;
}

export function formatRequests(
  requests: SessionRequest[],
  opts: FormatRequestsOptions,
): string {
  const width = Math.max(50, opts.width ?? 100);
  const color = opts.color ?? false;
  const locale = opts.locale ?? getLocale();
  const compact = width < 80;
  const whenWidth = compact ? 8 : 19;
  const methodWidth = compact ? 6 : 7;
  const statusWidth = compact ? 3 : 6;
  const remoteWidth = compact ? 10 : 20;
  const separators = 8;
  const fixedWidth =
    whenWidth + methodWidth + statusWidth + remoteWidth + separators;
  const pathWidth = Math.max(12, width - fixedWidth);
  const title = truncate(
    t(
      "requests.title",
      { count: requests.length, path: opts.logPath },
      locale,
    ),
    width,
  );

  if (requests.length === 0) {
    return [
      paint(title, ANSI.bold, color),
      paint(t("requests.none", {}, locale), ANSI.dim, color),
    ].join("\n");
  }

  const columns = [
    pad(t("requests.when", {}, locale), whenWidth),
    pad(t("requests.method", {}, locale), methodWidth),
    pad(t("requests.status", {}, locale), statusWidth),
    pad(t("requests.from", {}, locale), remoteWidth),
    pad(t("requests.path", {}, locale), pathWidth),
  ];
  const lines = [
    paint(title, ANSI.bold, color),
    paint(columns.join("  "), ANSI.dim, color),
    paint("─".repeat(width), ANSI.dim, color),
  ];

  for (const request of requests) {
    const timestamp = localTimestamp(request.ts);
    const method = pad(request.method, methodWidth);
    const status = pad(String(request.status), statusWidth);
    const row = [
      pad(compact ? timestamp.slice(11) : timestamp, whenWidth),
      paint(method, ANSI.cyan, color),
      paint(status, statusColor(request.status), color),
      pad(request.remoteAddress, remoteWidth),
      pad(request.pathname, pathWidth),
    ];
    lines.push(row.join("  "));
  }

  return lines.join("\n");
}

export function readRecentRequests(
  logPath: string,
  limit: number,
): Promise<SessionRequest[]> {
  const linesToRead = Math.min(20_000, Math.max(100, limit * 4));
  return new Promise((resolve, reject) => {
    readLastLines(logPath, linesToRead, (err, lines) => {
      if (err) reject(err);
      else resolve(recentSessionRequests(lines, limit));
    });
  });
}

export async function handleRequests(
  opts: HandleRequestsOptions,
): Promise<void> {
  const output = opts.output ?? process.stdout;
  const env = opts.env ?? process.env;
  const color = Boolean(output.isTTY) && env.NO_COLOR === undefined;
  const locale = opts.locale ?? resolveLocale(undefined, env);
  const render = async (redraw: boolean): Promise<void> => {
    const requests = await readRecentRequests(opts.logPath, opts.limit);
    const formatted = formatRequests(requests, {
      logPath: opts.logPath,
      width: output.columns,
      color,
      locale,
    });
    if (redraw && output.isTTY) output.write("\x1b[2J\x1b[H");
    output.write(`${formatted}\n`);
  };

  await render(false);
  if (!opts.watch) return;

  await new Promise<void>((resolve, reject) => {
    let rendering = false;
    let stopped = false;
    const removeStopListener = () => {
      if (opts.signal) opts.signal.removeEventListener("abort", stop);
      else process.off("SIGINT", stop);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      removeStopListener();
      if (output.isTTY) output.write("\n");
      resolve();
    };
    const timer = setInterval(() => {
      if (rendering || stopped) return;
      rendering = true;
      render(true)
        .catch((err) => {
          clearInterval(timer);
          removeStopListener();
          reject(err);
        })
        .finally(() => {
          rendering = false;
        });
    }, opts.intervalMs);

    if (opts.signal) {
      if (opts.signal.aborted) stop();
      else opts.signal.addEventListener("abort", stop, { once: true });
    } else {
      process.once("SIGINT", stop);
    }
  });
}
