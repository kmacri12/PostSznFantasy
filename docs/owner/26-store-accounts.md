# Step 26: Apple and Google developer accounts

About an hour, then Apple's and Google's verification (days to a couple of weeks). Needs [Step 25](25-llc.md) (the LLC, D-U-N-S, company website and email). Part of the [native apps plan](../mobile/README.md) (not started). [Back to the list](README.md)

Use the company email from Step 25, never a personal one, and keep every login in the password manager.

## Apple

1. **Enroll in the Apple Developer Program as an organization** (developer.apple.com/programs/enroll), $99 a year, with the D-U-N-S number. Apple may phone to confirm you can sign for the company.
2. **App Store Connect, Agreements**: accept the Free Apps agreement. No paid-apps, tax or banking setup: PostSzn is free with no purchases.
3. **Certificates, Identifiers & Profiles, Identifiers**: register the App ID `com.postsznfantasy.app` with Push Notifications, Sign in with Apple and Associated Domains on.
4. **App Store Connect, Apps, New App**: iOS, name "PostSzn Fantasy", bundle id `com.postsznfantasy.app`, SKU `postszn-ios`, primary language English (U.S.).
5. **App Store Connect API key** for CI: Users and Access, Integrations, App Store Connect API, a key with the **App Manager** role. Download the `.p8` once (it cannot be downloaded again). Store the key id, issuer id and file in the password manager, then add them as secrets of the protected `mobile-release` GitHub environment (the coordinator names the secrets).
6. **TestFlight**: create the internal group (you) and an external group "Beta" for friends, family and league members, invited by email.
7. Note your **Team ID** (Membership details) for the coordinator: it goes into `apple-app-site-association`.

## Google

1. **Create a Google Play developer account as an organization** (play.google.com/console), $25 once, with the D-U-N-S number and the company website. Google verifies the organization and your identity.
2. **Create the app**: "PostSzn Fantasy", app, free. Package `com.postsznfantasy.app` (set with the first upload).
3. **Play App Signing**: on (the default). The coordinator's CI uses an **upload key**: generate it with the coordinator's command, keep the keystore and passwords in the password manager, add them to the `mobile-release` environment. Copy the **app signing** certificate's SHA-256 (Setup, App signing) for `assetlinks.json`.
4. **Internal testing** track: create the tester list (emails), the beta group.
5. **CI upload access**: in Google Cloud, a service account with no project roles, then in Play Console, Users and permissions, invite it with release permissions for this app only. Its JSON key goes to the `mobile-release` environment, not into the repo.

## Verify

- Apple: the membership shows the LLC as the entity; the app record exists; the API key is in the GitHub environment.
- Google: the account shows the LLC and is verified; the app exists; the upload key and service account are in the GitHub environment; the signing SHA-256 is with the coordinator.

## If it goes wrong

- Apple says the D-U-N-S name doesn't match: fix it with D&B (Apple's lookup links there) so it matches the state filing exactly, then retry.
- Google's verification asks for documents: the state filing and the EIN letter usually satisfy it.
