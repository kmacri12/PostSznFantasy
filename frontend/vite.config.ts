/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const API_TARGET = "http://localhost:8000";

const PRODUCTION_VARS = [
  "VITE_API_URL",
  "VITE_WS_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

// Without these the deployed site loads but calls its own origin (Pages), so fail the build
// instead. Only enforced on Cloudflare Pages (CF_PAGES) or with REQUIRE_PRODUCTION_ENV=1, so a
// local `make check` build needs no .env.
function requireProductionEnv(): Plugin {
  return {
    name: "require-production-env",
    apply: "build",
    config(_, { mode }) {
      const enforce = process.env.CF_PAGES || process.env.REQUIRE_PRODUCTION_ENV === "1";
      if (!enforce) return;
      const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
      const missing = PRODUCTION_VARS.filter((name) => !env[name]);
      if (missing.length > 0) {
        throw new Error(
          `Missing build variables: ${missing.join(", ")}. Set them in Cloudflare Pages (docs/deploy/frontend-hosting.md).`,
        );
      }
      if (!env.VITE_API_URL?.startsWith("https://") || !env.VITE_WS_URL?.startsWith("wss://")) {
        throw new Error("VITE_API_URL must start with https:// and VITE_WS_URL with wss://.");
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), requireProductionEnv()],
  server: {
    // Same-origin /api (including the draft WebSocket) so VITE_API_URL, VITE_WS_URL and
    // CORS are optional in local development.
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor groups keep libraries that change on different schedules in separate files, so a
        // deploy that only touches app code leaves every vendor chunk cached. A group also pulls
        // in its own dependencies, so react must come first or MUI and Sentry would swallow it
        // (and Sentry would then become a static, eagerly loaded import of every chunk).
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|react-is)[\\/]/,
            },
            { name: "sentry", test: /node_modules[\\/]@sentry/ },
            { name: "mui", test: /node_modules[\\/](@mui|@emotion|@popperjs)[\\/]/ },
            { name: "tanstack", test: /node_modules[\\/]@tanstack/ },
            { name: "supabase", test: /node_modules[\\/]@supabase/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
