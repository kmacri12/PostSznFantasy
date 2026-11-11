# Step 19: Turn on "Report a problem" email

20 minutes. Issue #296. Needs Step 6 (the API on Fly), Step 3 (the domain on Cloudflare) and Step 9 (Resend with `postsznfantasy.com` verified). [Back to the list](README.md)

More, **Report a problem** emails what a member writes, their screenshots and (optionally) diagnostic info to `support@postsznfantasy.com`. The reply-to is the member's account email, so you answer from your inbox. Nothing is stored by the app. More, **Send feedback** (an optional 1 to 5 rating plus "what was good" and "what was bad") uses the same two secrets and arrives in the same inbox as `[PostSzn feedback] 4/5`, with no name, email or id and no reply-to (#410); it has its own limit of 5 an hour per member. Without the two Fly secrets below the row still shows, but sending says problem reports are not set up yet.

Resend's free plan is **100 emails a day, shared with sign-in codes** (Step 9). The app lets each member send 5 reports an hour; on a busy launch day watch the Resend dashboard, **Emails**, for the count.

## 1. Make the support mailbox exist

Cloudflare Email Routing forwards `support@` to your own inbox, free:

1. Cloudflare dashboard, `postsznfantasy.com`, **Email**, **Email Routing**, **Get started**. Let it add its MX and TXT records (it asks before touching DNS).
2. **Destination addresses**: add your real inbox and click the verification link Cloudflare emails you.
3. **Routing rules**, **Create address**: custom address `support`, action **Send to an email**, destination your inbox. Save.

Resend's records live on the `send` and `resend._domainkey` names, so they do not clash with Email Routing's MX on the root. If Cloudflare warns about an existing MX or SPF record, stop and ask the coordinator.

## 2. A second Resend API key

Reuse the Resend account and verified domain from Step 9, but a separate key so you can revoke one without breaking the other:

1. https://resend.com/api-keys, **Create API Key**.
2. Name `api-support`, permission **Sending access**, domain `postsznfantasy.com`.
3. It is shown once. Copy it into your password manager; never paste it in a chat or file.

## 3. Set the Fly secrets

Not during a live draft (changing a secret restarts the API). Check first:

```bash
cd ~/code/PostSznFantasy
DATABASE_URL='<session pooler string>' scripts/check-live-drafts.sh
```

```bash
fly secrets set RESEND_API_KEY='<the api-support key>' SUPPORT_EMAIL='support@postsznfantasy.com' --app postszn-api
```

The sender is `PostSzn Support <no-reply@postsznfantasy.com>`; change it only through the optional `SUPPORT_FROM_EMAIL` secret, and only to an address on the verified domain.

## Verify

1. On https://postsznfantasy.com sign in, open a league, **More**, **Report a problem**.
2. Type a message, attach one screenshot, leave **Include diagnostic info** ticked, open **What's included**, and **Send**. You see "Sent. We'll reply by email."
3. Within a minute the email arrives in your inbox, from `no-reply@postsznfantasy.com`, with the screenshot attached and the diagnostics below your message.
4. **Reply** to it: the reply goes to the email you signed in with.

Close #296.

## If it goes wrong

- The modal says "Problem reports are not set up yet": the secrets are missing; `fly secrets list --app postszn-api` must list `RESEND_API_KEY` and `SUPPORT_EMAIL`.
- "We couldn't send your report": `fly logs --app postszn-api` shows `Support email rejected by Resend: HTTP <status>`. 401 or 403 is a wrong or revoked key, 422 is usually a sender address off the verified domain, 429 is the daily limit. Paste the line (not the key) to the coordinator.
- The email never arrives but the app said "Sent": check Resend, **Emails**, for the delivery status, then Cloudflare, **Email Routing**, **Activity log**.
- Someone says "5 reports in the last hour": that is the limit; it clears an hour after their first of the five.
