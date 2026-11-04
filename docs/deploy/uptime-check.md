# Uptime check on the API (#108)

A free external monitor that requests `https://api.postsznfantasy.com/api` and emails you when it fails. That endpoint runs `select 1` against the database, so a green check means the API is reachable **and** can talk to Supabase. It tells you nothing about errors inside requests (error tracking: [sentry.md](sentry.md)) or about the draft room specifically.

Do this after Stage 3 of the [cutover runbook](cutover-runbook.md); the API must already answer on its public address.

## Setting it up

Click-by-click: [docs/owner/12-uptime.md](../owner/12-uptime.md) (UptimeRobot free plan: 50 monitors, 5-minute checks, email alerts). The free plan can only send HEAD requests (GET is a paid feature), so do not change the method; `/api` answers HEAD with the same status and headers as GET, no body. The endpoint returns 503 when the database is unreachable, so a plain HTTP check is enough; a keyword check for `healthy` is optional. Any equivalent free service works (Better Stack, Cloudflare health checks): same URL, same alert.

## Reading an alert

| Symptom | First look |
| :-- | :-- |
| Down, 503 | The API runs but Supabase is unreachable or paused: check the Supabase dashboard (a Free project pauses after a week without queries; the weekly backup workflow's keep-alive prevents this) and `fly logs --app postszn-api` |
| Down, timeout or 5xx from Fly | `fly status --app postszn-api`; the machine may have crashed or be restarting (a deploy or secret change restarts it for a few seconds) |
| Down, certificate error | `fly certs show api.postsznfantasy.com --app postszn-api` and the DNS record (proxy must be off) |
| Up but the app is broken | Not covered here; open the site and `fly logs` |

Expect a short "Down" alert during every deploy or `fly secrets set`; that is one more reason to do those outside draft windows.
