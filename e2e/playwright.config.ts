import { defineConfig } from "@playwright/test";
import {
  API_PORT,
  API_URL,
  E2E_DATABASE_URL,
  SUPABASE_URL,
  WEB_PORT,
  WEB_URL,
} from "./support/env";

// iPhone-sized touch viewport on Chromium: the app is used mostly on phones, and WebKit
// adds an install step without covering anything Chromium does not at this size.
const iphone = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    timezoneId: "UTC",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...iphone } },
    {
      name: "desktop",
      testMatch: /smoke\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      // Rebuilds the throwaway database on every start, so reuse would hide stale data.
      command:
        "uv run --project api python -m api.scripts.seed_e2e" +
        ` && uv run --project api uvicorn api.main:app --port ${API_PORT}`,
      cwd: "..",
      url: `${API_URL}/api`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        PG_URI: E2E_DATABASE_URL,
        SUPABASE_URL,
        CORS_ORIGINS: WEB_URL,
        ENVIRONMENT: "test",
        TEST_AUTH_STUB: "true",
        LOG_FORMAT: "console",
      },
    },
    {
      // A production build served by `vite preview`: no file watchers, and the bundle is what ships.
      command:
        "cd frontend && npx vite build --outDir ../e2e/.web-dist --emptyOutDir" +
        ` && npx vite preview --outDir ../e2e/.web-dist --port ${WEB_PORT} --strictPort`,
      cwd: "..",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: API_URL,
        VITE_WS_URL: `ws://localhost:${API_PORT}`,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
      },
    },
  ],
});
