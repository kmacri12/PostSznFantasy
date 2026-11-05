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

**Android (Chrome):** open the site, sign in, go to Settings, **Turn on notifications**, allow. Start a draft where you are next on the clock (or have someone else pick before you): a "You're on the clock" notification arrives, and tapping it opens the draft room.

**Chat:** with two accounts in one league, both with notifications on, post a message in the Feed from one; the other gets a notification naming the league and the author (not the text) that opens the Feed.

**iPhone (iOS 16.4 or later):** in Safari tap Share, **Add to Home Screen**, then open PostSzn **from the new icon** (a Safari tab cannot receive notifications). Sign in, Settings, **Turn on notifications**, allow. Repeat the draft test.

**Lineup reminder:** needs a drafted league with an empty starter slot and the first kickoff of a round about an hour away, with `SCHEDULER_ENABLED=true`. You get "Lineup locks in about an hour" once per round.

## If it goes wrong

- No switch in Settings: the secrets are missing; `fly secrets list --app postszn-api` must list the three `VAPID_` names.
- The switch says to add the site to the Home Screen: on iPhone you opened it in Safari instead of from the icon.
- Notifications blocked: re-allow them for the site in the phone's settings.
- Nothing arrives: `fly logs --app postszn-api` shows `Push not delivered` with an HTTP status; paste it to the coordinator. Devices that unsubscribed are cleaned up automatically.
