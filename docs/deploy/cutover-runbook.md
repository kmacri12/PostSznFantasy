# Production cutover runbook

First launch of PostSzn Fantasy, from local-only to live. Follow the stages in order. Every stage has: what to do, **go/no-go** checks (do not start the next stage until every box is true), and a **rollback**.

You do not need to know the code. You need: the GitHub repository (admin), a terminal with `git`, `gh`, `flyctl` and `psql`, and accounts for Supabase, Fly.io, Cloudflare (the domain `postsznfantasy.com` registered there or transferable) and RapidAPI. Stages 2 to 4 have a guided script in `scripts/wizards/`; run it from the repository root. The scripts never ask you to paste secrets into them or into chat: secrets go straight into the provider's dashboard or `fly secrets`.

## The stack and the rules

| Piece | Where | Address |
| :-- | :-- | :-- |
| Frontend (static) | Cloudflare Pages | `https://postsznfantasy.com` |
| API | Fly.io, one always-on 1 GB machine | `https://api.postsznfantasy.com` |
| Database and sign-in | Supabase Free (Postgres 17) | `https://<project-ref>.supabase.co` |
| NFL data | Tank01 on RapidAPI | called only by admin actions and the scheduler |

Rules that must hold at every step:

1. **One API machine, one worker.** Draft rooms and the draft clock live in that process. Never scale it up or add a second machine.
2. **No API deploy, restart or `fly secrets set` during a live draft** (it disconnects everyone). Run `scripts/check-live-drafts.sh` first. Before launch there are no drafts, so this only starts to matter at Stage 8.
3. **Migrations are additive** (see CONTRIBUTING.md) and run automatically as the deploy's release step; a failed migration stops the deploy and the old version keeps running.
4. **One environment, no staging.** Everything you do touches real data.
5. Never put a secret in a chat, a ticket, a commit or this repository.

Related docs: [fly.md](fly.md), [frontend-hosting.md](frontend-hosting.md), [backup.md](backup.md), [uptime-check.md](uptime-check.md), `api/.env.example`, `frontend/.env.example`.

---

## Stage 1: Code is ready (#23 Postgres 17 locally, #103 Dockerfile)

**Do**
- Make sure `main` contains the Postgres 17 change (compose uses `postgres:17-alpine`) and the Dockerfile, `fly.toml` and the workflows under `.github/workflows/` (`docker-build.yml`, `deploy-api.yml`, `backup.yml`).
- Locally: `make check` passes; `docker build -t postszn-api:local .` succeeds.

**Go / no-go**
- [ ] CI is green on `main`, including the "Docker build" workflow (builds the image, runs migrations on Postgres 17, passes the container health check).
- [ ] `make check` passes on your machine.
- [ ] You can name the person who is allowed to deploy and the person who monitors during launch.

**Rollback:** nothing external exists yet. Fix forward on a branch.

---

## Stage 2: Supabase production project and first migration (#105)

