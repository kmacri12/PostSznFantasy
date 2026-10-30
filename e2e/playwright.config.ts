import { defineConfig } from "@playwright/test";

const API_PORT = 8100;
const WEB_PORT = 5273;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/postszn_e2e";

export const WEB_URL = `http://localhost:${WEB_PORT}`;

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
      command: `uv run --project ../api uvicorn api.main:app --app-dir .. --port ${API_PORT}`,
      url: `http://localhost:${API_PORT}/api/config`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PG_URI: E2E_DATABASE_URL,
        SUPABASE_URL: "http://localhost:54321",
        CORS_ORIGINS: WEB_URL,
        LOG_FORMAT: "console",
      },
    },
    {
      command: `npm run dev --prefix ../frontend -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
        VITE_WS_URL: `ws://localhost:${API_PORT}`,
        VITE_SUPABASE_URL: "http://localhost:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
      },
    },
  ],
});
