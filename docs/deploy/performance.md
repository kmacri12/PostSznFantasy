# Performance pass (issue #94)

Measured on a dev machine against the **built** app (`vite build` + `vite preview`), 2026-10-30, with other processes running, so treat single Lighthouse numbers as noisy (see the spread below). Real-device and Cloudflare CDN numbers have not been measured; run the pass again against the first deploy.

## Bundle

Initial JS = the entry script plus its `modulepreload` links in `dist/index.html` (what the landing page downloads before it can render). Sentry is a separate lazy chunk (`sentry-*.js`, ~450 kB raw / 150 kB gzip). It is built only when `VITE_SENTRY_DSN` is set, and it must **not** appear in `index.html`'s preloads (check after touching `vite.config.ts` or `utils/sentry.ts`: `VITE_SENTRY_DSN=https://k@o1.ingest.sentry.io/1 npm run build && grep sentry dist/index.html` prints nothing).

| Initial JS (landing) | Raw | Gzip |
| :-- | --: | --: |
| Before | 903,191 B | 271,428 B |
| After | 903,118 B | 271,194 B |

The initial total did not change: every initial chunk is needed to render and sign in. The change is in how it is cut up, which decides what a returning visitor re-downloads after a deploy:

| Chunk | Before (raw / gzip) | After (raw / gzip) | Contents |
| :-- | --: | --: | :-- |
| `mui` | 533.5 kB / 165.2 kB | 390.7 kB / 119.2 kB | MUI, Emotion, Popper |
| `react` | 39.0 kB / 14.0 kB | 181.7 kB / 59.6 kB | react, react-dom, scheduler, react-router |
| `supabase` | 214.4 kB / 55.2 kB | unchanged here (99.5 kB / 23.0 kB after #133) | supabase-js (auth, realtime, storage, postgrest); auth-js only after #133 |
| `queries` | 63.3 kB / 23.0 kB | unchanged | axios + API query hooks |
| `tanstack` | 34.9 kB / 10.2 kB | unchanged | react-query |
| entry `index` | 16.9 kB / 6.5 kB | unchanged | app shell |
| dnd-kit (`core.esm`) | 36.4 kB / 12.0 kB | unchanged | lazy, draft and team pages only |

Route pages were already `React.lazy` (all pages are 0.3 to 18 kB; `DraftPage` is the largest). `@mui/icons-material` is imported by path (`@mui/icons-material/Edit`), never the barrel, and MUI by named import from `@mui/material`, so tree shaking works.

What was wrong: the old `manualChunks` put react-dom, scheduler and react-is into the `mui` chunk (rolldown pulls a group's dependencies into it), so a MUI upgrade invalidated React too. `vite.config.ts` now uses `codeSplitting.groups` with **react first**; a group also absorbs its own dependencies, so the order matters. With Sentry listed first, the React core module landed in the Sentry chunk and made Sentry an eager import of every page (initial JS +450 kB when a DSN is set).

Heaviest modules (pre-minification): `@mui/material` 556 kB, react-dom 180 kB, supabase `auth-js` 170 kB, axios 118 kB, react-router 92 kB, `@mui/system` 88 kB, `@dnd-kit/core` 73 kB (lazy), `query-core` 62 kB, supabase `realtime-js` 54 kB, popper 49 kB, supabase `storage-js` 41 kB, `postgrest-js` 30 kB.

### Supabase client slimmed to auth-js (issue #133)

The app only uses `supabase.auth`, so `utils/supabase.ts` builds an `AuthClient` from `@supabase/auth-js` directly instead of `createClient` from `@supabase/supabase-js`, which also bundled realtime, storage and postgrest. The session is stored under the fixed key `postszn-auth` (supabase-js derived `sb-<project-host-label>-auth-token`; `e2e/support/env.ts` mirrors it).

| Initial JS (landing) | Raw | Gzip |
| :-- | --: | --: |
| Before | 908,021 B | 273,076 B |
| After | 793,171 B | 241,275 B |

The `supabase` chunk went from 214.4 kB / 55.2 kB to 99.5 kB / 23.0 kB (gzip), so the saving is about 32 kB gzip, not the 40 kB estimated before measuring: auth-js itself is the bulk of what is left.

### Re-running the analysis

```bash
cd frontend && npm run build              # per-chunk raw and gzip in the log
npx vite-bundle-visualizer -t treemap -o /tmp/stats.html   # module-level treemap, not a dependency
```

## Lighthouse (mobile preset, default simulated throttling)

Lighthouse 13 on Playwright's Chromium, `vite preview` serving the production build, the API from the e2e environment. Each cell is the **median of 5 runs**; the perf score range over the 5 runs is shown because machine load made it wide (`vite preview` gzips responses, Cloudflare uses brotli, so transfer sizes are slightly higher than production will be).

| | Landing before | Landing after | Draft room before | Draft room after |
| :-- | --: | --: | --: | --: |
| Performance | 90 (85 to 93) | 92 (79 to 93) | 82 (79 to 89) | 78 (62 to 89) |
| Accessibility | 96 | 98 | 97 | 98 |
| Best Practices | 100 | 100 | 96 | 100 |
| SEO | 82 | 100 | 82 | 100 |
| LCP | 2.95 s | 2.77 s | 3.24 s | 3.25 s |
| TBT | 247 ms | 221 ms | 442 ms | 574 ms |
| CLS | 0 | 0 | 0 | 0 |
| FCP | 757 ms | 681 ms | 757 ms | 711 ms |
| Transfer | 275 kB | 274 kB | 298 kB | 298 kB |

Reading it: the three non-performance categories improved for a reason each; the Performance score and TBT differences are inside the run-to-run spread (the draft room's "after" TBT is worse by noise, not by a change that touches its JS). The JS payload is the same, so no real improvement was expected there; FCP on the landing page is consistently about 75 ms better after the render-blocking stylesheet was inlined.

Fixed because they were cheap and showed up in the report:

- `meta-description` missing (SEO 82 to 100): description and `theme-color` added to `index.html`.
- `robots-txt` invalid, the SPA fallback answered `/robots.txt` with `index.html`: real `public/robots.txt`.
- `render-blocking-insight`, 1 kB `index.css` (about 150 ms): inlined into `index.html`; also stops a white flash before the dark background.
- `landmark-one-main` and `heading-order`: routes are wrapped in `<main>`, the landing "How it works" heading is an `h2`.
- `errors-in-console` on the draft room (Best Practices 96 to 100): `navigator.vibrate` was called before any tap, which Chrome logs as an intervention. Now it waits for `navigator.userActivation.hasBeenActive`.

Left alone: `unused-javascript` (about 125 kB, mostly the supabase packages above and MUI), `valid-source-maps` (no source maps are shipped; revisit when Sentry source map upload is set up), `bf-cache`, `llms-txt` and `ard-schema` (not relevant). Cache headers in `public/_headers` were already correct (`immutable` for `/assets/*`, `no-cache` for `index.html`). No images or web fonts are loaded (the theme uses the system font stack), so there is nothing to size or preload.

### Lighthouse after #133 (landing, signed out)

Same method, 5 runs each of the previous commit's build and this one, back to back on the same machine (medians; Performance range in brackets). The draft room was not re-run: it loads the same initial chunks, so its JS saving is the same 31 kB, and re-running it needs the seeded draft described below.

| | Landing before | Landing after |
| :-- | --: | --: |
| Performance | 85 (74 to 94) | 90 (73 to 96) |
| LCP | 2.8 s | 2.6 s |
| TBT | 410 ms | 320 ms |
| Transfer | 275 kB | 244 kB |

Transfer is the stable signal (31 kB less); the score ranges overlap, so the Performance and TBT gains are within noise.

### Re-running

Needs `make db-up`, Chromium from `npx playwright install chromium`, and a throwaway database whose name ends in `_e2e` (the seeder refuses anything else).

```bash
# 1. API with the test-auth stub (separate port and database from `make e2e`)
export PG_URI=postgresql://postgres:postgres@localhost:5433/postszn_perf_e2e \
  SUPABASE_URL=http://localhost:54321 CORS_ORIGINS=http://localhost:5292 \
  ENVIRONMENT=test TEST_AUTH_STUB=true
uv run --project api python -m api.scripts.seed_e2e
uv run --project api uvicorn api.main:app --port 8110 &

# 2. Production build against it, served by vite preview
cd frontend
VITE_API_URL=http://localhost:8110 VITE_WS_URL=ws://localhost:8110 \
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e \
  npx vite build --outDir /tmp/web-perf --emptyOutDir
npx vite preview --outDir /tmp/web-perf --port 5292 --strictPort &
```

Seed an in-progress draft the way `e2e/support/draft.ts` does: sign up two users through `POST /api/auth/login` (bearer `e2e-user:<uid>`), create a league with a small roster, invite and join, `PUT /api/drafts/{id}/order`, `POST .../control/lobby`, then `.../control/start` with `timePerPickSeconds` large enough that the clock does not expire.

Then run Lighthouse from a scratch directory (`npm i lighthouse playwright-core`), `run.mjs`:

```js
import { chromium } from "playwright-core";
import lighthouse from "lighthouse";

// node run.mjs <baseUrl> <path> <uid|-> : e.g. http://localhost:5292 /league/1/draft host-abc
const [, , base, path, uid] = process.argv;
// A persistent context keeps the page in Chrome's default profile, which is what Lighthouse attaches to.
const browser = await chromium.launchPersistentContext("/tmp/lh-profile", {
  args: ["--remote-debugging-port=9333", "--no-sandbox"],
});
const page = browser.pages()[0];
// A non-asset URL on the same origin: seeding storage here must not warm the HTTP cache for the run.
await page.goto(`${base}/vite.svg`);
if (uid !== "-") {
  const session = {
    access_token: `e2e-user:${uid}`, refresh_token: "e2e", token_type: "bearer", expires_in: 3e8,
    expires_at: Math.floor(Date.now() / 1000) + 3e8,
    user: { id: uid, aud: "authenticated", role: "authenticated", email: `${uid}@e2e.test`,
      app_metadata: {}, user_metadata: { full_name: "host" }, created_at: "2026-01-01T00:00:00Z" },
  };
  // Must match the storageKey in frontend/src/utils/supabase.ts.
  await page.evaluate((s) => localStorage.setItem("postszn-auth", s), JSON.stringify(session));
}
const { lhr } = await lighthouse(base + path, { port: 9333, output: "json", disableStorageReset: true });
await browser.close();
const a = lhr.audits;
console.log(Object.entries(lhr.categories).map(([k, c]) => `${k} ${c.score * 100}`).join(" | "),
  `LCP ${a["largest-contentful-paint"].displayValue} TBT ${a["total-blocking-time"].displayValue}`,
  `CLS ${a["cumulative-layout-shift"].displayValue} transfer ${Math.round(a["total-byte-weight"].numericValue / 1024)} kB`);
```

Run it five times per page and compare medians; single runs vary by 10 or more points on a busy machine. Landing is `node run.mjs http://localhost:5292 / -`, the draft room needs the seeded league id and the host's uid.
