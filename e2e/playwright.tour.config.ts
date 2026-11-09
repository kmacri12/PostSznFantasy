import path from "node:path";
import { defineConfig } from "@playwright/test";
import { iphone } from "./support/devices";
import {
  E2E_LIVE_DATABASE_URL,
  LIVE_API_PORT,
  LIVE_API_URL,
  LIVE_WEB_PORT,
  LIVE_WEB_URL,
  SUPABASE_URL,
} from "./support/env";

process.env.E2E_API_URL = LIVE_API_URL;

// Virtual seconds per real second. The fixture games are spaced six virtual hours apart,
// so at this speed a game takes ~6s and the next one starts ~4.5s after it ends.
const REPLAY_SPEED = 2000;
const REPLAY_FILE =
  process.env.TOUR_REPLAY_FILE ?? path.resolve(import.meta.dirname, "fixtures/replay.json");

// Replay mode: the real poll, scoring and elimination code runs against saved box scores,
// with no RapidAPI calls. The API process starts the replay clock, so it is started fresh.
export default defineConfig({
  testDir: "./tour",
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 240_000,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-tour" }]]
    : "list",
  outputDir: "test-results-tour",
  use: {
    baseURL: LIVE_WEB_URL,
    timezoneId: "UTC",
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: { ...iphone } }],
  webServer: [
    {
      command:
        "cd frontend && npx vite build --outDir ../e2e/.web-dist-live --emptyOutDir" +
        ` && npx vite preview --outDir ../e2e/.web-dist-live --port ${LIVE_WEB_PORT} --strictPort`,
      cwd: "..",
      url: LIVE_WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: LIVE_API_URL,
        VITE_WS_URL: `ws://localhost:${LIVE_API_PORT}`,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
        // Instant MUI transitions (frontend/src/theme.ts), so no spec races an animation.
        VITE_E2E: "true",
      },
    },
    {
      // Waits for the web build, then seeds and starts the API last, so the replay clock
      // begins right before the tests do rather than during the build.
      command:
        `until curl -sf ${LIVE_WEB_URL} > /dev/null; do sleep 0.2; done` +
        " && uv run --project api python -m api.scripts.seed_e2e" +
        " && PYTHONPATH=. uv run --project api python e2e/tour/real_names.py" +
        ` && uv run --project api uvicorn api.main:app --port ${LIVE_API_PORT}`,
      cwd: "..",
      url: `${LIVE_API_URL}/api`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        PG_URI: E2E_LIVE_DATABASE_URL,
        SUPABASE_URL,
        CORS_ORIGINS: LIVE_WEB_URL,
        ENVIRONMENT: "test",
        TEST_AUTH_STUB: "true",
        PLAYOFF_FIELD_SIZE: "8",
        LOG_FORMAT: "console",
        SCHEDULER_ENABLED: "true",
        SCHEDULER_REPLAY_FILE: REPLAY_FILE,
        SCHEDULER_REPLAY_SPEED: String(REPLAY_SPEED),
      },
    },
  ],
});
