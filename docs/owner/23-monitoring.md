# Step 23: Dashboards and traffic: Metabase, uptime, web analytics

About 40 minutes. Issue #358. Needs Step 4 (Supabase), Step 6 (Fly API) and Step 7 (Cloudflare Pages). [Back to the list](README.md)

You get: charts of leagues, members, signups and drafts (Metabase), a ping if the API dies (uptime), visitor counts (Cloudflare Web Analytics) and error alerts (Sentry). The dashboards read three views that hold **counts only, never emails, names or league names**:

- `fantasy.metrics_daily`: one row per day: `signups`, `leagues_created`, `members_joined`, `drafts_scheduled` (set to start that day), `drafts_started`, `drafts_completed`, `active_members` (people who chatted or acted), `chat_messages`, `push_subscriptions`.
- `fantasy.metrics_leagues`: one row per live league: `members`, `teams`, `claimed_teams`, `open_teams`, `season_year`, `draft_status`, `seasons`, `created_at`.
- `fantasy.metrics_users`: one row per person: `user_id`, `created_at`, `leagues_joined`.

The database role `metrics_reader` is created by the deploy (Step 17) with no password and no login. It can read those three views and nothing else.

## Part A: give the role a password

1. On your computer, in the repo root, open a database shell with the production connection string from your password manager (Step 4): `psql "<connection string>"`.
2. At the prompt type `\password metrics_reader`, then a long new password twice. It is hidden and never stored in the project. Save it in your password manager as `metrics_reader`.
3. Still in psql, type `ALTER ROLE metrics_reader WITH LOGIN;` then `\q`.

On Supabase the pooler needs the project reference in the user name: connect as `metrics_reader.<project ref>` (the ref is in your connection string after `postgres.`), host and port from **Connect**, **Session pooler**, database `postgres`.

## Part B: Metabase

1. Easiest: https://www.metabase.com, **Get started** with Metabase Cloud (the free trial, then the smallest paid plan). Self-hosting works too, but then you keep it updated.
2. **Admin**, **Databases**, **Add database**, **PostgreSQL**: the session pooler host, port, database `postgres`, user `metrics_reader.<project ref>` and the password from Part A. Turn **SSL** on. Save.
3. Save these as questions (**New**, **Question**, pick the view, no SQL needed) and put them on one dashboard:
   - Signups per day (`metrics_daily`, sum of `signups` by `day`)
   - Leagues created per day (`leagues_created`)
   - Leagues by draft status (`metrics_leagues`, count by `draft_status`)
   - Members per league (`metrics_leagues`, count by `members`)
   - Open team slots (`metrics_leagues`, sum of `open_teams`)
   - Leagues joined per user (`metrics_users`, count by `leagues_joined`)
   - Drafts started and completed per day
   - Active members and chat messages per day

## Part C: uptime and errors

- Uptime on `https://api.postsznfantasy.com/api` is [Step 12](12-uptime.md); add a phone alert contact there if you want a text as well as an email.
- Sentry alert rules (scheduler failing, error spike, the Tank01 budget message) are [Step 10, Part B](10-sentry.md#part-b-alert-rules-88).

## Part D: Cloudflare Web Analytics

1. Cloudflare dashboard, **Analytics & Logs**, **Web Analytics**, **Add a site**, pick the Pages project `postszn`, **Done**. (Cloudflare adds its small script to the Pages site by itself.)
2. It sets no cookies. The Privacy page already says so under "Counting visits".

## Verify

- [ ] Metabase connects and `metrics_daily` shows a row for today.
- [ ] In Metabase, a SQL question `SELECT * FROM fantasy.users` fails with "permission denied". (This proves the role cannot see emails.)
- [ ] The dashboard shows your own signup.
- [ ] Web Analytics shows a visit after you open the site.
