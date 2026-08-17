import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";

import type { BridgeConfig } from "./config.js";
import { t } from "./i18n.js";
import { createRequestListener } from "./request-listener.js";
import { initAccountPool } from "./account-pool.js";
import { killAllChildProcesses } from "./process.js";

function acpLauncherLabel(acpArgs: string[]): string {
  const first = acpArgs[0];
  if (first && /\.[cm]?js$/i.test(first)) return "node + script";
  return "cmd";
}

export type BridgeServerOptions = {
  version: string;
  config: BridgeConfig;
};

export function startBridgeServer(
  opts: BridgeServerOptions,
): (http.Server | https.Server)[] {
  const { config } = opts;
  const servers: (http.Server | https.Server)[] = [];

  if (config.configDirs && config.configDirs.length > 0) {
    if (config.multiPort) {
      // In multi-port mode, we don't need a central pool. We spawn a server for each configDir
      config.configDirs.forEach((dir, index) => {
        const port = config.port + index;
        const serverOpts = {
          ...opts,
          config: {
            ...config,
            port,
            configDirs: [dir], // each server gets only one configDir
            multiPort: false, // Disable multi-port for child servers to prevent recursion
          },
        };
        const server = startSingleServer(serverOpts);
        servers.push(server);
      });
      return servers;
    } else {
      initAccountPool(config.configDirs);
    }
  }

  servers.push(startSingleServer(opts));
  return servers;
}

/**
 * Register SIGTERM / SIGINT handlers for graceful shutdown.
 * Closes all HTTP(S) servers, kills in-flight agent processes, then exits.
 */
export function setupGracefulShutdown(
  servers: (http.Server | https.Server)[],
  timeoutMs = 10_000,
): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(
      `\n[${new Date().toISOString()}] ${t("server.shutdown", { signal })}`,
    );

    // Stop accepting new connections and kill all in-flight agent processes
    killAllChildProcesses();

    const closePromises = servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          // closeAllConnections available since Node 18.2
          if (typeof (s as any).closeAllConnections === "function") {
            (s as any).closeAllConnections();
          }
          s.close(() => resolve());
        }),
    );

    const forceExit = setTimeout(() => {
      console.error(t("server.shutdownTimeout"));
      process.exit(1);
    }, timeoutMs).unref();

    Promise.all(closePromises).then(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

function startSingleServer(
  opts: BridgeServerOptions,
): http.Server | https.Server {
  const { config } = opts;

  const requestListener = createRequestListener(opts);

  const useTls = Boolean(config.tlsCertPath && config.tlsKeyPath);
  let server: http.Server | https.Server;

  if (useTls) {
    const cert = fs.readFileSync(config.tlsCertPath!, "utf8");
    const key = fs.readFileSync(config.tlsKeyPath!, "utf8");
    server = https.createServer({ cert, key }, requestListener);
  } else {
    server = http.createServer(requestListener);
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\u274c ${t("server.portInUse", { port: config.port })}`,
      );
    } else {
      console.error(`\u274c ${t("server.error")}`, err.message);
    }
    process.exit(1);
  });

  server.listen(config.port, config.host, () => {
    const scheme = useTls ? "https" : "http";
    const yes = t("common.yes");
    const no = t("common.no");
    const acpDetails = config.useAcp
      ? ` (${t("server.launcher")}: ${acpLauncherLabel(config.acpArgs)})`
      : "";
    console.log(t("server.listening", {
      url: `${scheme}://${config.host}:${config.port}`,
    }));
    console.log(`- ${t("server.agentBin")}: ${config.agentBin}`);
    console.log(`- ACP: ${config.useAcp ? yes : no}${acpDetails}`);
    console.log(`- ${t("server.workspace")}: ${config.workspace}`);
    console.log(`- ${t("server.mode")}: ${config.mode}`);
    console.log(`- ${t("server.defaultModel")}: ${config.defaultModel}`);
    console.log(`- ${t("server.force")}: ${config.force ? yes : no}`);
    console.log(`- ${t("server.approveMcps")}: ${config.approveMcps ? yes : no}`);
    console.log(`- ${t("server.requiredKey")}: ${config.requiredKey ? yes : no}`);
    console.log(`- ${t("server.sessionsLog")}: ${config.sessionsLogPath}`);
    console.log(
      `- ${t("server.chatOnlyWorkspace")}: ${config.chatOnlyWorkspace ? `${yes} (${t("common.isolatedTemp")})` : no}`,
    );
    console.log(
      `- ${t("server.verboseTraffic")}: ${config.verbose ? `${yes} (CURSOR_BRIDGE_VERBOSE=true)` : no}`,
    );
    console.log(
      `- ${t("server.maxMode")}: ${config.maxMode ? `${yes} (CURSOR_BRIDGE_MAX_MODE=true)` : no}`,
    );
    console.log(
      `- ${t("server.windowsBudget")}: ${config.winCmdlineMax} (${t("server.windowsBudgetHint")})`,
    );
    if (config.configDirs && config.configDirs.length > 0) {
      console.log(`- ${t("server.accountPool", {
        count: config.configDirs.length,
      })}`);
    }
  });

  return server;
}
