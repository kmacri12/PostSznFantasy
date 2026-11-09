# Frontend hosting (Cloudflare Pages)

The SPA is a static Vite build served by Cloudflare Pages at `postsznfantasy.com`. The API lives on a different origin (`api.postsznfantasy.com`, Fly.io), so the browser needs explicit API and WebSocket origins. Account and DNS steps: `scripts/wizards/cloudflare-pages.sh`.

## Pages project settings

| Setting | Value |
| :-- | :-- |
| Production branch | `main`; **automatic production deployments off** once the ordered deploy works, the **Deploy** workflow triggers the build (below) |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| `NODE_VERSION` (build variable) | `22.12` (matches `frontend/.nvmrc`) |

Pushes to other branches get a per-branch preview URL (`<branch>.<project>.pages.dev`). That replaces a staging environment, but previews talk to the same production API and database, and the API only allows the production origin in `CORS_ORIGINS`, so a preview can load but not call the API.

## Ordered deploys (deploy hook)

Pushing to `main` does not build production by itself. The **Deploy** workflow ([fly.md](fly.md#how-a-deploy-works)) deploys the API first and then `curl -X POST`s the Pages **deploy hook** (Settings, Builds, Deploy hooks, branch `main`; stored as the GitHub secret `CLOUDFLARE_PAGES_DEPLOY_HOOK`), so the UI never goes live before the API it needs. The hook builds the head of `main` with the project's own variables. It is triggered only when `frontend/` changed since the last successful run. A frontend rebuild by hand (Deployments, Retry deployment) still works. Preview deployments for other branches stay on. Owner steps, including the order for turning automatic deployments off: [step 17](../owner/17-ordered-deploy.md). The hook URL is a secret: anyone who has it can trigger builds, so delete and recreate it if it leaks.

## Files in `frontend/public/`

Vite copies `public/` into `dist/`, where Pages reads them:

- `_redirects`: `/*  /index.html  200` is the SPA fallback, so deep links such as `/leagues/123/draft` and page refreshes serve the app instead of a 404. Real files (assets, `vite.svg`) are served first.
- `_headers`: `index.html` is `no-cache` so a deploy is picked up on the next load; `/assets/*` is `immutable` for a year because Vite fingerprints those filenames; plus `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a disabled-by-default permissions policy. There is deliberately no `Content-Security-Policy` yet: it would have to allow the Supabase, Google OAuth and API/WebSocket origins and needs testing against the real sign-in flow before it is enforced.

Bundle sizes, chunking rules and the Lighthouse mobile baseline: [performance.md](performance.md).

## How the production build finds the API

These are read by Vite at **build time** and baked into the JavaScript bundle, so changing one means a new Pages build (Deployments, then Retry deployment, or push a commit):

| Variable | Used in | Production value | If unset |
| :-- | :-- | :-- | :-- |
| `VITE_API_URL` | `src/api/client.ts` (axios `baseURL`) | `https://api.postsznfantasy.com` | `""`, so requests go to the **page's own origin** (`/api/...` on Pages), which has no API: every call fails |
| `VITE_WS_URL` | `src/hooks/useDraftRoom.ts` via `src/utils/wsOrigin.ts` | `wss://api.postsznfantasy.com` | `VITE_API_URL` with `https` swapped for `wss` (`http` for `ws`), else `ws(s)://` + the page's host |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/utils/supabase.ts` | from the Supabase production project | sign-in fails |
| `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` | `src/utils/sentry.ts` | optional, see [sentry.md](sentry.md) | error tracking off |
| `VITE_ADMIN_SUPABASE_UIDS` | `DataFreshness.tsx` | optional admin hint | the admin refresh button stays hidden |
| `VITE_GIPHY_API_KEY` | `src/utils/gifProvider.ts` | optional; a public GIPHY key (developers.giphy.com), see [Feed chat](../ui/README.md#feed-tab-chat-plus-league-events) | the Feed has no GIF button |

**The build fails loudly when they are missing.** On Cloudflare Pages (which sets `CF_PAGES`) or with `REQUIRE_PRODUCTION_ENV=1`, `vite build` (`requireProductionEnv` in `vite.config.ts`) stops with the names of any missing `VITE_API_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and also if the API URL is not `https://` or the WebSocket URL not `wss://`. A plain local `npm run build` (and `make check`) needs no `.env`.

Locally the Vite dev server proxies `/api` (including the WebSocket) to `localhost:8000`, which is why these are optional in development but **required** in the Pages project. Pages cannot proxy `/api` to Fly (`_redirects` proxying only works for same-site paths, and does not carry WebSockets), so the cross-origin setup is the supported route.

Matching API side (Fly secrets, see `api/.env.example`): `CORS_ORIGINS=https://postsznfantasy.com`.

## Dormant mode (off-season or outage)

Dormant mode is **declared, never inferred**: the Pages build variable `VITE_DORMANT=true` makes the SPA show landing (with a "back for the next postseason" notice instead of sign-in), How to play, Privacy and Terms, and the notice on every other route. Unset or anything else is the normal app. The build also publishes the value as `/status.json` (`{"dormant": true|false}`), which `scripts/dormancy-check.sh` reads. To change it: edit the variable in Pages (Settings, Variables and Secrets) and rebuild (Deployments, Retry deployment, or the deploy hook); do not push to `main` while dormant, that deploys the API too. Stopping or starting the Fly machine ([shutdown-runbook.md](shutdown-runbook.md), [wake-up-runbook.md](wake-up-runbook.md)) does not change what the SPA shows.

An API outage is a separate, transient state. `useApiHealth` (`src/api/health.ts`) calls `GET {VITE_API_URL}/api` at load, again on window focus and when the browser comes back online, and every 15 seconds while it is failing (a network error, timeout or 5xx; a 4xx is fine). While it fails, `App.tsx` keeps the current page and cached data and shows a "Reconnecting to PostSzn..." banner. On recovery it refetches all queries and repeats a failed sign-in sync (`retrySync`); there is no page reload. The check is a cross-origin request, so a wrong `CORS_ORIGINS` also looks like downtime.

## Verify a deploy

```bash
curl -sI https://postsznfantasy.com/                 # 200, Cache-Control: no-cache
curl -sI https://postsznfantasy.com/leagues/1/draft  # 200 (SPA fallback), not 404
curl -s https://postsznfantasy.com/ | grep -o '/assets/[^"]*\.js' | head -1 \
  | xargs -I{} curl -sI https://postsznfantasy.com{} | grep -i cache-control   # immutable
```

Then open the site, sign in, and check the browser network tab: API calls go to `api.postsznfantasy.com` and the draft room opens a `wss://api.postsznfantasy.com/api/drafts/ws/...` connection.

Not validated until the real project exists: Pages applying `_headers`/`_redirects` (verified only that they land in `dist/`).
