# Step 27: Firebase for app notifications

About 40 minutes. Needs [Step 26](26-store-accounts.md). Part of the [native apps plan](../mobile/README.md) (not started). [Back to the list](README.md)

The apps cannot use the website's web push. Firebase Cloud Messaging (free) delivers notifications to the Android app and forwards them to Apple for the iPhone app; the API sends to Firebase only. Web push ([Step 18](18-push-notifications.md)) keeps working for browsers.

1. **Firebase console** (console.firebase.google.com), signed in with the company Google account: create the project `PostSzn Prod` (Google Analytics **off**).
2. **Add the Android app**: package `com.postsznfantasy.app`. Download `google-services.json`.
3. **Add the iOS app**: bundle id `com.postsznfantasy.app`. Download `GoogleService-Info.plist`.
4. Both files go to the `mobile-release` GitHub environment as secrets (the coordinator names them); CI writes them into the builds. Keep copies in the password manager.
5. **APNs key**: Apple Developer, Keys, create a key with **Apple Push Notifications service** on. Download the `.p8` (once). In Firebase, Project settings, Cloud Messaging, Apple app configuration: upload it with its key id and your Team ID.
6. **Service account for the API**: Firebase, Project settings, Service accounts, generate a new private key (JSON). Then, following the [draft rule](README.md#rules-that-protect-you):
   ```bash
   DATABASE_URL='<session pooler string>' scripts/check-live-drafts.sh
   fly secrets set FCM_PROJECT_ID=postszn-prod FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/<file>.json)" --app <api app>
   ```
   Delete the downloaded file afterwards; the password manager keeps the copy.

## Verify

- `GET /api` is healthy after the restart, and the API log has no Firebase configuration error.
- After [workstream 03](../mobile/workstreams/03-push.md) ships: turn on notifications in the app on both phones and get the test notification.

## If it goes wrong

- iPhone gets nothing while Android works: the APNs key is missing in Firebase or uploaded with the wrong Team ID.
