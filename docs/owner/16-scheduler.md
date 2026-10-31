# Step 16: turn on live scoring before game day

10 minutes, the day before Wild Card weekend. Issue #78. Needs Steps 6 to 13, and RapidAPI **Pro** active (Step 2's January reminder). [Back to the list](README.md)

The scheduler polls Tank01 for games in progress every 3 minutes. A daily cap of 700 calls stops it, and Sentry emails you when the cap is hit ([Step 10](10-sentry.md), rule 4). **Never do this during a draft.**

1. Check no draft is live:
   ```bash
   DATABASE_URL='<Supabase session pooler URL>' scripts/check-live-drafts.sh
   ```
2. Turn it on (restarts the API for a few seconds):
   ```bash
   fly secrets set SCHEDULER_ENABLED=true --app postszn-api
   ```
3. After the Super Bowl, turn it off and drop RapidAPI back to Basic:
   ```bash
   fly secrets set SCHEDULER_ENABLED=false --app postszn-api
   ```

## Verify

During the first real game:

```bash
fly logs --app postszn-api
```

shows lines like `RapidAPI call 12/700 today` and `Polled 1 live games`. On the site, standings change and "Stats updated X min ago" stays under a few minutes.

Close #78.

## If it goes wrong

- No poll lines during a game: `fly secrets list --app postszn-api` must list `SCHEDULER_ENABLED`; check the logs for errors and paste them to the coordinator.
- The Sentry "Tank01 budget spent" email arrives: polling has stopped for the day (resets at midnight UTC). Tell the coordinator.
