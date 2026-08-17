#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadBridgeConfig } from "./lib/config.js";
import { loadEnvConfig } from "./lib/env.js";
import { setLocale, t } from "./lib/i18n.js";
import { startBridgeServer, setupGracefulShutdown } from "./lib/server.js";
import { detectLocaleArg, parseArgs, printHelp } from "./cli/args.js";
import { handleAccountsList, handleLogout } from "./cli/accounts.js";
import { handleLogin } from "./cli/login.js";
import { handleRequests } from "./cli/requests.js";
import { handleResetHwid } from "./cli/reset-hwid.js";

// Re-export argument helpers so src/cli.test.ts can import them.
export { detectLocaleArg, parseArgs } from "./cli/args.js";

// ---------------------------------------------------------------------------
// Package metadata
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
  version: string;
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  setLocale(detectLocaleArg(argv));
  const args = parseArgs(argv);
  const locale = setLocale(args.language);

  if (args.help) {
    printHelp(pkg.version, locale);
    return;
  }

  if (args.requests) {
    const env = loadEnvConfig({ env: process.env });
    await handleRequests({
      logPath: env.sessionsLogPath,
      limit: args.requestLimit,
      watch: args.watch,
      intervalMs: args.watchIntervalMs,
      locale,
    });
    return;
  }

  if (args.login) {
    await handleLogin(args.accountName, args.proxies);
    return;
  }

  if (args.logout) {
    await handleLogout(args.accountName);
    return;
  }

  if (args.accountsList) {
    await handleAccountsList();
    return;
  }

  if (args.resetHwid) {
    await handleResetHwid({ deepClean: args.deepClean, dryRun: args.dryRun });
    return;
  }

  const mergedEnv = args.verbose
    ? { ...process.env, CURSOR_BRIDGE_VERBOSE: "true" }
    : process.env;
  const config = loadBridgeConfig({
    tailscale: args.tailscale,
    env: mergedEnv,
    mode: args.mode,
  });
  const servers = startBridgeServer({ version: pkg.version, config });
  setupGracefulShutdown(servers);
}

const realArgv1 = process.argv[1] ? fs.realpathSync(process.argv[1]) : "";
const isMainModule = realArgv1 === fs.realpathSync(__filename);

if (isMainModule) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(t("error.generic", { message: msg }));
    process.exit(1);
  });
}
