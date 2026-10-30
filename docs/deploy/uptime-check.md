# Uptime check on the API (#108)

A free external monitor that requests `https://api.postsznfantasy.com/api` and emails you when it fails. That endpoint runs `select 1` against the database, so a green check means the API is reachable **and** can talk to Supabase. It tells you nothing about errors inside requests (error tracking: [sentry.md](sentry.md)) or about the draft room specifically.

Do this after Stage 3 of the [cutover runbook](cutover-runbook.md); the API must already answer on its public address.

## UptimeRobot (free plan), step by step

1. Go to https://uptimerobot.com and sign up (the free plan needs no card). Confirm your email address.
2. Dashboard: **+ Add New Monitor**.
3. Fill in:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `PostSzn API`
   - URL: `https://api.postsznfantasy.com/api`
   - Monitoring Interval: **5 minutes** (the free-plan minimum).
4. Under **Alert Contacts To Notify**, tick your email address (add it first under My Settings, Alert Contacts, if it is not listed). Enable notifications for both **down** and **up**.
5. **Create Monitor.** Wait one interval; the status should turn **Up**.
6. Check the keyword option if the plan offers it: set it to alert when the page does **not** contain `healthy`. A plain HTTP 200 check is enough otherwise, since the endpoint returns 503 when the database is unreachable.
7. Test the alert: edit the monitor URL to `https://api.postsznfantasy.com/api-does-not-exist`, save, wait for the "Down" email, then set the URL back and confirm the "Up" email.
8. Save the monitor's public status page URL if you want to share one (optional, not required).

Any equivalent free service works (Better Stack, Freshping, Cloudflare health checks): same URL, same alert.

## Reading an alert

| Symptom | First look |
| :-- | :-- |
| Down, 503 | The API runs but Supabase is unreachable or paused: check the Supabase dashboard (a Free project pauses after a week without queries; the weekly backup workflow's keep-alive prevents this) and `fly logs --app postszn-api` |
| Down, timeout or 5xx from Fly | `fly status --app postszn-api`; the machine may have crashed or be restarting (a deploy or secret change restarts it for a few seconds) |
| Down, certificate error | `fly certs show api.postsznfantasy.com --app postszn-api` and the DNS record (proxy must be off) |
| Up but the app is broken | Not covered here; open the site and `fly logs` |

Expect a short "Down" alert during every deploy or `fly secrets set`; that is one more reason to do those outside draft windows.
