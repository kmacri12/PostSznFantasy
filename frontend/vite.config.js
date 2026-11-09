var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a, _b;
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
var API_TARGET = "http://localhost:8000";
var PRODUCTION_VARS = [
    "VITE_API_URL",
    "VITE_WS_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
];
// Without these the deployed site loads but calls its own origin (Pages), so fail the build
// instead. Only enforced on Cloudflare Pages (CF_PAGES) or with REQUIRE_PRODUCTION_ENV=1, so a
// local `make check` build needs no .env.
function requireProductionEnv() {
    return {
        name: "require-production-env",
        apply: "build",
        config: function (_, _a) {
            var _b, _c;
            var mode = _a.mode;
            var enforce = process.env.CF_PAGES || process.env.REQUIRE_PRODUCTION_ENV === "1";
            if (!enforce)
                return;
            var env = __assign(__assign({}, loadEnv(mode, process.cwd(), "VITE_")), process.env);
            var missing = PRODUCTION_VARS.filter(function (name) { return !env[name]; });
            if (missing.length > 0) {
                throw new Error("Missing build variables: ".concat(missing.join(", "), ". Set them in Cloudflare Pages (docs/deploy/frontend-hosting.md)."));
            }
            if (!((_b = env.VITE_API_URL) === null || _b === void 0 ? void 0 : _b.startsWith("https://")) || !((_c = env.VITE_WS_URL) === null || _c === void 0 ? void 0 : _c.startsWith("wss://"))) {
                throw new Error("VITE_API_URL must start with https:// and VITE_WS_URL with wss://.");
            }
        },
    };
}
// Publishes the build's dormant flag as /status.json so scripts/dormancy-check.sh can read what the
// deployed site was built with (the bundle itself only inlines the value).
function statusFile() {
    return {
        name: "status-file",
        apply: "build",
        generateBundle: function () {
            var dormant = process.env.VITE_DORMANT === "true";
            this.emitFile({
                type: "asset",
                fileName: "status.json",
                source: JSON.stringify({ dormant: dormant }),
            });
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), requireProductionEnv(), statusFile()],
    define: {
        // The commit this bundle was built from (Cloudflare Pages or GitHub Actions), for support reports.
        __WEB_VERSION__: JSON.stringify((_b = (_a = process.env.CF_PAGES_COMMIT_SHA) !== null && _a !== void 0 ? _a : process.env.GITHUB_SHA) !== null && _b !== void 0 ? _b : ""),
    },
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
