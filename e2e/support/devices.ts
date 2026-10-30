// iPhone-sized touch viewport on Chromium: the app is used mostly on phones, and WebKit
// adds an install step without covering anything Chromium does not at this size.
export const iphone = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};
