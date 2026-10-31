# Shutdown runbook: going dormant after the playoffs (#111)

Run this about a month after the Super Bowl, once leagues are final and nobody is mid-draft. End state: Cloudflare Pages serves the static shell, the Fly machine is stopped, the database is kept, the scheduler and paid NFL data plan are off. The frontend notices the dead API at load and shows the "back for the next postseason" page ([frontend-hosting.md](frontend-hosting.md#dormant-mode-off-season-or-outage)).

Who runs it: **you (the owner)**. The steps marked **OWNER** need your Fly, Supabase, GitHub, RapidAPI or UptimeRobot login. Nobody else can do them. Do the steps in order; each ends with a **Verify** line, and a step is done only when it passes. Reverse it with the [wake-up runbook](wake-up-runbook.md). Never paste a secret into chat, a ticket or this repository.

Tools: `git`, `gh`, `flyctl` (`fly auth login`), `psql` and `pg_dump` **17**, `gpg` with the backup private key (see [backup.md](backup.md)). Set once per terminal:

```bash
export FLY_APP=postszn-api
read -rsp 'Session pooler string: ' DATABASE_URL && export DATABASE_URL   # keeps it out of shell history
```

## Before you start

- [ ] The season is over and the commissioners have what they need from the leagues.
- [ ] No draft is live. Run, with the Supabase **session pooler** string:

```bash
scripts/check-live-drafts.sh
```

**Verify:** prints `No live drafts.`

## 1. Final database dump, kept outside GitHub (OWNER)

Workflow artifacts expire after 90 days, so the last dump must live somewhere else.

```bash
gh workflow run backup.yml
sleep 10 && gh run list --workflow backup.yml --limit 1      # note the run id; wait for "completed success"
gh run download <run-id> --name postszn-backup-<run-id> --dir final-dump
sha256sum final-dump/*.dump.gpg > final-dump/SHA256SUMS
```

Copy the whole `final-dump/` folder to two places that are not GitHub: your password manager or encrypted cloud drive, and an offline copy. The file is gpg-encrypted to your public key; the private key and passphrase stay where [backup.md](backup.md) says. Test it now with a scratch database (never production):

```bash
createdb -h localhost -p 5433 -U postgres final_check
scripts/restore-backup.sh \
  final-dump/postszn-<timestamp>.dump.gpg \
  postgresql://postgres:postgres@localhost:5433/final_check
```

**Verify:** the restore prints `restored, alembic revision <latest>`, the two stored copies match `sha256sum -c SHA256SUMS`, then `dropdb -h localhost -p 5433 -U postgres final_check`.

Note: the dump holds the `public`, `nfl` and `fantasy` schemas. **Sign-in accounts live in Supabase Auth and are not in it.** See step 4.

## 2. Turn the scheduler off and confirm nothing is running (OWNER)

The machine has to be running for this step, because a secret change restarts it.

```bash
fly secrets set SCHEDULER_ENABLED=false --app "$FLY_APP"
fly logs --app "$FLY_APP" --no-tail | tail -n 40
```

**Verify:** the secret is listed (`fly secrets list --app "$FLY_APP"` shows `SCHEDULER_ENABLED`; values are hidden by design) and the logs after the restart contain no `Background scheduler started` line (that line is printed only when the scheduler is on): `fly logs --app "$FLY_APP" --no-tail | grep -c 'Background scheduler started'` counts old lines too, so read only the ones after the restart. If it was already `false` all season, you may skip the set, but still read the logs.

## 3. Stop the Fly machine (OWNER)

Stop it, do **not** scale to 0 or destroy the app: `fly scale count 0` deletes the machine and its config, while a stopped machine keeps both and only bills its root filesystem ([Fly pricing](https://docs.fly.io/about/pricing/): $0.15 per GB per month while stopped).

```bash
fly machine list --app "$FLY_APP"          # copy the machine ID
fly machine stop <machine-id> --app "$FLY_APP"
```

`fly.toml` has `auto_start_machines = false`, so no request wakes it. Do not run **Deploy API** while dormant: a deploy replaces and starts the machine.

**Verify:** `scripts/dormancy-check.sh dormant` shows `PASS no machine running`. (The same script covers step 6.)

## 4. Supabase: keep it active (recommended) or pause it (OWNER)

Both cost $0 on the Free plan. Pick one and write it down in step 7.

**Option A, keep active (recommended).** Leave the **Weekly backup** workflow enabled. Its Monday keep-alive query stops Supabase auto-pausing the project, and you keep getting fresh dumps. Nothing to do; the repository is private, so GitHub does not disable the schedule for inactivity (that rule is for public repositories).

**Option B, pause.**

1. Disable the weekly workflow first, or it fails every Monday: `gh workflow disable backup.yml`.
2. Pause from the dashboard: Project Settings, General, "Pause project". Supabase also auto-pauses a Free project after a week of low activity.
3. Know the risk. Supabase's docs disagree on how long a paused project can be restored: [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) says 1 year, another page says 90 days. Do not count on it for a whole off-season.
4. If it is gone, the wake-up runbook restores the dump into a new project. **Auth users do not come back with a dump.** Every player would sign up again, and old leagues would not link to the new account (the dump keys users by their old Supabase user id).

**Verify:** Option A: `gh workflow list` shows `Weekly backup  active`. Option B: the dashboard shows "Paused" and `gh workflow list` shows it disabled.

## 5. Cancel the Tank01 paid plan (OWNER)

On rapidapi.com, sign in, open your Tank01 NFL API subscription (Hub, "My Apps", the app's Billing/Subscriptions page; RapidAPI moves these menus, so look for the plan "Pro") and switch it to the free **Basic** plan or unsubscribe. Basic is a hard cap of 1,000 requests per month; nothing calls Tank01 while the API is stopped. Keep the same RapidAPI app so the key and `RAPIDAPI_APIKEY` secret stay valid for next season ([rapidapi-quota.md](../research/rapidapi-quota.md)).

**Verify:** the RapidAPI billing page shows no paid NFL plan and no upcoming charge. Screenshot it with account and card details cropped out, and keep it with the dump.

## 6. Pause the alerts and confirm the shell and dormant page (OWNER, then check)

The uptime monitor will email every five minutes otherwise. In UptimeRobot, open the `PostSzn API` monitor and **Pause** it ([uptime-check.md](uptime-check.md)). Sentry stays quiet with no API.

```bash
scripts/dormancy-check.sh dormant
```

Then open `https://postsznfantasy.com` in a private window, on your phone too.

**Verify:** the script prints only PASS lines (static shell 200, deep link 200, API not answering, machine stopped); the browser shows "We're back for the next postseason", the How it works section, and **How to play** still opens. If the browser shows the normal app instead, hard-reload once (the build must include #110).

## 7. Record the off-season cost and what still runs

Fill this in and commit it, or keep it in your notes. Do not include secrets.

- Cloudflare Pages shell: up, $0.
- Domain `postsznfantasy.com`: registered; annual fee divided by 12 (fill in).
- Fly machine: stopped; $0.15 per GB of root filesystem per month (read the size from the invoice).
- Fly IPs and certificates: shared IPv4 is free and the first 10 certificates are free. A dedicated IPv4 costs $2 (`fly ips list`).
- Supabase: active (A) or paused (B), $0.
- Tank01: Basic or cancelled, $0.
- GitHub Actions: weekly backup (A) or off (B), $0.
- UptimeRobot and Sentry: paused or idle, $0.

Add the total and the date under the list.

**Verify:** you can name every service that is still running and its cost; the first Fly invoice after shutdown matches (check it once).

## What counts as done

All seven steps verified, the final dump stored in two places outside GitHub and restore-tested, and the cost table filled in. If a step went differently from this page, fix this page in the same pull request.
