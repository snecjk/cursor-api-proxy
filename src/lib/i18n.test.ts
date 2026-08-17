import { describe, expect, it } from "vitest";

import { parseLocale, resolveLocale, t } from "./i18n.js";

describe("i18n", () => {
  it("normalizes supported locale variants", () => {
    expect(parseLocale("zh_CN.UTF-8")).toBe("zh-CN");
    expect(parseLocale("zh-TW")).toBe("zh-CN");
    expect(parseLocale("en_US.UTF-8")).toBe("en");
    expect(parseLocale("fr-FR")).toBeUndefined();
  });

  it("prefers an explicit locale over environment settings", () => {
    expect(
      resolveLocale("en", {
        CURSOR_API_PROXY_LANG: "zh-CN",
        LANG: "zh_CN.UTF-8",
      }),
    ).toBe("en");
    expect(resolveLocale(undefined, { LANG: "zh_CN.UTF-8" })).toBe("zh-CN");
    expect(
      resolveLocale(undefined, { LC_ALL: "C", LANG: "zh_CN.UTF-8" }),
    ).toBe("en");
    expect(
      resolveLocale(undefined, {
        CURSOR_API_PROXY_LANG: "fr",
        LANG: "zh_CN.UTF-8",
      }),
    ).toBe("en");
    expect(resolveLocale(undefined, {})).toBe(
      parseLocale(Intl.DateTimeFormat().resolvedOptions().locale) ?? "en",
    );
  });

  it("interpolates messages in both languages", () => {
    expect(t("requests.title", { count: 2, path: "/tmp/log" }, "en")).toBe(
      "Latest requests (2) · /tmp/log",
    );
    expect(
      t("requests.title", { count: 2, path: "/tmp/log" }, "zh-CN"),
    ).toBe("最近请求（2）· /tmp/log");
  });
});
