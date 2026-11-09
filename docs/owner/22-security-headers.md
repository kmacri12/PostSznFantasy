# Step 22: Turn on HSTS and enforce the Content-Security-Policy

10 minutes. Issue #324. Needs Step 3 (domain on Cloudflare) and Step 7 (Cloudflare Pages). [Back to the list](README.md)

## 1. HSTS

1. Cloudflare dashboard, your domain, **SSL/TLS**, **Edge Certificates**.
2. **Always Use HTTPS** on. **HTTP Strict Transport Security (HSTS)**: enable with max age 6 months, **Include subdomains** on, **No-Sniff Header** on. Leave **Preload** off.

## 2. Enforce the CSP (after a few days of real use)

The website ships `Content-Security-Policy-Report-Only` (`frontend/public/_headers`): the browser reports what it would block but blocks nothing.

1. Open https://postsznfantasy.com in Chrome, sign in, visit a league, the Draft tab, the Feed (try the GIF picker) and More. Open DevTools, **Console**: look for "Content Security Policy" violations.
2. None: in `frontend/public/_headers` change `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in a PR. Violations: add the host it names to the matching directive first. Your Supabase project, Sentry region and GIF host are the likely ones.
