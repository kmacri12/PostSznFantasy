# Step 12: uptime monitor

About 10 minutes. Issue #108. Needs Step 7. [Back to the list](README.md)

UptimeRobot (free: 50 monitors, checks every 5 minutes, email alerts, no card) pings the API and emails you if it stops answering.

1. Go to https://uptimerobot.com, sign up, confirm your email.
2. **+ New monitor** (or **Add New Monitor**):
   - Type **HTTP(s)**
   - Friendly name `PostSzn API`
   - URL `https://api.postsznfantasy.com/api`
   - Interval **5 minutes**
   - Notify: your email, on **down** and **up**
3. **Create monitor**.

## Verify

1. After 5 minutes the monitor says **Up**.
2. Test the alert: edit the URL to `https://api.postsznfantasy.com/api-does-not-exist`, save, wait for the **Down** email.
3. Change the URL back, wait for the **Up** email.

Close #108.

Expect a short Down/Up pair every time the API restarts (a deploy or `fly secrets set`). That is normal.

## If it goes wrong

No email: check the email is listed under the account's alert contacts and confirmed.
