# API on Fly.io

One always-on 1 GB machine runs `uvicorn api.main:app --workers 1 --proxy-headers` (the WebSocket rooms and the draft clock are in-process, so there is exactly one process unless `DRAFT_BROADCAST=postgres`, see [api-decisions](../api-decisions.md)). Config: [`fly.toml`](../../fly.toml). Image: [`Dockerfile`](../../Dockerfile). Account, app and secrets walkthrough: `scripts/wizards/fly-setup.sh`.

## How a deploy works

Every push to `main` runs the **Deploy** workflow ([`deploy.yml`](../../.github/workflows/deploy.yml)). The frontend is last, so a PR that changes the database, API and UI together never shows the new UI in front of the old API.

1. **Plan** (`scripts/deploy-plan.sh`). The API reports the commit it was built from in `GET /api` (`{"status":"healthy","version":"<sha>"}`; the Dockerfile `GIT_SHA` build arg, set by `flyctl deploy --build-arg`). The workflow compares it with `main` to decide whether the API changed (`api/`, `Dockerfile`, `fly.toml`, `deploy.yml`). The frontend has no such endpoint, so every successful run moves the git tag `deployed` to the commit it shipped; the frontend changed when `frontend/` differs from that tag. No tag or an unreadable version means "ship it". A run whose commit is no longer the head of `main` stops (a newer run owns the deploy), and so does one where production already runs `main`.
2. **Gate** (`scripts/check-live-drafts.sh`). A draft in `lobby`, `in_progress` or `paused` stops the run, red on `main`; nothing was deployed, so production stays on one consistent old version. The scheduled catch-up only warns, so it does not turn `main` red every 15 minutes.
3. **API**, only when it changed: `flyctl deploy --ha=false --strategy rolling` builds the image on Fly's builder.
4. Fly starts a temporary machine from the new image and runs the release command `alembic -c api/alembic.ini upgrade head`. **If it exits non-zero the deploy stops here, the run is red, the frontend is not built and the current machine keeps serving the old version.** Migrations run in one transaction, so a failed one leaves the schema untouched.
5. Fly stops the old machine, starts the new one, and waits for the `/api` health check to pass. Expect a few seconds of downtime: WebSocket clients reconnect on their own and receive a full state snapshot.
6. **Smoke check** (`scripts/wait-for-api.sh`): polls `GET /api` for up to 5 minutes until it is healthy and, after an API deploy, reports the new commit. Otherwise the run fails before the frontend step.
7. **Frontend**, only when `frontend/` changed: `curl -X POST` to the Cloudflare Pages deploy hook (secret `CLOUDFLARE_PAGES_DEPLOY_HOOK`); the build and its `VITE_*` variables stay in Cloudflare ([frontend-hosting.md](frontend-hosting.md)).
8. The `deployed` tag moves.

Other triggers: a **schedule** (every 15 minutes) re-runs the same logic, so `main` ships once a blocking draft ends (it does nothing when production is current). **Run workflow** on `main` is the manual re-run; it still asks you to tick "I checked" (no live draft) and runs the gate anyway. Runs share one `concurrency` group without cancelling: a newer push replaces a queued older run but never interrupts one that is deploying.

Rules this puts on every PR:

- **Backward compatible for the minutes between steps 5 and 7**: the old UI talks to the new API and database. Migrations are additive, and an endpoint or response field is never removed or renamed in the same PR that stops using it; do that one release later ([CONTRIBUTING.md](../../CONTRIBUTING.md)).
- **A draft could start in the seconds between the gate and the restart.** Accepted: WebSocket clients reconnect and the draft state is persisted server-side.
- A live draft holds back everything merged to `main`, API and UI alike, until it ends.

Why `--ha=false` and `rolling`: `fly deploy` normally creates two machines for high availability, and blue-green runs old and new side by side. Both put two draft clocks on one database, so picks could fire twice. Verify after any deploy that exactly one machine exists:

```bash
fly status --app postszn-api        # one machine, state "started", check "passing"
```

Migrations must be additive (see [CONTRIBUTING.md](../../CONTRIBUTING.md)) because step 4 happens while the old code is still serving.

## Check for live drafts before deploying (or changing secrets)

A restart drops every connected draft room. Check first:

```bash
DATABASE_URL='<session pooler string>' scripts/check-live-drafts.sh
```

or in the Supabase SQL editor:

```sql
select season_id, status from fantasy.drafts
where status in ('lobby', 'in_progress', 'paused');
```

No rows means it is safe. Also glance at upcoming scheduled drafts (`status = 'scheduled'` with a near `start_time`) and do not deploy within an hour of one. `fly secrets set` restarts the machine as well, so the same rule applies to secret changes.

## Secrets

Set once with `fly secrets set` (the wizard does this without putting values in your shell history). Names and meaning: `api/.env.example`.

