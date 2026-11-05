import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeMode,
  parseThemeMode,
  readStoredThemeMode,
  storeThemeMode,
  THEME_STORAGE_KEY,
} from "./themeMode";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.head.innerHTML = "";
  delete document.documentElement.dataset.theme;
});

describe("theme mode storage", () => {
  it("parses anything but 'light' as dark", () => {
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("system")).toBe("dark");
    expect(parseThemeMode(null)).toBe("dark");
  });

  it("round-trips the saved choice", () => {
    expect(readStoredThemeMode()).toBe("dark");
    storeThemeMode("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredThemeMode()).toBe("light");
  });

  it("falls back to dark when storage throws, and does not throw on save", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredThemeMode()).toBe("dark");
    expect(() => storeThemeMode("light")).not.toThrow();
  });
});

describe("applyThemeMode", () => {
  it("sets data-theme, the theme-color meta and the manifest link", () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#121416"><link rel="manifest" href="/manifest.webmanifest">';

    applyThemeMode("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      "#ffffff",
    );
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute("href")).toBe(
      "/manifest-light.webmanifest",
    );

    applyThemeMode("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      "#121416",
    );
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute("href")).toBe(
      "/manifest.webmanifest",
    );
  });
});
