# API on Fly.io

One always-on 1 GB machine runs `uvicorn api.main:app --workers 1 --proxy-headers` (the WebSocket rooms and the draft clock are in-process, so there is exactly one process unless `DRAFT_BROADCAST=postgres`, see [api-decisions](../api-decisions.md)). Config: [`fly.toml`](../../fly.toml). Image: [`Dockerfile`](../../Dockerfile). Account, app and secrets walkthrough: `scripts/wizards/fly-setup.sh`.

## How a deploy works

1. Run the **Deploy API** workflow by hand (Actions tab, "Run workflow"). It only exists as `workflow_dispatch`: nothing deploys on push.
2. The workflow refuses to run unless you tick "I checked", and it runs `scripts/check-live-drafts.sh` itself and fails if any draft is in `lobby`, `in_progress` or `paused`.
3. `flyctl deploy --ha=false --strategy rolling` builds the image on Fly's builder.
4. Fly starts a temporary machine from the new image and runs the release command `alembic -c api/alembic.ini upgrade head`. **If it exits non-zero the deploy stops here and the current machine keeps serving the old version.** Migrations run in one transaction, so a failed one leaves the schema untouched.
5. Fly stops the old machine, starts the new one, and waits for the `/api` health check (database round trip) to pass. Expect a few seconds of downtime: WebSocket clients reconnect on their own and receive a full state snapshot.

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
| `SENTRY_DSN`, `SENTRY_RELEASE` | Optional error tracking, see [sentry.md](sentry.md); empty disables it |
| `SCHEDULER_ENABLED` and `SCHEDULER_*` | Keep `SCHEDULER_ENABLED=false` until games are near |

Non-secret settings (`ENVIRONMENT`, `SEASON_YEAR`, `PORT`, `FORWARDED_ALLOW_IPS`, pool sizes) live in `fly.toml`. GitHub repository secrets used by workflows: `FLY_API_TOKEN`, `PROD_DATABASE_URL`, `BACKUP_GPG_PUBLIC_KEY`.

## Verify outbound IPv6 to Supabase (once, #104)

The direct connection host `db.<ref>.supabase.co` resolves to IPv6 only on the Free plan. After the first deploy:

```bash
fly ssh console --app postszn-api -C "python -c \"import socket; print(socket.getaddrinfo('db.<project-ref>.supabase.co', 5432, socket.AF_INET6))\""
fly logs --app postszn-api          # no "connection refused" / "network is unreachable" from asyncpg
curl -s https://api.postsznfantasy.com/api   # {"status":"healthy"} (this endpoint queries the database)
```

If the direct connection fails from Fly, switch `PG_URI` to the session pooler string (port 5432) and redeploy. GitHub Actions runners have **no** IPv6, so the CI workflows (`backup.yml`, `deploy-api.yml`) always use the session pooler string in `PROD_DATABASE_URL`.

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

`fly.toml` and the workflow were parsed as TOML/YAML only (flyctl was not available when this was written). Check on the first real deploy: `fly config validate`, that the release command runs from `/app` (it expects `api/alembic.ini` relative to the working directory), that `--strategy rolling` leaves a single machine, the health check, outbound IPv6, and the `fly machine update --image` rollback command (try it once on a throwaway release before you need it).
