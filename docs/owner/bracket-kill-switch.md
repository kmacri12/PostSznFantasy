# Turn the NFL bracket off (and back on)

2 minutes, only if the bracket misbehaves on game day. Issue #393. [Back to the list](README.md)

The bracket page (More, **NFL bracket**, and the button under the League tab's top block) is on by default. The switch lives in the database, so it takes effect for everyone within a minute and needs no deploy. Lineups, standings and scoring do not depend on it.

## Steps

1. Turn it off:
   ```bash
   fly ssh console --app postszn-api -C "python -m api.scripts.set_feature_flag bracket off"
   ```
   Turn it back on with `... bracket on`.
2. From a phone, or anywhere you have an admin sign-in token, the same switch is an API call (the same admin list as "Refresh now"):
   `PUT /api/admin/feature-flags/bracket` with the body `{"enabled": false}`. `GET /api/admin/feature-flags` shows every flag.

## Verify

1. The last log line says `Feature flag bracket is now off`.
2. Reload the app: the NFL bracket row and button are gone, and `https://<your API>/api/features` shows `{"bracket": false}`.
3. Opening a saved `/bracket` link shows "The bracket is off for now".
