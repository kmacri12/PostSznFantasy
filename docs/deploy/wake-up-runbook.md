# Wake-up runbook: before the next postseason (#112)

Run this about a month before the Wild Card round, after the season's player pool is known enough to seed. It undoes the [shutdown runbook](shutdown-runbook.md). End state: Supabase up, one Fly machine serving the new `SEASON_YEAR`, NFL data loaded, paid Tank01 plan active, monitors on, scheduler still **off** until games are near.

Who runs it: **you (the owner)**. Steps marked **OWNER** need your own accounts. Each step ends with a **Verify** line; do not go on until it passes. Never paste a secret into chat, a ticket or this repository. Tools as in the shutdown runbook, plus `uv` for local migrations.

```bash
export FLY_APP=postszn-api
read -rsp 'Session pooler string: ' DATABASE_URL && export DATABASE_URL   # keeps it out of shell history
```

## 1. Bring Supabase back (OWNER)

- **It was kept active (Option A):** nothing to do. Confirm in the dashboard it shows "Healthy". **Verify:** the dashboard says Healthy.
- **It was paused (Option B):** open the project, click **Resume project** and wait until it is healthy. Free projects move to the newest Postgres minor version when restored ([Supabase](https://supabase.com/docs/guides/platform/upgrading)). Re-enable the backup workflow: `gh workflow enable backup.yml`.
- **The project is gone or the restore failed:**
  1. Create a new project as in Stage 2 of the [cutover runbook](cutover-runbook.md) (`scripts/wizards/supabase-prod.sh`; click by click: [owner Step 4](../owner/04-supabase-project.md)).
  2. Restore the stored dump: `scripts/restore-backup.sh <dump.gpg> "$DATABASE_URL"` (the new project's session pooler string).
  3. Update `PG_URI` (step 2) and the GitHub secret `PROD_DATABASE_URL`, and set the Site URL and redirect URLs again.
  4. Recreate the sign-in accounts. They are not in the dump, but the dump holds every user's id and email, and the script creates each user in the new project with the same id (no passwords involved; sign-in is Google or magic link). Use the project's **service_role** key (Project Settings, API Keys; type it into the prompt, never into chat or a file):
     ```bash
     read -rsp 'service_role key: ' SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
     PG_URI="$DATABASE_URL" SUPABASE_URL='https://<new-ref>.supabase.co' \
       python -m api.scripts.recreate_auth_users            # dry run: read the plan
     PG_URI="$DATABASE_URL" SUPABASE_URL='https://<new-ref>.supabase.co' \
       python -m api.scripts.recreate_auth_users --apply
     unset SUPABASE_SERVICE_ROLE_KEY
     ```
     Users without a stored email are listed as `SKIP`; they sign up again and a commissioner reassigns their team. Safe to run twice.
     Practise it first with `make rehearse-auth-restore` ([backup.md](backup.md#recreating-sign-in-accounts)).
  **Verify:** the restore printed `restored, alembic revision <latest>`, the script printed `created N, already present 0, failed 0`, and signing in with an emailed code at the new project lands on your old leagues.

**Verify:** `psql "$DATABASE_URL" -tAc 'select version_num from public.alembic_version'` prints the revision, and `show server_version` is a 17.x.

## 2. Start the Fly machine and check secrets (OWNER)

```bash
fly machine list --app "$FLY_APP"
fly machine start <machine-id> --app "$FLY_APP"
fly secrets list --app "$FLY_APP"
```

Secrets stay stored while the machine is stopped. Check these names exist: `PG_URI`, `SUPABASE_URL`, `ADMIN_SUPABASE_UIDS`, `RAPIDAPI_APIKEY`, `RAPIDAPI_BASEURL`, `RAPIDAPI_APIHOST`, `CORS_ORIGINS`. Rotate any that expired or changed:

- Supabase database password or connection string changed: `fly secrets set PG_URI="$DATABASE_URL" --app "$FLY_APP"` (see [fly.md](fly.md); a secret change restarts the machine, so no live draft).
- RapidAPI key rotated: set `RAPIDAPI_APIKEY`.
- `FLY_API_TOKEN` deploy tokens last 20 years by default ([Fly docs](https://docs.fly.io/flyctl/tokens-create-deploy)); recreate only if you revoked it.

**Verify:** `fly machine list` shows `started`, and `curl -s https://api.postsznfantasy.com/api` prints `{"status":"healthy"}` (that endpoint queries the database).

Then turn dormant mode off: in Cloudflare Pages set `VITE_DORMANT=false` (or delete it) and rebuild from Deployments (**Retry deployment**). **Verify:** `scripts/dormancy-check.sh awake` passes, including `/status.json` saying `dormant: false`.

## 3. Run migrations and confirm the Postgres version (OWNER)

Migrations run by themselves as the release step of **Deploy**, so this happens in step 4. If a restore or version bump needs them earlier:

```bash
cd api
PG_URI="$DATABASE_URL" SUPABASE_URL='https://<ref>.supabase.co' \
  uv run alembic upgrade head
```

**Verify:** `alembic_version` holds the newest revision from `main` (`ls api/alembic/versions` shows the head) and `select version()` reports PostgreSQL 17.

## 4. Update `SEASON_YEAR`, deploy, and reload NFL data (OWNER)

The roster endpoint only serves the current season, so refresh everything for the new year.

1. Change `SEASON_YEAR` in [`fly.toml`](../../fly.toml) (and the default in `api/.env.example`), open a pull request, merge it.
2. GitHub, Actions, **Deploy**, **Enable workflow** (it was disabled when you shut down), Run workflow, tick "I checked". It refuses to run if a draft is live, applies migrations, and swaps in the new image.
3. Seed teams, players, depth charts and season stats. This **spends RapidAPI quota**; a full seed is about 35 calls ([rapidapi-quota.md](../research/rapidapi-quota.md)), which fits the free Basic cap, so it does not need step 5 first:

```bash
fly ssh console --app "$FLY_APP" -C "python -m api.scripts.seed_nfl_data --season <new year>"
```

4. Once the bracket is known, set the playoff field: `fly ssh console --app "$FLY_APP" -C "python -m api.scripts.set_playoff_field BUF KC ..."` with all 14 abbreviations (ingest marks only the 12 Wild Card teams; drafts need all 14). Owner steps: [docs/owner/playoff-field.md](../owner/playoff-field.md). Verify: `GET /api/players/draft-pool` returns players.

**Verify:** the workflow is green; `scripts/dormancy-check.sh awake` passes; `curl -s https://api.postsznfantasy.com/api/config` shows the new `season`; `psql "$DATABASE_URL" -tAc 'select count(*) from nfl.nfl_teams'` is 32 and the players page lists current rosters. The seed prints the remaining quota: write it down.

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

Turn it off again after the last game of each week if you want to save quota. Before going dormant, turn it off again (shutdown step 2).

**Verify:** the logs show `Background scheduler started` after the restart, and on the first game day `RapidAPI call N/700 today` lines appear as polls run.

## What counts as done

Steps 1 to 6 verified before the playoffs, step 7 on game day, and the page edited in the same pull request wherever it was wrong.
