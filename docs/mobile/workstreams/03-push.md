# 03: Native push through Firebase

Phase B. Needs 01, and owner step [27](../../owner/27-firebase-push.md) (Firebase project, APNs key, service account). Overlaps 02 (sign-out) and 04 (`api/services/push.py`). [Back to the plan](../README.md)

## Goal

Every notification the web app pushes today also reaches the native apps, opens the right page when tapped, respects every preference and quiet hours, and a phone never gets the same notification twice.

## Why

Native apps cannot use web push. Apple delivers only through APNs and Android through Firebase Cloud Messaging (FCM); FCM forwards to APNs, so one sender in the API covers both. Everything above the transport stays: `services/notifications.notify` writes the inbox and calls `push.send_to_users` with the kind's preference (`PUSH_KINDS`).

## Scope

**Backend**

1. **Model** (`api/db/models/push.py`): `push_subscriptions` gains `platform` (`web`, `ios`, `android`) and `token` (the FCM registration token). `endpoint`, `p256dh` and `auth` become nullable (web rows keep them). Uniqueness: `endpoint` for web rows, `token` for native rows. Migration and `docs/erd.md`.
2. **Routes** (`api/routers/push.py`): `POST /api/push/subscriptions` accepts either the web shape (`endpoint`, `keys`) or `{platform, token}`; `DELETE` likewise. Same upsert rule: a device moves to whoever signed in last. Existing authz lines cover the routes; add `BODIES` entries if validation changes.
3. **Sender** (`api/services/push.py` `_deliver`): native rows go to the FCM HTTP v1 API (`messages:send`) with a service-account OAuth token (cache it until expiry). Map `PushMessage`:
   - title, body, and `url` in `data`
   - `tag` to the Android notification tag and the iOS `apns-collapse-id`, so bursts collapse as they do on the web
   - `urgency` high to Android priority HIGH and APNs priority 10; the on-the-clock push also gets iOS `interruption-level: time-sensitive` (needs the Time Sensitive capability, 09)
   - an Android channel id per kind group (below)
   - prune the row on `UNREGISTERED` / 404, as `pywebpush` 404/410 are pruned today
4. **Config**: `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON` (secret), all or none like the VAPID trio; inert without them. `api/.env.example`, `api/core/config.py`.
5. **Device labels** (`services/account.py` `device_label`): native rows read "iPhone app" / "Android app".
6. **Duplicates**: when a native token registers, the answer says how many of the user's web subscriptions look like the same kind of phone (by stored user agent). The app offers one tap to remove them (`DELETE /api/account/devices/{id}`), worded so a member with the web app on a different phone is not misled.

**Frontend**

7. **Plugin**: use one that yields an FCM token on both platforms (at planning time `@capacitor-firebase/messaging`; the official `@capacitor/push-notifications` returns a raw APNs token on iOS, which FCM cannot address).
8. **`hooks/usePushNotifications.ts`**: a native branch beside the web state machine (unsupported / needs-install / denied / off / on): no "needs-install" state; permission through the plugin; register the token with the API; refresh it on every app start like `refreshPushSubscription` does for the web.
9. **Permission prompts** (`utils/notificationPrompt.ts`, `components/notifications/NotificationOptIn.tsx`): iOS shows the system prompt only once and Android 13+ asks at runtime. After a refusal, the second prompt (the rule allows two) opens the app's system settings instead.
10. **Android channels**, created at startup: Draft (high importance), Lineups, Scores and alerts, League (chat, mentions, announcements). Names match the switch groups in `components/settings/NotificationsToggle.tsx`.
11. **Taps**: the plugin's tap event navigates the router to `data.url`, the same address the web push and `components/notifications/inboxView.ts` use.
12. **In the foreground**: show the system banner (iOS presentation options) rather than nothing.
13. **Sign-out** (`utils/pushSetup.ts` `forgetThisDevice`): native branch deletes the token row and the token.
14. **Service worker**: untouched for the web; never registered in native (06).

## Touches

`api/db/models/push.py`, a migration, `docs/erd.md`, `api/routers/push.py`, `api/models/` push DTOs, `api/services/push.py`, `api/services/account.py`, `api/core/config.py`, `.env.example`, `frontend/src/hooks/usePushNotifications.ts`, `frontend/src/utils/pushSetup.ts`, `frontend/src/utils/notificationPrompt.ts`, `frontend/src/components/notifications/NotificationOptIn.tsx`, `frontend/src/components/settings/NotificationsToggle.tsx`, `frontend/src/contexts/UserContext.tsx` (sign-out), docs/owner/18-push-notifications.md (native note).

## Done when

- Each kind in `PUSH_KINDS` arrives on a real Android phone and iPhone with the app closed, in the background and in the foreground, and a tap opens its page.
- Preferences, the per-league chat mute and quiet hours hold for native rows exactly as for web rows.
- A deleted app's token is pruned on the next send.
- Tests: FCM stubbed with `httpx.MockTransport` (payload mapping, priority, collapse, pruning, token caching), the subscription union, device labels.

## Re-verify before starting

- FCM HTTP v1 request shape and auth; APNs header names; the Time Sensitive entitlement.
- The current Capacitor Firebase messaging plugin and its Swift Package Manager support.
- Android notification permission and channel rules for the current target API.
