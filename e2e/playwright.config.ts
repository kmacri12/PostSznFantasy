import { defineConfig } from "@playwright/test";
import { iphone } from "./support/devices";
import {
  ADMIN_UID,
  API_PORT,
  API_URL,
  E2E_DATABASE_URL,
  RESEND_STUB_PORT,
  RESEND_STUB_URL,
  SUPABASE_URL,
  WEB_PORT,
  WEB_URL,
} from "./support/env";

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
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...iphone } },
    {
      name: "desktop",
      testMatch: /(smoke|support)\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: "node e2e/support/resend-stub.mjs",
      cwd: "..",
      url: `${RESEND_STUB_URL}/sent`,
      reuseExistingServer: false,
      env: { RESEND_STUB_PORT: String(RESEND_STUB_PORT) },
    },
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
        PLAYOFF_FIELD_SIZE: "8",
        ADMIN_SUPABASE_UIDS: ADMIN_UID,
        LOG_FORMAT: "console",
        RESEND_API_KEY: "re_e2e_stub",
        SUPPORT_EMAIL: "support@e2e.test",
        RESEND_API_URL: `${RESEND_STUB_URL}/emails`,
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
        // Instant MUI transitions (frontend/src/theme.ts), so no spec races an animation.
        VITE_E2E: "true",
        VITE_ADMIN_SUPABASE_UIDS: ADMIN_UID,
      },
    },
  ],
});
