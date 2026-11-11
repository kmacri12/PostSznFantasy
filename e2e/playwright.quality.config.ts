import { defineConfig } from "@playwright/test";
import {
  ADMIN_UID,
  API_PORT,
  API_URL,
  AVATAR_DIR,
  E2E_DATABASE_URL,
  RESEND_STUB_PORT,
  RESEND_STUB_URL,
  SUPABASE_URL,
  WEB_PORT,
  WEB_URL,
} from "./support/env";

// Nightly quality suite (.github/workflows/quality-nightly.yml): screenshots of the key
// pages and an axe scan of each, in Dark and Light on four device sizes, then the Lighthouse budget. Same stack as the
// main suite. Baselines are committed under quality/__screenshots__ (see CONTRIBUTING.md).
export default defineConfig({
  testDir: "./quality",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-quality" }]]
    : "list",
  outputDir: "test-results-quality",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: WEB_URL,
    timezoneId: "UTC",
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-se",
      testMatch: /pages\.spec\.ts/,
      use: {
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "small-android",
      testMatch: /pages\.spec\.ts/,
      use: {
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "ipad",
      testMatch: /pages\.spec\.ts/,
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      testMatch: /pages\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
    // Lighthouse drives its own mobile emulation; the project only runs the one spec.
    { name: "lighthouse", testMatch: /lighthouse\.spec\.ts/ },
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
        // Pictures stay on disk here instead of Supabase Storage (refused in production).
        AVATAR_LOCAL_DIR: AVATAR_DIR,
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
