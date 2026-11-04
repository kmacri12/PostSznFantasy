# Step 12: uptime monitor

About 10 minutes. Issue #108. Needs Step 7. [Back to the list](README.md) Screens checked 2026-10-30.

UptimeRobot (free: 50 monitors, checks every 5 minutes, email alerts, no card) pings the API and emails you if it stops answering.

1. Go to https://uptimerobot.com, sign up, confirm your email.
2. **+ New monitor** (or **Add New Monitor**):
   - Type **HTTP(s)**
   - Friendly name `PostSzn API`
   - URL `https://api.postsznfantasy.com/api`
   - Interval **5 minutes**
   - Leave the request method as it is: the free plan checks with HEAD (choosing GET is a paid feature) and the API answers HEAD on that URL
   - Notify: your email, on **down** and **up** (if your email is not listed, add it under **My Settings**, **Alert Contacts** first)
3. **Create monitor**.

## Verify

1. After 5 minutes the monitor says **Up**.
2. Test the alert: edit the URL to `https://api.postsznfantasy.com/api-does-not-exist`, save, wait for the **Down** email.
3. Change the URL back, wait for the **Up** email.

Close #108.

Expect a short Down/Up pair every time the API restarts (a deploy or `fly secrets set`). That is normal.

## If it goes wrong

What a Down alert means and where to look first: [docs/deploy/uptime-check.md](../deploy/uptime-check.md#reading-an-alert).

No email: check the email is listed under the account's alert contacts and confirmed.
