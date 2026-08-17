import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

type BrowserI18n = {
  getLocale(): string;
  setLocale(locale: string): string;
};

function loadBrowserI18n(opts: {
  languages?: string[];
  search?: string;
  storedLocale?: string;
  storageUnavailable?: boolean;
} = {}): BrowserI18n {
  let storedLocale = opts.storedLocale ?? null;
  const languages = opts.languages ?? ["en-US"];
  const window = {
    location: {
      href: `http://127.0.0.1/${opts.search ?? ""}`,
      origin: "http://127.0.0.1",
      search: opts.search ?? "",
      assign() {},
    },
  };
  const sandbox = {
    document: {
      documentElement: { lang: "" },
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: () => {
        if (opts.storageUnavailable) throw new Error("unavailable");
        return storedLocale;
      },
      setItem: (_key: string, value: string) => {
        if (opts.storageUnavailable) throw new Error("unavailable");
        storedLocale = value;
      },
    },
    navigator: {
      language: languages[0],
      languages,
    },
    URL,
    URLSearchParams,
    window,
  };
  const source = fs.readFileSync(
    path.join(process.cwd(), "public", "i18n.js"),
    "utf8",
  );
  vm.runInNewContext(source, sandbox);
  return (window as typeof window & { CursorProxyI18n: BrowserI18n })
    .CursorProxyI18n;
}

describe("browser i18n", () => {
  it("uses the browser language preference order", () => {
    const i18n = loadBrowserI18n({ languages: ["en-US", "zh-CN"] });
    expect(i18n.getLocale()).toBe("en");
  });

  it("lets the URL override a stored locale", () => {
    const i18n = loadBrowserI18n({
      search: "?lang=zh-CN",
      storedLocale: "en",
    });
    expect(i18n.getLocale()).toBe("zh-CN");
  });

  it("keeps a language change in memory when storage is unavailable", () => {
    const i18n = loadBrowserI18n({
      languages: ["en-US"],
      storageUnavailable: true,
    });
    expect(i18n.setLocale("zh-CN")).toBe("zh-CN");
    expect(i18n.getLocale()).toBe("zh-CN");
  });
});
