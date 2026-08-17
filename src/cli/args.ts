import type { CursorExecutionMode } from "../lib/execution-mode.js";
import { parseExecutionModeFromRequest } from "../lib/execution-mode.js";
import {
  getLocale,
  parseLocale,
  t,
  type AppLocale,
  type MessageKey,
} from "../lib/i18n.js";

export type ParsedArgs = {
  tailscale: boolean;
  verbose: boolean;
  help: boolean;
  requests: boolean;
  requestLimit: number;
  watch: boolean;
  watchIntervalMs: number;
  login: boolean;
  accountsList: boolean;
  logout: boolean;
  accountName: string;
  proxies: string[];
  resetHwid: boolean;
  deepClean: boolean;
  dryRun: boolean;
  language?: AppLocale;
  /** Set via `--mode`; default applied in config when omitted. */
  mode?: CursorExecutionMode;
};

export function detectLocaleArg(argv: string[]): AppLocale | undefined {
  let locale: AppLocale | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--lang") {
      const value = argv[i + 1];
      if (value && !value.startsWith("-")) {
        locale = parseLocale(value) ?? locale;
        i++;
      }
    } else if (arg.startsWith("--lang=")) {
      locale = parseLocale(arg.slice("--lang=".length)) ?? locale;
    }
  }
  return locale;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let tailscale = false;
  let verbose = false;
  let help = false;
  let requests = false;
  let requestLimit = 20;
  let watch = false;
  let watchIntervalMs = 2000;
  let requestOptionUsed = false;
  let login = false;
  let accountsList = false;
  let logout = false;
  let accountName = "";
  let proxies: string[] = [];
  let resetHwid = false;
  let deepClean = false;
  let dryRun = false;
  let language = detectLocaleArg(argv);
  let mode: CursorExecutionMode | undefined;
  const tr = (
    key: MessageKey,
    values: Record<string, string | number> = {},
  ): string => t(key, values, language ?? getLocale());

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "requests") {
      requests = true;
      continue;
    }

    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const value = arg === "--limit" ? argv[++i] : arg.slice("--limit=".length);
      if (!value || value.startsWith("-")) {
        throw new Error(tr("parse.limitRequires"));
      }
      requestLimit = Number(value);
      if (
        !Number.isInteger(requestLimit) ||
        requestLimit < 1 ||
        requestLimit > 5000
      ) {
        throw new Error(tr("parse.limitRange"));
      }
      requestOptionUsed = true;
      continue;
    }

    if (arg === "--watch") {
      watch = true;
      requestOptionUsed = true;
      continue;
    }

    if (arg === "--interval" || arg.startsWith("--interval=")) {
      const value =
        arg === "--interval" ? argv[++i] : arg.slice("--interval=".length);
      if (!value || value.startsWith("-")) {
        throw new Error(tr("parse.intervalRange"));
      }
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds < 0.001 || seconds > 86_400) {
        throw new Error(tr("parse.intervalRange"));
      }
      watchIntervalMs = Math.round(seconds * 1000);
      requestOptionUsed = true;
      continue;
    }

    if (arg === "login" || arg === "add-account") {
      login = true;
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        accountName = argv[++i];
      }
      continue;
    }

    if (arg === "logout" || arg === "remove-account") {
      logout = true;
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        accountName = argv[++i];
      }
      continue;
    }

    if (arg === "accounts" || arg === "list-accounts") {
      accountsList = true;
      continue;
    }

    if (arg === "reset-hwid" || arg === "reset") {
      resetHwid = true;
      continue;
    }

    if (arg === "--deep-clean") {
      deepClean = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--tailscale") {
      tailscale = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--mode") {
      if (i + 1 >= argv.length || argv[i + 1]!.startsWith("-")) {
        throw new Error(tr("parse.modeRequires"));
      }
      const value = argv[++i]!;
      try {
        mode = parseExecutionModeFromRequest(value, "--mode");
      } catch {
        throw new Error(tr("parse.modeInvalid", { mode: value }));
      }
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      try {
        mode = parseExecutionModeFromRequest(value, "--mode");
      } catch {
        throw new Error(tr("parse.modeInvalid", { mode: value }));
      }
      continue;
    }

    if (arg === "--lang" || arg.startsWith("--lang=")) {
      const value = arg === "--lang" ? argv[++i] : arg.slice("--lang=".length);
      if (!value || value.startsWith("-")) {
        throw new Error(tr("parse.languageRequires"));
      }
      const parsed = parseLocale(value);
      if (!parsed) {
        throw new Error(tr("parse.languageInvalid", { language: value }));
      }
      language = parsed;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg.startsWith("--proxy=")) {
      proxies = arg
        .slice("--proxy=".length)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      continue;
    }

    throw new Error(tr("parse.unknown", { argument: arg }));
  }

  if (requestOptionUsed && !requests) {
    throw new Error(tr("parse.requestOptions"));
  }

  return {
    tailscale,
    verbose,
    help,
    requests,
    requestLimit,
    watch,
    watchIntervalMs,
    login,
    accountsList,
    logout,
    accountName,
    proxies,
    resetHwid,
    deepClean,
    dryRun,
    language,
    mode,
  };
}

export function printHelp(
  version: string,
  locale: AppLocale = getLocale(),
): void {
  console.log(`cursor-api-proxy v${version}`);
  console.log("");
  console.log(t("help.body", {}, locale));
}
