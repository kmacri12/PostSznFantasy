# Step 9: email so magic links reach inboxes

About 30 minutes, then DNS can take minutes to hours. Issue #67. Needs Steps 3, 4 and 7. [Back to the list](README.md) Screens checked 2026-10-30.

Why: Supabase's built-in email only sends to members of your Supabase organization, at most 2 an hour. Friends get no magic link until this is done. We send from your own domain through Resend (free: 3,000 emails a month, 100 a day).

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/custom-smtp.sh
```

It first asks: domain `postsznfantasy.com`, From name `PostSzn Fantasy`, From address `no-reply@postsznfantasy.com`, your Supabase ref.

1. **Resend account**: it opens https://resend.com/signup. Sign up and verify your email.
2. **Add the domain**: https://resend.com/domains, **Add Domain**, `postsznfantasy.com`, region `us-east-1`.
3. **DNS records.** Easiest: on the Resend domain page click **Sign in to Cloudflare** and approve. It adds the records for you. If you add them by hand instead (Cloudflare, `postsznfantasy.com`, **DNS**, **Records**, **Add record**), copy each row from Resend exactly, typing only the short name:
   - **MX** on `send`, priority `10` (value from Resend)
   - **TXT** on `send` (starts `v=spf1 include:amazonses.com`)
   - **TXT** on `resend._domainkey` (long value starting `p=`), **DNS only**
4. **DMARC** (by hand either way): **TXT** on `_dmarc` with value
   `v=DMARC1; p=none; rua=mailto:no-reply@postsznfantasy.com`
5. In Resend click **Verify DNS Records**. Wait for **Verified** (usually quick, up to 72 hours).
6. **API key**: Resend, **API Keys**, **Create API Key**. Name `supabase-auth-prod`, permission **Sending access**, domain `postsznfantasy.com`. It is shown once: keep the window open.
7. **Supabase SMTP**: project `postszn-prod`, **Authentication**, **Emails**, **SMTP Settings**. Turn on custom SMTP:
   - Sender email `no-reply@postsznfantasy.com`, sender name `PostSzn Fantasy`
   - Host `smtp.resend.com`, port `465`, username `resend`
   - Password: the Resend API key. **Save.**
8. **Rate limit**: Supabase starts custom SMTP at 30 emails an hour. **Authentication**, **Rate Limits**: raise the email limit to `100` an hour (Resend's daily cap is 100, so more buys nothing).

## Verify

1. On https://postsznfantasy.com, sign out, then request a magic link to a Gmail address you own.
2. The email arrives in the **inbox**, not spam.
3. Open it, **⋮** menu, **Show original**. SPF, DKIM and DMARC all say **PASS**.
4. Tap the link: you are signed in.

Close #67.

## If it goes wrong

- Resend will not verify: a record has a typo or a full name (`send.postsznfantasy.com` instead of `send`). Compare character by character.
- In spam: check DMARC exists, wait a day, send a few more.
- No email at all: Supabase, **Authentication**, **Logs** shows the SMTP error. Paste it (not the key) to the coordinator.
