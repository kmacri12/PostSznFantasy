/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = "http://localhost:8000";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
