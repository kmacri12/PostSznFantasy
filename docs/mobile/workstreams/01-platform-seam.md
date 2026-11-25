# 01: Platform seam and native build config

Phase A, first. Needs nothing. Unblocks every other workstream. [Back to the plan](../README.md)

## Goal

One module answers "am I a native app, and which one?", public links never depend on the page's own origin, and the build and API accept a native app as a client. The web app behaves exactly as before.

## Why

In a Capacitor app the page's origin is `capacitor://localhost` (iOS) or `https://localhost` (Android). Anything built from `window.location.origin` (invite links, share links, auth redirects) would point at the phone itself. And without a single seam, native checks would spread through the code as ad hoc user-agent sniffing.

## Scope

1. **Add `@capacitor/core`** to `frontend/package.json` (it is web-safe: on the web it reports platform `web`). Do not add the iOS or Android projects here; 08 and 09 do.
2. **`frontend/src/utils/platform.ts`**: `isNative()`, `nativePlatform(): "ios" | "android" | null`, and nothing else at first. Everything native in later workstreams asks this module; nothing sniffs the user agent for this purpose. Existing helpers in `utils/pushSetup.ts` (`isIosDevice`, `isStandalone`) stay for the web.
3. **`PUBLIC_ORIGIN`**: a constant (from `VITE_PUBLIC_ORIGIN`, falling back to `window.location.origin` on the web so dev and e2e keep working). Replace every shareable or redirect use of `window.location.origin`. As of `c1f1083`:
   - `components/settings/InviteSheet.tsx:14`
   - `components/league/InvitePanel.tsx:11`
   - `components/league/InviteLinkButton.tsx:13` and `:61`
   - `components/league/PhaseBlock.tsx:140` and `:180` (calendar event URLs)
   - `contexts/UserContext.tsx:194` (`authCallbackUrl` for Google; 02 changes this flow again for native)
   - `contexts/UserContext.tsx:247` (`changeEmail`'s `emailRedirectTo`)
4. **Native build mode**: `vite build --mode native` (or an equivalent flag) that requires `VITE_API_URL`, `VITE_WS_URL` and `VITE_PUBLIC_ORIGIN`, reusing `requireProductionEnv` in `frontend/vite.config.ts`. A native build with an empty `VITE_API_URL` would call `capacitor://localhost/api`.
5. **API CORS**: production `CORS_ORIGINS` gains `capacitor://localhost` and `https://localhost`. This is configuration (Fly env), not a code default; document it in `api/.env.example` and [docs/deploy/fly.md](../../deploy/fly.md). The WebSockets need no change: they authenticate with an `AUTH` message and do not check Origin (verified at `c1f1083`).
6. **`X-App-Platform` header** (`web`, `ios`, `android`) on every API request, next to `X-App-Version` in `frontend/src/api/client.ts`. The API logs it in the request log line; 11 builds metrics and per-platform minimum versions on it. Add it to CORS `allow_headers` if that list is explicit.

## Touches

`frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/utils/platform.ts` (new), the seven call sites above, `frontend/src/api/client.ts`, `api/core/logging.py` (log the header), `api/main.py` (CORS headers if needed), `.env.example` files, `docs/deploy/fly.md`, `docs/deploy/frontend-hosting.md`, `AGENTS.md` (map entries).

## Done when

- `grep -rn "window.location.origin" frontend/src` shows no shareable link or auth redirect (a test can enforce it, like `routes.test.ts` does for season links).
- Unit tests for `platform.ts` (mock `Capacitor.getPlatform`) and for the native build-mode env check.
- The web build is unchanged in behaviour; `make check` and the e2e suite pass; invite links still read `https://postsznfantasy.com/join/<code>` in production.
- The API logs `X-App-Platform`.

## Re-verify before starting

- Capacitor's current major version and its Node requirement.
- That the WebSocket handlers still do not check Origin (`api/ws/`, `api/routers/drafts.py`, `api/routers/activity.py`).
- The call-site list (grep again; line numbers drift).
