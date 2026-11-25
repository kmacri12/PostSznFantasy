# 09: iOS shell and CI

Phase A (scaffold) right after 01; Phase C (release builds) once 02, 03, 06 and 07 are in. Needs owner step [26](../../owner/26-store-accounts.md) (Apple organization account, App Store Connect app, API key), [27](../../owner/27-firebase-push.md) (`GoogleService-Info.plist`, APNs key in Firebase) and [28](../../owner/28-apple-sign-in.md). Needs the owner's Mac once (below). [Back to the plan](../README.md)

## Goal

A signed iOS build of the current web build, produced by CI from a tag on a GitHub macOS runner and uploaded to TestFlight, with no Mac on the release path.

## Machines

- **Release path: GitHub-hosted macOS runners only.** Free for this public repo, with the Xcode version Apple currently requires. Signing uses an App Store Connect API key (no certificates exported by hand).
- **The owner's Mac** (2012 MacBook Pro on a patched current macOS, slow but runs Xcode) is the debugging bench: the first open of the Xcode project to add capabilities and check signing, Safari's Web Inspector attached to the app on the owner's wife's iPhone, and the occasional simulator run. If it stops running Xcode, nothing on the release path breaks; rent a cloud Mac for an hour instead.
- `npx cap add ios` and `cap sync ios` run fine on Linux; only building needs macOS.

## Scope

**Scaffold (Phase A)**

1. `npx cap add ios` creates `frontend/ios/` (committed; build outputs ignored), using **Swift Package Manager**, not CocoaPods (its registry went read-only around December 2026).
2. CI job on a macOS runner: native web build, `cap sync ios`, `xcodebuild` for the simulator (no signing). It runs on PRs that touch `frontend/ios/` or the Capacitor config, and nightly otherwise, to save runner time.
3. A first TestFlight build (internal testers only, no review needed) as soon as signing works, so Phase B can try things on the iPhone.

**Finish (Phase C)**

4. Capabilities (once, on the Mac, committed): Push Notifications, Sign in with Apple, Associated Domains (`applinks:postsznfantasy.com`), Time Sensitive Notifications.
5. `Info.plist`: display name "PostSzn", usage strings only for what is used (photo library for the avatar and problem-report pickers, camera if the picker offers it), `ITSAppUsesNonExemptEncryption = NO` (HTTPS only), portrait on iPhone.
6. iPhone-only target. iPads still run iPhone apps in compatibility mode and reviewers sometimes use one: check the layout there once on the simulator.
7. `PrivacyInfo.xcprivacy`: the required-reason APIs the app and its plugins use (Preferences uses UserDefaults), and no tracking. Plugins ship their own manifests; check them.
8. App icon (1024px, no transparency, from the existing icon artwork), launch screen matching the dark background.
9. `GoogleService-Info.plist` injected from a CI secret.
10. Version: `CFBundleShortVersionString` from the tag, build number from `GITHUB_RUN_NUMBER`.
11. **Release CI**: on a `mobile-v*` tag in the protected environment, archive with automatic signing through the App Store Connect API key (`xcodebuild -allowProvisioningUpdates` with the key) or fastlane, and upload to TestFlight. Submitting for App Review stays manual (owner step 31).

## Touches

`frontend/ios/**`, `frontend/capacitor.config.ts` (shared with 08), `frontend/package.json`, `Makefile` (`make ios-sync`), `.github/workflows/` (the mobile workflow from 08), `.gitignore`, AGENTS.md, CONTRIBUTING.md.

## Done when

- A tag produces a TestFlight build installable on the owner's wife's iPhone.
- The simulator build job is green; it fails when the shell breaks.
- Push, Sign in with Apple and a universal link work on the device.
- No certificate, key or `.p8` is committed.

## Re-verify before starting

- The Xcode and SDK version Apple requires and what the macOS runner images ship.
- Capacitor's iOS template and Swift Package Manager support for every plugin chosen in 02, 03, 06 and 07.
- Privacy manifest required-reason API list.
