# Step 10: Sentry error tracking and alerts

About 40 minutes. Issues #85 (projects) and #88 (alerts). Needs Step 7. [Back to the list](README.md)

Sentry emails you when the app breaks. The code is already in and does nothing until it has a **DSN** (a project's send-to address). Background: [docs/deploy/sentry.md](../deploy/sentry.md).

## Part A: account and projects (#85)

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/sentry-setup.sh
```

1. **Account**: it opens https://sentry.io/signup/. Sign up (the free **Developer** plan is enough), verify your email, and name the organization `postszn`. Type `postszn` when the script asks for the organization slug.
2. **Frontend project**: platform **React**, name `postszn-frontend`, **Create Project**. When it shows setup code, change nothing and stop on that page. Type the slug when asked (likely `postszn-frontend`).
3. **Frontend DSN**: the script opens **Client Keys (DSN)**. Copy the DSN (`https://<key>@o<id>.ingest...sentry.io/<id>`) and paste it.
4. **Backend project**: platform **FastAPI**, name `postszn-api`. Same as above: slug, then copy and paste its DSN.
5. The script writes both DSNs to a local file outside the repo. **Installing them is up to you:**
   - API (restarts it for a few seconds; never during a live draft):
     ```bash
     fly secrets set SENTRY_DSN='<postszn-api DSN>' --app postszn-api
     ```
   - Site: Cloudflare, project `postszn`, **Settings**, **Variables and Secrets**, **Production**, add `VITE_SENTRY_DSN` = the frontend DSN. Then **Deployments**, latest, **Retry deployment**.

## Part B: alert rules (#88)

Sentry redesigned alerts in 2026: they now live under **Monitors**, **Alerts**. Create each one like this:

1. **Monitors**, **Alerts**, **Create Alert**.
2. Source: **Alert on all issues in selected projects**, project `postszn-api`.
3. Environment: `production`.
4. **When**: **An event or issue activity is captured**.
5. **If**: the filters below, qualifier **all**.
6. **Then**: **Notify on preferred channel**, **Member**, you. (It emails you.)
7. **Throttling**: as below.
8. Click the name at the top, type the name below, **Create Alert**. Then **Send Test Notification**.

The rules:

1. **Scheduler failing**
   - If: **Tagged event** `logger` equals `api.services.scheduler`; **Number of events** more than `3` in `10 minutes`
   - Throttling: `30 minutes`
2. **Draft clock failing**
   - If: **Tagged event** `logger` equals `api.services.draft_clock`; **Number of events** more than `2` in `5 minutes`
   - Throttling: `5 minutes`
3. **Draft API errors**
   - If: **Tagged event** `transaction` contains `/api/drafts`; **Number of events** more than `2` in `5 minutes`
   - Throttling: `5 minutes`
4. **Tank01 budget spent**
   - If: **Event attribute** `message` contains `Tank01 daily request budget spent` (no frequency filter)
   - Throttling: `24 hours`

Do **not** create an UptimeRobot keyword monitor on `/api/players/sync-status`. That page needs a login, so it can never work. Rule 4 replaces it.

## Verify

- Both projects exist, and `fly secrets list --app postszn-api` lists `SENTRY_DSN`.
- Open https://postsznfantasy.com. In Sentry, the `postszn-frontend` project's setup page turns green (or any real error shows up). Open one event: it shows **no** email address or user.
- The four alerts exist under **Monitors**, **Alerts**, and each test notification reached your inbox.

Close #85 and #88.

## If it goes wrong

- No events arrive: the DSN belongs to the other project, or the site was not redeployed after adding `VITE_SENTRY_DSN`.
- A filter name differs on screen: pick the closest match. The intent is "events whose `logger` tag is X, more than N in M minutes". Tell the coordinator the exact wording so this page can be fixed.
