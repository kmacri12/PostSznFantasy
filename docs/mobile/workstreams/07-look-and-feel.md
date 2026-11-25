# 07: Native look and feel

Phase B. Needs 01; checked on the shells from 08 and 09. Overlaps 06 in `DraftPage.tsx` and `utils/draftCue.ts`. Touches layout, so it runs `make tour` and refreshes the quality baselines. [Back to the plan](../README.md)

## Goal

The app looks and behaves like an app on both platforms: nothing under the notch, the status bar or the gesture bar, the keyboard never hides the composer, back works the Android way, and the draft room uses real haptics and keeps the screen on.

## Why

Apple rejects apps that feel like a website (4.2), and the details that give it away are exactly these. Some are also bugs today on iPhones: `index.html` has no `viewport-fit=cover`, so `env(safe-area-inset-*)` is zero in a full-screen WebView, and iOS has no `navigator.vibrate`, so the on-the-clock buzz in `utils/draftCue.ts` does nothing on an iPhone.

## Scope

1. **Viewport**: `viewport-fit=cover` in `frontend/index.html`; drop `maximum-scale=1` (it blocks zoom for people who need it; check the draft board and the composer still behave).
2. **Safe areas**: the top inset on the header (`components/layout/NavBar.tsx`, `AppShell.tsx`, `components/layout/BackHeader`) and the sheets that reach the top; the bottom inset already exists on the tab bar, the Feed and the player sheet, check the rest of the sheets.
3. **Android edge-to-edge**: enforced when targeting API 35+. Use Capacitor's current way to report system-bar insets to the WebView (re-verify; Android WebView's own `env()` support has varied).
4. **Status bar**: style follows the theme (`contexts/ThemeModeContext.tsx`), dark text on Light, light on Dark.
5. **Splash screen**: shown until the first paint, matching the dark `#121416` background that `index.html` already paints, so there is no flash.
6. **Keyboard**: the Feed composer (pinned with `100dvh` maths in `pages/FeedPage.tsx`) stays above the keyboard on both platforms; pick the Keyboard plugin's resize mode that does this without layout jumps.
7. **Android back button**: when React Router can go back, go back (so `hooks/useBackClosesOverlay.ts` keeps closing sheets); at a top-level tab, leave the app (minimize), never a blank page.
8. **Haptics**: `vibrateOnTurn` in `utils/draftCue.ts` uses the Haptics plugin in native (a strong pattern for on the clock, a light tap for on deck); a light tap on a confirmed pick.
9. **Keep awake**: the screen stays on while the draft room shows a draft in progress, released when it ends or the page closes.
10. **Coming back to the app**: reconnect the draft and Feed sockets (`hooks/useWebSocket.ts`, `useFeedLive.ts`) on the App plugin's resume event as well as `visibilitychange` and `online`; the snapshot on connect already resyncs.
11. **Touch details**: no long-press callout or text selection on buttons and tabs (`-webkit-touch-callout`, `user-select`), while chat text stays selectable; no rubber-band overscroll revealing a white background.
12. **Sound**: note in `content/rules.ts` copy or the draft settings that the iPhone silent switch mutes the draft sounds.

## Touches

`frontend/index.html` (and `src/index.test.ts`, `src/csp.test.ts` if the inline script changes), `components/layout/*`, sheet components, `contexts/ThemeModeContext.tsx`, `pages/FeedPage.tsx`, `utils/draftCue.ts`, `pages/DraftPage.tsx`, `hooks/useWebSocket.ts`, `hooks/useFeedLive.ts`, `hooks/useBackClosesOverlay.ts` (only if needed), `capacitor.config.ts` plugin settings (coordinate with 08/09), tour images, quality baselines.

## Done when

- On an iPhone with a notch and an Android phone with gesture navigation, in Dark and Light: nothing is hidden under a system bar on any key page, the composer stays visible with the keyboard open, sheets clear the top inset.
- Android back closes a sheet, then goes back a page, then leaves the app at a tab root.
- On the clock: a strong haptic on both phones; the screen stays on through a whole draft.
- The web at 375px looks as before (tour and quality baselines updated only where the viewport change moves something).

## Re-verify before starting

- Capacitor's current edge-to-edge / system-bars handling on Android and its StatusBar, SplashScreen, Keyboard, Haptics, KeepAwake and App plugins.