**Do** (guided: `scripts/wizards/supabase-prod.sh`)
- Create the project on the Free plan in the region closest to your users. Confirm in the dashboard (Settings, Infrastructure) that Postgres is **17**. Note the project ref.
- Save the database password in your password manager.
- Auth: set Site URL `https://postsznfantasy.com` and add redirect URL `https://postsznfantasy.com/**`. Production Google OAuth (#91) and custom SMTP (#67) have their own wizards and can finish later, but sign-in testing at Stage 8 needs at least one working sign-in method.
- Copy the connection strings: **direct** (`db.<ref>.supabase.co:5432`, IPv6) and **session pooler** (port 5432, IPv4). **Never the transaction pooler on port 6543.**
- Run the first migration from your machine against the production database (use the connection that works from your network: direct needs IPv6, otherwise the session pooler):

```bash
cd api
PG_URI='<production connection string>' SUPABASE_URL='https://<ref>.supabase.co' uv run alembic upgrade head
psql '<production connection string>' -c 'select version_num from public.alembic_version'   # expect the latest revision
```

- Check the database size limit (500 MB on Free) against expected data; a season of data should be far below it.

**Go / no-go**
- [ ] Dashboard shows Postgres 17, region noted.
- [ ] `alembic_version` holds the latest revision; the `fantasy` and `nfl` schemas exist.
- [ ] Site URL and redirect URL are set.
- [ ] Both connection strings are stored in your password manager (not in a file in this repo).

**Rollback:** the project holds no live data yet. Reset it: Supabase SQL editor, `drop schema fantasy, nfl cascade; drop table public.alembic_version;`, then re-run `alembic upgrade head`; or delete the project and start Stage 2 again. Never use `alembic downgrade` once real users exist.

---

## Stage 3: Fly app, secrets and first deploy (#104)

**Do** (guided: `scripts/wizards/fly-setup.sh`)
- Install `flyctl`, `fly auth login` (a card is required on the account).
- Create the app named in `fly.toml`: `fly apps create postszn-api`.
- Set the secrets listed in [fly.md](fly.md) and `api/.env.example` (`PG_URI`, `SUPABASE_URL`, `RAPIDAPI_*`, `CORS_ORIGINS=https://postsznfantasy.com`, `SCHEDULER_ENABLED=false`). Leave `ADMIN_SUPABASE_UIDS` empty for now.
- Add GitHub repository secrets `FLY_API_TOKEN` and `PROD_DATABASE_URL` (session pooler string).
- In GitHub, Actions, **Deploy API**, Run workflow, tick the "I checked" box. It checks for live drafts, runs the release migration, then starts the machine.
- Confirm exactly one machine: `fly status --app postszn-api`.

**Go / no-go**
- [ ] The workflow run is green (release command "alembic upgrade head" succeeded in its log).
- [ ] `curl -s https://postszn-api.fly.dev/api` returns `{"status":"healthy"}` (this endpoint queries the database, so it also proves the Supabase connection and outbound IPv6).
- [ ] `fly status` shows one machine, check passing.
- [ ] `fly logs` shows no repeated connection errors.

**Rollback:** `fly apps destroy postszn-api` (nothing depends on it yet). If only the latest release is bad, see "Roll back" in [fly.md](fly.md). If the direct database connection is unreachable from Fly, set `PG_URI` to the session pooler string and redeploy.

---

## Stage 4: Cloudflare Pages, domain and DNS (#106, #92)

**Do** (guided: `scripts/wizards/cloudflare-pages.sh`)
- Create the Pages project from the GitHub repository: production branch `main`, root directory `frontend`, build command `npm ci && npm run build`, output `dist`, build variable `NODE_VERSION=22.12`.
- Add the build variables (production): `VITE_API_URL=https://api.postsznfantasy.com`, `VITE_WS_URL=wss://api.postsznfantasy.com`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Trigger a new deployment so the build picks them up.
- Custom domain `postsznfantasy.com` on the Pages project.
- API domain: `fly certs add api.postsznfantasy.com --app postszn-api`, then create the DNS record Fly prints (an `A`/`AAAA` pair or a `CNAME`) in Cloudflare with the **proxy OFF (grey cloud, "DNS only")** so WebSockets and the certificate work. Wait for `fly certs show api.postsznfantasy.com --app postszn-api` to say the certificate is issued.

**Go / no-go**
- [ ] `curl -s https://api.postsznfantasy.com/api` returns `{"status":"healthy"}` over valid HTTPS.
- [ ] `https://postsznfantasy.com` loads, and a deep link such as `https://postsznfantasy.com/league/1` loads the app (not a 404).
- [ ] In the browser developer tools (Network), page requests go to `api.postsznfantasy.com`, and there are no CORS errors in the console.
- [ ] Preflight check: `curl -si -X OPTIONS https://api.postsznfantasy.com/api/config -H 'Origin: https://postsznfantasy.com' -H 'Access-Control-Request-Method: GET' | grep -i access-control-allow-origin` shows `https://postsznfantasy.com`.
- [ ] WebSocket reachability: `curl -si --max-time 5 https://api.postsznfantasy.com/api/drafts/ws/1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='` shows `HTTP/1.1 101` (curl then waits for the socket until the timeout), not a Cloudflare or proxy error page. The full WebSocket check is the mock draft in Stage 8.

**Rollback:** in Cloudflare Pages, Deployments, pick the last good deployment, "Rollback to this deployment" (instant, no rebuild). For DNS problems delete the `api.` record (`fly certs remove api.postsznfantasy.com --app postszn-api` if needed); the site keeps working at `*.pages.dev` apart from API calls. Nothing is public to users until you announce the URL.

---

## Stage 5: Seed NFL data (#71 first)

This **spends RapidAPI quota**. Before running it, confirm with the owner which plan is active and the budget from #71 (Basic is a hard cap of 1,000 requests a month; Pro is 1,000 a day). A default seed is a few dozen to a few hundred calls; read the end of its output for the remaining quota.

**Do**

```bash
fly ssh console --app postszn-api -C "python -m api.scripts.seed_nfl_data --season 2026"
```

(Add `--with-box-scores` only if games have been played; `--no-stats` skips season stats.) It fails loudly if teams, players or stats come back empty.

**Go / no-go**
- [ ] The command printed non-zero counts for teams (32), players and stats, and the remaining quota is acceptable.
- [ ] `psql '<connection>' -c 'select count(*) from nfl.teams'` is 32 and players are in the thousands.
- [ ] The app's player list page shows players with fantasy points.

**Rollback:** the seed is an idempotent upsert; re-running is safe. To start over: `truncate` the `nfl` tables in the SQL editor (nothing else references them before leagues exist). Spent quota cannot be undone.

---

## Stage 6: Admin user and the scheduler (#78)

**Do**
1. Sign in once at `https://postsznfantasy.com` with the account that will administer the app. In the Supabase dashboard, Authentication, Users, copy that user's **UID**.
2. Make sure no draft is live (`DATABASE_URL='<pooler string>' scripts/check-live-drafts.sh`), then: `fly secrets set ADMIN_SUPABASE_UIDS=<uid> --app postszn-api` (this restarts the machine).
3. Confirm admin works: the admin "Refresh now" control is visible when `VITE_ADMIN_SUPABASE_UIDS` is also set to that UID (optional hint), and `/api/admin/*` returns 403 for non-admins.
4. **Leave `SCHEDULER_ENABLED=false`** until playoff games are about to start. It polls RapidAPI on a timer and every tick can cost quota; the roster refresh and live scores run only while it is on. Turn it on (same secret-change rule: no live draft) with `fly secrets set SCHEDULER_ENABLED=true --app postszn-api` and turn it off again after the last game of the week. The daily request budget guard (`RAPIDAPI_DAILY_REQUEST_LIMIT`, default 700) is in place; confirm the plan limit in #71 first, and watch the `RapidAPI call N/700 today` log lines on the first game day.

**Go / no-go**
- [ ] Admin account works; a non-admin account gets 403 from an admin endpoint.
- [ ] `fly secrets list --app postszn-api` shows `ADMIN_SUPABASE_UIDS` and `SCHEDULER_ENABLED` (values are hidden by design); logs show no scheduler activity while it is false.

**Rollback:** `fly secrets set SCHEDULER_ENABLED=false` stops spending quota; `fly secrets unset ADMIN_SUPABASE_UIDS` removes admin access. Both restart the machine.

---

## Stage 7: Backups and uptime monitoring (#107, #108)

**Do**
- Backup: follow "One-time setup" in [backup.md](backup.md) (generate the key pair, add `BACKUP_GPG_PUBLIC_KEY` and `PROD_DATABASE_URL`), run the **Weekly backup** workflow by hand, download the artifact, and do one test restore into a scratch database.
- Uptime: follow [uptime-check.md](uptime-check.md) (a short web form, no wizard) to watch `https://api.postsznfantasy.com/api` with an email alert.

**Go / no-go**
- [ ] A backup run is green and an artifact `postszn-backup-<run id>` exists.
- [ ] The test restore printed `restored, alembic revision <latest>`.
- [ ] The private key and its passphrase are in your password manager.
- [ ] The monitor shows "Up", and the test alert email arrived.

**Rollback:** disable the workflow (Actions, Weekly backup, "..." menu, Disable workflow) and pause the monitor. Neither affects users.

---

## Stage 8: Smoke test with real sign-in and a mock draft (feeds #95)

Do this with at least two real accounts (two browsers or a phone and a laptop). Make no announcement before it passes.

**Do**
1. Sign in with Google (or the configured method) on `https://postsznfantasy.com`; confirm your name shows and a reload keeps you signed in. Sign out and in again.
2. Create a league; invite a second account through the invite link; the second account joins.
3. Open the draft room as both accounts. Start a mock draft with a short pick timer. Both screens must show the same board; make picks from both accounts; let one timer run out and confirm the auto-pick fires; the pick clock stays correct after you reload one screen mid-draft. This exercises the WebSocket at `wss://api.postsznfantasy.com`.
4. Open standings and a team page; they load without errors.
5. On a phone, repeat steps 1 and 3 quickly (the app is mostly used on phones).
6. Delete the test league afterwards, or keep it clearly named "TEST".

**Go / no-go (launch)**
- [ ] Sign-in, reload, sign-out work for two accounts.
- [ ] A full mock draft completes with picks visible live on both screens and one auto-pick.
- [ ] Standings render.
- [ ] No errors in `fly logs --app postszn-api` during the test beyond expected 4xx responses.
- [ ] Uptime monitor still green; backup workflow exists.
- [ ] Run through the launch checklist in #95.

**Rollback (launch)**
- Frontend problem: Cloudflare Pages, roll back to the previous deployment.
- API problem: roll back the Fly release (see [fly.md](fly.md)); schema changes are additive so the older image still works.
- Data problem: restore the latest backup into a fresh Supabase project (see [backup.md](backup.md)), then change `PG_URI` and restart.
- Total stop: put the site in maintenance by pointing nothing at it: disable the Pages custom domain, and `fly scale count 0 --app postszn-api` only if no one is mid-draft.

---

## After launch: standing rules

- Before any deploy or secret change: `scripts/check-live-drafts.sh`. Only deploy through the **Deploy API** workflow.
- The final shutdown dump after the Super Bowl (#111) is stored outside GitHub artifacts.
- If anything here turned out wrong or unclear for you, fix this file in the same pull request as your change.
