# Step 21: Cloudflare rate limiting (skip it)

Nothing to do. Issue #323. [Back to the list](README.md)

A Cloudflare rule only sees traffic that Cloudflare proxies. The API address `api.postsznfantasy.com` is **DNS only (grey cloud)** on purpose ([Step 7](07-cloudflare-pages.md)): an orange cloud breaks the Fly certificate and the live draft. So API requests go straight to Fly and no Cloudflare rule can count them. A rule on the website itself would only cover static files Cloudflare already serves.

The Free plan also doesn't offer what an API rule would need: a rule can match only on **URI Path**, and it counts and blocks over a fixed 10 seconds.

The API protects itself instead (`api/core/rate_limit.py`): chat, reactions, league creation, invite joins and previews, pictures, data export, sign-in, support reports and socket messages each have their own limit, answering 429 with a readable message.

Revisit this only if the API ever moves behind Cloudflare's proxy (orange cloud) and you upgrade to a plan that matches on **Hostname**. Then the rule would be: Hostname equals `api.postsznfantasy.com`, characteristic **IP**, 300 requests per minute, action **Block** for 1 minute.
