import fs from "node:fs";
import path from "node:path";

import { getLocale, t, type AppLocale } from "../lib/i18n.js";
import { ACCOUNTS_DIR } from "./constants.js";
import {
  readCachedToken,
  readKeychainToken,
  tokenSub,
  fetchAccountUsage,
  fetchStripeProfile,
  formatUsageSummary,
  describePlan,
} from "./usage.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountInfo {
  name: string;
  configDir: string;
  authenticated: boolean;
  email?: string;
  displayName?: string;
  authId?: string;
  plan?: string;
  subscriptionStatus?: string;
  expiresAt?: string;
}

function displayPlan(plan: string, locale: AppLocale): string {
  switch (plan) {
    case "Enterprise":
      return t("accounts.plan.enterprise", {}, locale);
    case "Free":
      return t("accounts.plan.free", {}, locale);
    default:
      return plan;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads authentication and plan metadata from a saved account directory.
 * Never throws — returns `authenticated: false` on any read/parse error.
 */
export function readAccountInfo(
  name: string,
  configDir: string,
  locale: AppLocale = getLocale(),
): AccountInfo {
  const info: AccountInfo = { name, configDir, authenticated: false };

  const configFile = path.join(configDir, "cli-config.json");
  if (!fs.existsSync(configFile)) return info;

  try {
    const raw = JSON.parse(fs.readFileSync(configFile, "utf-8")) as {
      authInfo?: { email?: string; displayName?: string; authId?: string };
    };
    if (raw.authInfo) {
      info.authenticated = true;
      info.email = raw.authInfo.email;
      info.displayName = raw.authInfo.displayName;
      info.authId = raw.authInfo.authId;
    }
  } catch {
    // malformed config — treat as unauthenticated
  }

  const statsigFile = path.join(configDir, "statsig-cache.json");
  if (!fs.existsSync(statsigFile)) return info;

  try {
    const statsigRaw = JSON.parse(fs.readFileSync(statsigFile, "utf-8")) as {
      data?: string;
    };
    if (!statsigRaw.data) return info;

    const statsig = JSON.parse(statsigRaw.data) as {
      user?: {
        custom?: {
          isEnterpriseUser?: boolean;
          stripeSubscriptionStatus?: string;
          stripeMembershipStatus?: string;
          stripeMembershipExpiration?: string;
        };
      };
    };

    const custom = statsig?.user?.custom;
    if (!custom) return info;

    if (custom.isEnterpriseUser) {
      info.plan = "Enterprise";
    } else if (custom.stripeSubscriptionStatus === "active") {
      info.plan = "Pro";
    } else {
      info.plan = "Free";
    }

    info.subscriptionStatus = custom.stripeSubscriptionStatus;

    if (custom.stripeMembershipExpiration) {
      info.expiresAt = new Date(
        custom.stripeMembershipExpiration,
      ).toLocaleDateString(locale);
    }
  } catch {
    // malformed statsig cache — skip plan info
  }

  return info;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function handleAccountsList(): Promise<void> {
  const locale = getLocale();
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    console.log(t("accounts.none", {}, locale));
    return;
  }

  const entries = fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true });
  const names = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (names.length === 0) {
    console.log(t("accounts.none", {}, locale));
    return;
  }

  console.log(`🔑 ${t("accounts.title", {}, locale)}\n`);

  // Try to find an available token (per-account cache first, shared keychain fallback)
  const keychainToken = readKeychainToken();

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const configDir = path.join(ACCOUNTS_DIR, name);
    const info = readAccountInfo(name, configDir, locale);

    console.log(`  ${i + 1}. ${name}`);

    if (info.authenticated) {
      // Per-account cached token wins. Fall back to keychain ONLY if its JWT
      // sub matches this account's authId (prevents showing another account's data).
      const cachedToken = readCachedToken(configDir);
      const keychainMatchesAccount =
        !!keychainToken &&
        !!info.authId &&
        tokenSub(keychainToken) === info.authId;
      const token =
        cachedToken ?? (keychainMatchesAccount ? keychainToken : undefined);

      // Fetch live data before printing so we can decide what to show
      let liveProfile: Awaited<ReturnType<typeof fetchStripeProfile>> = null;
      let liveUsage: Awaited<ReturnType<typeof fetchAccountUsage>> = null;
      if (token) {
        try {
          [liveUsage, liveProfile] = await Promise.all([
            fetchAccountUsage(token),
            fetchStripeProfile(token),
          ]);
        } catch {
          /* ignore transient fetch errors */
        }
      }

      if (info.email) {
        const display = info.displayName ? ` (${info.displayName})` : "";
        console.log(`     📧 ${info.email}${display}`);
      }
      // Show static plan only when live data isn't available (avoids contradictions)
      if (info.plan && !liveProfile) {
        const canceled =
          info.subscriptionStatus === "canceled"
            ? ` · ${t("accounts.canceled", {}, locale)}`
            : "";
        const expiry = info.expiresAt
          ? ` · ${t("accounts.expires", { date: info.expiresAt }, locale)}`
          : "";
        const plan = displayPlan(info.plan, locale);
        console.log(`     📊 ${plan}${canceled}${expiry}`);
      }
      console.log(`     ✅ ${t("accounts.authenticated", {}, locale)}`);

      if (liveProfile) {
        console.log(`     💳 ${describePlan(liveProfile, locale)}`);
      }
      if (liveUsage) {
        for (const line of formatUsageSummary(liveUsage, locale)) {
          console.log(line);
        }
      }
    } else {
      console.log(`     ⚠️  ${t("accounts.notAuthenticated", {}, locale)}`);
    }

    console.log("");
  }

  console.log(t("accounts.tip", {}, locale));
}

export async function handleLogout(accountName: string): Promise<void> {
  if (!accountName) {
    console.error(`❌ ${t("accounts.nameRequired")}`);
    console.error(t("accounts.logoutUsage"));
    process.exit(1);
  }

  const configDir = path.join(ACCOUNTS_DIR, accountName);

  if (!fs.existsSync(configDir)) {
    console.error(`❌ ${t("accounts.notFound", { name: accountName })}`);
    process.exit(1);
  }

  try {
    fs.rmSync(configDir, { recursive: true, force: true });
    console.log(`✅ ${t("accounts.removed", { name: accountName })}`);
  } catch (err) {
    console.error(`❌ ${t("accounts.removeFailed")}`, err);
    process.exit(1);
  }
}
