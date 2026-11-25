# 06: Native behaviour: files, links, updates, deep links, kill switches

Phase B. Needs 01; tried on the shells from 08 and 09. Overlaps 07 in `DraftPage.tsx` and `utils/draftCue.ts`. [Back to the plan](../README.md)

## Goal

Everything the web app does through browser-only machinery (downloads, new tabs, the service worker, install and update prompts, the build-time dormant flag) has a native equivalent or is switched off in the apps; links into postsznfantasy.com open the app; and the riskiest features can be turned off from the server without a release.

## Why

A WebView is not a browser tab. `<a download>` and blob URLs do nothing, `target="_blank"` has nowhere to go, a service worker is pointless when the code is bundled, "install to Home Screen" makes no sense inside an installed app, and "a newer version is available, refresh" is wrong when the newer version must come through a store. Without OTA updates (a plan decision), kill switches are the fast way out of a mid-season bug.

## Scope

1. **Files and sharing**: in native, write the file with Capacitor Filesystem and hand it to the Share plugin. As of `c1f1083`: `utils/shareImage.ts` (share cards), `utils/calendar.ts` (`.ics`), `api/queries.ts` (data export, `postszn-my-data.json`). `utils/shareInvite.ts` uses the Share plugin in native too.
2. **External links**: open through the Browser plugin (in-app Safari / Custom Tabs). Includes `components/common/AddToCalendar.tsx` (Google Calendar link) and any other `target="_blank"`.
3. **Service worker and offline cache**: `registerServiceWorker()` (called in `main.tsx`) does nothing in native; `utils/offlineCache.ts` is a no-op; the offline banner still works from `navigator.onLine`.
4. **Install machinery off in native**: `components/install/InstallOffer.tsx`, `InstallGuideSheet.tsx`, the More tab's "Install the app" row, `ShortcutRedirect` (manifest shortcuts).
5. **Updates**: `hooks/useAppUpdate.ts` and `components/connection/UpdateBanner.tsx` stay off in native (a newer `/version.json` means a web deploy, not a store build). The 426 `app_outdated` answer (`api/appOutdated.ts`) shows "Update PostSzn" with a link to the right store listing (App Store id and Play package in config).
6. **Dormant mode at runtime**: native builds read `${PUBLIC_ORIGIN}/status.json` at startup (served by Pages even while the API is stopped; see the plan's [off-season problem](../README.md#the-off-season-problem)), remember the last answer in Preferences, and show `pages/DormantPage.tsx` when it says dormant. The web keeps `VITE_DORMANT`. `scripts/dormancy-check.sh` already reads the file.
7. **Hide in native**: the "Support PostSzn" row (`pages/MorePage.tsx`, Apple 3.1.1); team logos (`components/common/TeamLogo.tsx`) unless the server flag in 8 is on.
8. **Kill switches** (`api/services/feature_flags.py` `DEFAULTS`, read by `useFeatures`), each hiding its UI on every platform:
   - `chat`: the Feed's composer and messages (the server also refuses new messages while off)
   - `gifs`: the GIF button and GIF rendering
   - `share_cards`: the Share buttons on recap, standings and draft board
   - `draft_audio`: the cues in `utils/draftCue.ts`
   - `native_team_logos`: default **off**; turned on only if the rights check clears (owner step 29)
   Each gets a line in [docs/owner/bracket-kill-switch.md](../../owner/bracket-kill-switch.md) (rename it to a general kill-switch page).
9. **Deep links**: Universal Links and Android App Links for `https://postsznfantasy.com/*` (at least `/join/*`, league and team pages, and the auth return from 02):
   - `frontend/public/.well-known/apple-app-site-association` (JSON, no extension: add a `Content-Type: application/json` rule to `public/_headers`) with the team id and bundle id
   - `frontend/public/.well-known/assetlinks.json` with the package and the **Play App Signing** certificate SHA-256 (from 08)
   - the app's URL-open handler routes the path through React Router
   - the `/join/*` Pages Function (`functions/join/[code].ts`) and `_routes.json` stay as they are; check that `/.well-known/*` is served before the SPA fallback in `_redirects`
10. **Sentry**: `@sentry/capacitor` around the existing `@sentry/react` setup (`utils/sentry.ts`) so native crashes are reported too, tagged by platform; the scrubbers apply unchanged.

## Touches

`frontend/src/utils/shareImage.ts`, `calendar.ts`, `shareInvite.ts`, `api/queries.ts`, `components/common/AddToCalendar.tsx`, `main.tsx`, `utils/pushSetup.ts` (registration only), `utils/offlineCache.ts`, `components/install/*`, `pages/MorePage.tsx`, `hooks/useAppUpdate.ts`, `components/connection/UpdateBanner.tsx`, `api/appOutdated.ts`, `pages/DormantPage.tsx`, `components/common/TeamLogo.tsx`, `utils/sentry.ts`, `api/services/feature_flags.py`, the chat post route, `frontend/public/.well-known/*`, `frontend/public/_headers`, `docs/owner/bracket-kill-switch.md`.

## Done when

- On both shells: a share card, a calendar file and the data export each open the share sheet; external links open in the in-app browser; no install or "refresh" prompts appear; an outdated build sees the store link.
- With `status.json` saying dormant, the app shows the dormant page; switching it back restores the app on the next launch.
- Tapping a `postsznfantasy.com/join/<code>` link on a phone with the app installed opens the app's join page.
- Each kill switch hides its feature within a minute on web and native.
- The web build is unchanged; Vitest covers the native branches with `platform.ts` mocked.

## Re-verify before starting

- Apple's `apple-app-site-association` and Android's `assetlinks.json` formats.
- How Cloudflare Pages serves dotfile folders and extensionless files.
- Capacitor Filesystem, Share, Browser and App plugin APIs.
