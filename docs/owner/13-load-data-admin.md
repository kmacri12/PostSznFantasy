# Step 13: load the NFL data and make yourself admin

About 20 minutes. Issue #74. Needs Steps 6, 7 and 8. [Back to the list](README.md)

## A. Load the NFL data (about 35 Tank01 calls)

```bash
fly ssh console --app postszn-api -C "python -m api.scripts.seed_nfl_data --season 2026"
```

It prints counts for teams, players and stats, then the RapidAPI calls left. It stops with an error if anything comes back empty. Running it again is safe.

## B. Become admin

1. Sign in at https://postsznfantasy.com once.
2. Supabase, `postszn-prod`, **Authentication**, **Users**. Click your user and copy the **User UID**.
3. Set it on the API (restarts it for a few seconds; there are no drafts yet):
   ```bash
   fly secrets set ADMIN_SUPABASE_UIDS=<your UID> --app postszn-api
   ```
4. Set it on the site: Cloudflare, project `postszn`, **Settings**, **Variables and Secrets**, **Production**, **Add**: `VITE_ADMIN_SUPABASE_UIDS` = the same UID. Then **Deployments**, latest, **Retry deployment**.

## Verify

1. Count the teams (session pooler string from your password manager):
   ```bash
   psql '<Supabase session pooler URL>' -c 'select count(*) from nfl.nfl_teams'
   ```
   It prints `32`.
2. https://postsznfantasy.com/players, signed in, lists players.
3. `fly secrets list --app postszn-api` lists `ADMIN_SUPABASE_UIDS`.
4. On a league page, the "Stats updated" line shows **Refresh now** for you and not for a second account. Tap it once: a toast confirms. Each tap spends API calls.

Close #74 if it is still open.

## If it goes wrong

- `fly ssh console` errors, or "python: not found": paste the error to the coordinator.
- A 403 on an admin action: the UID on Fly does not match Supabase. Copy it again with no spaces.
