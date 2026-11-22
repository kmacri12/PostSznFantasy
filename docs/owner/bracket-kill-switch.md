# Turn the NFL schedule off (and back on)

2 minutes, only if the bracket misbehaves on game day. Issue #393. [Back to the list](README.md)

The schedule page (More, **NFL schedule**, the link under the League tab's standings and the live scores row in its top block; its switch is still named `bracket`) is on by default. The switch lives in the database, so it takes effect for everyone within a minute and needs no deploy. Lineups, standings and scoring do not depend on it.

## Steps

1. Turn it off:
   ```bash
   fly ssh console --app postszn-api -C "python -m api.scripts.set_feature_flag bracket off"
   ```
   Turn it back on with `... bracket on`.
2. From a phone, or anywhere you have an admin sign-in token, the same switch is an API call (the same admin list as "Refresh live stats"):
   `PUT /api/admin/feature-flags/bracket` with the body `{"enabled": false}`. `GET /api/admin/feature-flags` shows every flag.

## Verify

1. The last log line says `Feature flag bracket is now off`.
2. Reload the app: the NFL schedule row and links are gone, and `https://<your API>/api/features` shows `{"bracket": false}`.
3. Opening a saved `/schedule` (or old `/bracket`) link shows "The schedule is off for now".
