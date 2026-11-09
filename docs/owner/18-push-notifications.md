# Step 18: Turn on push notifications

15 minutes plus a test on two phones. Issue #266. Needs Step 6 (the API on Fly) and Step 16 (the scheduler, which also sends the lineup reminders). [Back to the list](README.md)

Notifications come from the API using a key pair (VAPID keys) that you generate once. Without the keys the app simply hides the notification switch.

1. Generate the pair on your computer:
   ```bash
   cd ~/code/PostSznFantasy
   uv run --project api python -m api.scripts.generate_vapid_keys
   ```
   It prints `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a `VAPID_SUBJECT` line. Keep the private key secret, like the other Fly secrets.
2. Set all three on Fly (use your real email in the subject; set all three or none, otherwise the API refuses to start):
   ```bash
   fly secrets set VAPID_PUBLIC_KEY='<public>' VAPID_PRIVATE_KEY='<private>' VAPID_SUBJECT='mailto:you@example.com' --app postszn-api
   ```
   The website needs no variable: it asks the API for the public key. Do not generate a new pair later; everyone would have to turn notifications on again.

## Verify on two phones

Use a league where you own a team and the draft is running or the field is set.

**Android (Chrome):** open the site, sign in, tap your avatar (top right) to open Profile settings, switch **Notifications** on, allow. Start a draft where you are next on the clock (or have someone else pick before you): a "You're on the clock" notification arrives, and tapping it opens the draft room.

**Android, phone locked (the real draft test):** repeat the draft test with the phone **locked for 5 minutes or more**, screen off, Chrome closed, not plugged in. The "You're on the clock" notification must arrive within seconds. A test with the app open proves nothing about a sleeping phone. The draft alert and the lineup reminder are sent at high priority so Android delivers them while the phone dozes; chat is sent at normal priority and may be held back a few minutes on an idle phone.

**Chat:** chat pushes are off until each member turns on **Chat messages** in Profile settings (avatar), where Draft alerts and Lineup reminders (both on by default) have their own switches. With two accounts in one league, both with notifications and Chat messages on, post a message in the Feed from one; the other gets a notification naming the league and the author (not the text) that opens the Feed. Several messages within ten minutes replace each other with "N new messages". **Mute chat alerts** at the top of the Feed silences that one league.

**iPhone (iOS 16.4 or later):** in Safari tap Share, **Add to Home Screen**, then open PostSzn **from the new icon** (a Safari tab cannot receive notifications). Sign in, tap your avatar (top right), switch **Notifications** on in Profile settings, allow. Repeat the draft test.

**Lineup reminder:** needs a drafted league with an empty starter slot and the first kickoff of a round about an hour away, with `SCHEDULER_ENABLED=true`. You get "Lineup locks in about an hour" once per round.

## If it goes wrong

- The Notifications switch is off and greyed out in Profile settings (the avatar): the secrets are missing; `fly secrets list --app postszn-api` must list the three `VAPID_` names.
- The switch says to add the site to the Home Screen: on iPhone you opened it in Safari instead of from the icon.
- Notifications blocked: re-allow them for the site in the phone's settings.
- Notifications arrive late or only when the phone wakes (Android): on each phone, Android Settings, Apps, Chrome, Battery, set to **Unrestricted** (not Optimized), and turn off **Battery Saver** during the draft. The same advice is in the help next to the Notifications switch in Settings. If a locked phone still gets the alert late after that, send the phone model to the coordinator: some makers add their own battery limits.
- Nothing arrives: `fly logs --app postszn-api` shows `Push not delivered` with an HTTP status; paste it to the coordinator. Devices that unsubscribed are cleaned up automatically.

## The prompt members see

Members are asked once, in a sheet titled "Get notified when it matters", right after their first sign-in and right after they join a league (not after creating one). It never shows if notifications are already on, blocked, unsupported or not set up on the server (no VAPID keys), nor on a draft screen. Each device is asked at most twice ever: the second time only if they chose "Not now", and only on a different day. After that, the only place is Profile settings (tap the avatar), Notifications. If a member says they never got asked, that is probably why (they were already on, they blocked it in the browser, or the keys are missing).

## Notification icons

The large notification icon is the blue tile (`icon-192.png`); the small status-bar badge on Android is the white bracket on transparent (`badge-96.png`), because Android reads only a badge's outline. An installed web app keeps the icon it had at install time, so after changing icons remove the app from the Home Screen and add it again to see the new ones.
