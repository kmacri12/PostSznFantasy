# Frontend hosting (Cloudflare Pages)

The SPA is a static Vite build served by Cloudflare Pages at `postsznfantasy.com`. The API lives on a different origin (`api.postsznfantasy.com`, Fly.io), so the browser needs explicit API and WebSocket origins. Account and DNS steps: `scripts/wizards/cloudflare-pages.sh`.

## Pages project settings

| Setting | Value |
| :-- | :-- |
| Production branch | `main` (every push deploys) |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| `NODE_VERSION` (build variable) | `22.12` (matches `frontend/.nvmrc`) |

Pushes to other branches get a per-branch preview URL (`<branch>.<project>.pages.dev`). That replaces a staging environment, but previews talk to the same production API and database, and the API only allows the production origin in `CORS_ORIGINS`, so a preview can load but not call the API.

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
| `VITE_WS_URL` | `src/hooks/useDraftRoom.ts` | `wss://api.postsznfantasy.com` | `ws(s)://` + the page's host, the same failure for the draft room |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/utils/supabase.ts` | from the Supabase production project | sign-in fails |
| `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` | `src/utils/sentry.ts` | optional, see [sentry.md](sentry.md) | error tracking off |
| `VITE_ADMIN_SUPABASE_UIDS` | `DataFreshness.tsx` | optional admin hint | the admin refresh button stays hidden |

Locally the Vite dev server proxies `/api` (including the WebSocket) to `localhost:8000`, which is why these are optional in development but **required** in the Pages project. Pages cannot proxy `/api` to Fly (`_redirects` proxying only works for same-site paths, and does not carry WebSockets), so the cross-origin setup is the supported route.

Matching API side (Fly secrets, see `api/.env.example`): `CORS_ORIGINS=https://postsznfantasy.com`.

## Dormant mode (off-season or outage)

At load the SPA calls `GET {VITE_API_URL}/api` (the API health endpoint, `src/api/health.ts`). A network error, timeout or 5xx switches it to dormant mode: landing (with a "back for the next postseason" notice instead of sign-in), How to play, Privacy and Terms still render; every other route shows the notice. A 4xx is not dormant. While dormant it re-checks every 30 seconds and recovers on its own. To go dormant for the off-season, stop the Fly machine (`fly machine stop`, see [shutdown-runbook.md](shutdown-runbook.md); not `fly scale count 0`, which destroys it); to wake, start it again ([wake-up-runbook.md](wake-up-runbook.md)). No Pages redeploy either way. The check is a cross-origin request, so a wrong `CORS_ORIGINS` also looks like downtime.

## Verify a deploy

```bash
curl -sI https://postsznfantasy.com/                 # 200, Cache-Control: no-cache
curl -sI https://postsznfantasy.com/leagues/1/draft  # 200 (SPA fallback), not 404
curl -s https://postsznfantasy.com/ | grep -o '/assets/[^"]*\.js' | head -1 \
  | xargs -I{} curl -sI https://postsznfantasy.com{} | grep -i cache-control   # immutable
```

Then open the site, sign in, and check the browser network tab: API calls go to `api.postsznfantasy.com` and the draft room opens a `wss://api.postsznfantasy.com/api/drafts/ws/...` connection.

Not validated until the real project exists: Pages applying `_headers`/`_redirects` (verified only that they land in `dist/`).