| Secret | Notes |
| :-- | :-- |
| `PG_URI` | Supabase direct connection (IPv6) first, session pooler (port 5432) as fallback, never port 6543 |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `ADMIN_SUPABASE_UIDS` | Comma-separated user ids; set after the first admin signs in (cutover step 6) |
| `RAPIDAPI_APIKEY`, `RAPIDAPI_BASEURL`, `RAPIDAPI_APIHOST` | Tank01 on RapidAPI |
| `CORS_ORIGINS` | `https://postsznfantasy.com` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional web push, all three or none; see [Step 18](../owner/18-push-notifications.md) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional pictures: the private `avatars` Storage bucket is read and written with it; see [Step 20](../owner/20-avatars.md). Server only, never in the website build |
| `RESEND_API_KEY`, `SUPPORT_EMAIL` | Optional "Report a problem" email, both or it stays off; see [Step 19](../owner/19-support-email.md) |
| `SENTRY_DSN`, `SENTRY_RELEASE` | Optional error tracking, see [sentry.md](sentry.md); empty disables it |
| `SCHEDULER_ENABLED` and `SCHEDULER_*` | Keep `SCHEDULER_ENABLED=false` until games are near. `SCHEDULER_LIVE_POLL_SECONDS` (default 180) has a 60 s floor and `SCHEDULER_ROSTER_SYNC_HOURS` (24) a 1 h floor; the API refuses to start below them, and refuses `SCHEDULER_REPLAY_FILE` when `ENVIRONMENT=production` |

Non-secret settings (`ENVIRONMENT`, `SEASON_YEAR`, `PORT`, `FORWARDED_ALLOW_IPS`, pool sizes) live in `fly.toml`. GitHub repository secrets used by workflows: `FLY_API_TOKEN`, `PROD_DATABASE_URL`, `BACKUP_GPG_PUBLIC_KEY`, `CLOUDFLARE_PAGES_DEPLOY_HOOK` ([owner step 17](../owner/17-ordered-deploy.md)).

## Verify outbound IPv6 to Supabase (once, #104)

The direct connection host `db.<ref>.supabase.co` resolves to IPv6 only on the Free plan. After the first deploy:

```bash
fly ssh console --app postszn-api -C "python -c \"import socket; print(socket.getaddrinfo('db.<project-ref>.supabase.co', 5432, socket.AF_INET6))\""
fly logs --app postszn-api          # no "connection refused" / "network is unreachable" from asyncpg
curl -s https://api.postsznfantasy.com/api   # {"status":"healthy"} (this endpoint queries the database)
```

If the direct connection fails from Fly, switch `PG_URI` to the session pooler string (port 5432) and redeploy. GitHub Actions runners have **no** IPv6, so the CI workflows (`backup.yml`, `deploy.yml`) always use the session pooler string in `PROD_DATABASE_URL`.

## Scheduler logs (#78)

With `SCHEDULER_ENABLED=true` each cycle (every 3 minutes) logs one line: `Scheduler cycle: N polled, M reconciled; RapidAPI calls today X/700, plan requests remaining Y`. `fly logs --app postszn-api | grep "Scheduler cycle"` is the quick look. A warning appears when the plan has fewer than 100 requests left, and Sentry gets one message when the daily cap stops polling. Turning it on or off is a secret change, so the live-draft rule above applies ([owner step 16](../owner/16-scheduler.md)).

## Stopping for the off-season

Use `fly machine stop`, never `fly scale count 0` (that destroys the machine). Steps: [shutdown-runbook.md](shutdown-runbook.md), [wake-up-runbook.md](wake-up-runbook.md).

## Roll back

List releases and note the last good image:

```bash
fly releases --app postszn-api --image
```

Swap the running machine back to that image:

```bash
fly machine update <machine-id> --image registry.fly.io/postszn-api:deployment-<previous-id> --app postszn-api --yes
# machine id: fly status --app postszn-api
```

This restarts the machine, so the live-draft rule applies unless the current release is already broken. It deliberately skips the release command: the database is already at the newer schema, and the older image's Alembic does not know that revision, so `alembic upgrade head` from the old image would fail. This works because migrations are additive: old code runs fine against the newer schema. Do **not** run `alembic downgrade` in production.

The alternative `fly deploy --image <image> --ha=false` also re-runs the release command from the old image, so use it only if you confirm `fly deploy --help` offers a way to skip the release command.

## Not validated without a Fly account

`fly.toml` and the workflow were parsed as TOML/YAML (the workflow also passes `actionlint`, and its scripts were run against stubs and a scratch database; flyctl was not available when this was written). Check on the first real deploy: the `GIT_SHA` build arg reaching `GET /api`, the `deployed` tag push, a blocked run with a live draft,  `fly config validate`, that the release command runs from `/app` (it expects `api/alembic.ini` relative to the working directory), that `--strategy rolling` leaves a single machine, the health check, outbound IPv6, and the `fly machine update --image` rollback command (try it once on a throwaway release before you need it).
