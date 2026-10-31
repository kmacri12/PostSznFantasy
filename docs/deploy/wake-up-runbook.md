# Wake-up runbook: before the next postseason (#112)

Run this about a month before the Wild Card round, after the season's player pool is known enough to seed. It undoes the [shutdown runbook](shutdown-runbook.md). End state: Supabase up, one Fly machine serving the new `SEASON_YEAR`, NFL data loaded, paid Tank01 plan active, monitors on, scheduler still **off** until games are near.

Who runs it: **you (the owner)**. Steps marked **OWNER** need your own accounts. Each step ends with a **Verify** line; do not go on until it passes. Never paste a secret into chat, a ticket or this repository. Tools as in the shutdown runbook, plus `uv` for local migrations.

```bash
export FLY_APP=postszn-api
```

## 1. Bring Supabase back (OWNER)

- **It was kept active (Option A):** nothing to do. Confirm in the dashboard it shows "Healthy".
- **It was paused (Option B):** open the project, click **Resume project** and wait until it is healthy. Free projects move to the newest Postgres minor version when restored ([Supabase](https://supabase.com/docs/guides/platform/upgrading)). Re-enable the backup workflow: `gh workflow enable backup.yml`.
- **The project is gone or the restore failed:** create a new project the way Stage 2 of the [cutover runbook](cutover-runbook.md) does (`scripts/wizards/supabase-prod.sh`), restore the stored dump into it with `scripts/restore-backup.sh <dump.gpg> <new direct or session pooler URL>`, then update `PG_URI` and the GitHub secret `PROD_DATABASE_URL`, and set the Site URL and redirect URLs again. Users have to sign up again (Auth accounts are not in the dump), so budget time to tell them.

**Verify:** `psql '<session pooler string>' -tAc 'select version_num from public.alembic_version'` prints the revision, and `show server_version` is a 17.x.

## 2. Start the Fly machine and check secrets (OWNER)

```bash
fly machine list --app "$FLY_APP"
fly machine start <machine-id> --app "$FLY_APP"
fly secrets list --app "$FLY_APP"
```

Secrets stay stored while the machine is stopped. Check these names exist: `PG_URI`, `SUPABASE_URL`, `ADMIN_SUPABASE_UIDS`, `RAPIDAPI_APIKEY`, `RAPIDAPI_BASEURL`, `RAPIDAPI_APIHOST`, `CORS_ORIGINS`. Rotate any that expired or changed:

- Supabase database password or connection string changed: `fly secrets set PG_URI=... --app "$FLY_APP"` (see [fly.md](fly.md); a secret change restarts the machine, so no live draft).
- RapidAPI key rotated: set `RAPIDAPI_APIKEY`.
- `FLY_API_TOKEN` deploy tokens last 20 years by default ([Fly docs](https://docs.fly.io/flyctl/tokens-create-deploy)); recreate only if you revoked it.

**Verify:** `fly machine list` shows `started`, and `curl -s https://api.postsznfantasy.com/api` prints `{"status":"healthy"}` (that endpoint queries the database).

## 3. Run migrations and confirm the Postgres version (OWNER)

Migrations run by themselves as the release step of **Deploy API**, so this happens in step 4. If a restore or version bump needs them earlier:

```bash
cd api && PG_URI='<session pooler string>' SUPABASE_URL='https://<ref>.supabase.co' uv run alembic upgrade head
```

**Verify:** `alembic_version` holds the newest revision from `main` (`ls api/alembic/versions` shows the head) and `select version()` reports PostgreSQL 17.

## 4. Update `SEASON_YEAR`, deploy, and reload NFL data (OWNER)

The roster endpoint only serves the current season, so refresh everything for the new year.

1. Change `SEASON_YEAR` in [`fly.toml`](../../fly.toml) (and the default in `api/.env.example`), open a pull request, merge it.
2. GitHub, Actions, **Deploy API**, Run workflow, tick "I checked". It refuses to run if a draft is live, applies migrations, and swaps in the new image.
3. Seed teams, players, depth charts and season stats. This **spends RapidAPI quota**; a full seed is about 35 calls ([rapidapi-quota.md](../research/rapidapi-quota.md)), so do it after step 5 or on the free Basic cap:

```bash
fly ssh console --app "$FLY_APP" -C "python -m api.scripts.seed_nfl_data --season <new year>"
```

4. The admin playoff-field endpoint (`PUT /api/admin/playoff-field`, 14 team ids) is set once the bracket is known; drafts need it ([AGENTS.md](../../AGENTS.md) route map).

**Verify:** the workflow is green; `scripts/dormancy-check.sh awake` passes; `curl -s https://api.postsznfantasy.com/api/config` shows the new `season`; `psql ... -c 'select count(*) from nfl.teams'` is 32 and the players page lists current rosters. The seed prints the remaining quota: write it down.

## 5. Re-subscribe to the Tank01 Pro plan and confirm the quota (OWNER)

On rapidapi.com, subscribe your Tank01 NFL app to **Pro** ($10 per month, 1,000 requests per day, then $0.01 each; confirm the price on the plan page, it changes). Prices and limits: [rapidapi-quota.md](../research/rapidapi-quota.md). Keep the app and key the same.

**Verify:** the plan page shows Pro and the daily limit; one admin refresh succeeds; the API logs show `RapidAPI call N/700 today` (the budget guard, `RAPIDAPI_DAILY_REQUEST_LIMIT`).

## 6. Monitors, backups, smoke test (OWNER)

- UptimeRobot: **Resume** the `PostSzn API` monitor ([uptime-check.md](uptime-check.md)). If you used Option B, `gh workflow enable backup.yml` and run it once by hand.
- Smoke test as in Stage 8 of the [cutover runbook](cutover-runbook.md): two accounts sign in, create a league, run a mock draft with an auto-pick, open standings, on a phone as well.

**Verify:** the monitor shows Up; the backup run is green with a new artifact; the mock draft completes; `fly logs --app "$FLY_APP"` shows no repeated errors.

## 7. Turn the scheduler on only when games are near

Wild Card weekend and later, never earlier (every tick can spend quota). No live draft may be running.

```bash
fly secrets set SCHEDULER_ENABLED=true --app "$FLY_APP"
```

Turn it off again after the last game of each week if you want to save quota. If the scheduler is on, remember to turn it off in the shutdown runbook.

**Verify:** logs show scheduler ticks and `RapidAPI call N/700 today` lines on the first game day.

## What counts as done

Steps 1 to 6 verified before the playoffs, step 7 on game day, and the page edited in the same pull request wherever it was wrong.
