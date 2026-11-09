# Step 21: Add a Cloudflare rate-limiting rule

5 minutes. Issue #323. Needs Step 3 (domain on Cloudflare) and Step 6 (the API on Fly). [Back to the list](README.md)

The API throttles itself (chat, league creation, invite joins, pictures, sign-in, sockets; see `api/core/rate_limit.py`), but those limits live in memory in the one API process. A Cloudflare rule in front stops a flood before it reaches Fly.

1. Cloudflare dashboard, your domain, **Security**, **WAF**, **Rate limiting rules**, **Create rule**.
2. Name `api-flood`. If incoming requests match: **Hostname** equals `api.postsznfantasy.com`.
3. Characteristics: **IP**. Requests: `300` per `1 minute`. (A normal draft night is well under 100 a minute per person.)
4. Action: **Block**, duration `1 minute`. **Deploy**.

Verify: nothing to check on a normal day. If a league on one shared wifi ever reports "Too many requests", raise the number.
