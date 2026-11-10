import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "./inAppBrowser";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("isInAppBrowser", () => {
  it("is false for the real browsers", () => {
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
  });

  it("recognises Instagram, Facebook and Android web views", () => {
    expect(isInAppBrowser(`${IPHONE_SAFARI} Instagram 350.0.0`)).toBe(true);
    expect(isInAppBrowser(`${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/450.0]`)).toBe(true);
    expect(isInAppBrowser(ANDROID_CHROME.replace("Android 14;", "Android 14; wv)"))).toBe(true);
  });
});
