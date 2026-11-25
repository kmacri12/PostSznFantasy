# 08: Android shell and CI

Phase A (scaffold) right after 01; Phase C (release builds) once 02, 03, 06 and 07 are in. Needs owner step [26](../../owner/26-store-accounts.md) for the Play Console app and its signing, and [27](../../owner/27-firebase-push.md) for `google-services.json`. Builds on this Linux machine and the Ubuntu runners. [Back to the plan](../README.md)

## Goal

A signed Android App Bundle of the current web build, produced by CI from a tag and uploaded to Play's internal testing track, plus a debug build on every PR so the shell never silently breaks.

## Scope

**Scaffold (Phase A)**

1. `npx cap init` with app id `com.postsznfantasy.app` and name "PostSzn Fantasy"; `capacitor.config.ts` in `frontend/` with `webDir: "dist"`; `npx cap add android` creates `frontend/android/` (committed; build outputs ignored).
2. `make` targets: `make android-sync` (native build of the web app, then `cap sync android`), `make android-debug` (debug APK). Document them in AGENTS.md section 3.
3. The app boots the bundled build against the production API (or a local API over the emulator's host address) and signs in with the emailed code. That is enough for Phase B to try things on a phone.

**Finish (Phase C)**

4. Target and compile SDK at the level Play currently requires; minimum SDK chosen for the members' phones (check Play Console's device stats after the beta).
5. App icon (adaptive: the existing maskable icon's artwork as foreground, the theme background), monochrome icon for Android 13 themed icons, notification small icon (from `public/icons/badge-96.png` artwork), splash.
6. `google-services.json` injected at build time from a CI secret (not committed), channel setup from 03, App Links intent filter for `postsznfantasy.com` with `autoVerify` (06).
7. Permissions: only what plugins need (internet, notifications, vibrate, wake lock); no location, contacts or camera permission unless a plugin requires it, and then say why in the Play listing.
8. Version: `versionName` from the tag (`mobile-v1.2.0` gives `1.2.0`), `versionCode` from `GITHUB_RUN_NUMBER` (always increasing).
9. **Signing**: Play App Signing on; CI holds the **upload** key (keystore and passwords as GitHub environment secrets). The Play signing certificate's SHA-256 goes into `assetlinks.json` (06).
10. **CI**:
    - every PR touching `frontend/`: native build of the web app, `cap sync android`, `./gradlew assembleDebug`
    - on a `mobile-v*` tag pushed by the owner, in a protected GitHub environment: `bundleRelease`, upload to the internal testing track (Gradle Play Publisher or fastlane supply with a Play service account from step 26); promotion to production stays a manual step in Play Console
11. Store screenshots come from 10, not here.

## Touches

`frontend/capacitor.config.ts`, `frontend/android/**`, `frontend/package.json` (Capacitor CLI and Android packages), `Makefile`, `.github/workflows/` (a new mobile workflow; keep `ci.yml` and `deploy.yml` as they are apart from the debug job), `.gitignore`, AGENTS.md, CONTRIBUTING.md (CI jobs list).

## Done when

- A tag produces a signed bundle in Play's internal track; testers install it from the Play Store.
- The debug job runs on PRs and fails when the shell breaks.
- No secret is committed; forked PRs build without secrets.

## Re-verify before starting

- Capacitor's current Android requirements (JDK, Gradle, Android Gradle Plugin) and Play's target API.
- Play App Signing and upload-key steps, the Play Developer API for uploads.
