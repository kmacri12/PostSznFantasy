# Step 24: Show the "Support PostSzn" coffee link

5 minutes, optional. Issue #362. Needs Step 7 (the Cloudflare Pages site). [Back to the list](README.md)

The More tab can show a "Support PostSzn" row that opens your Buy Me a Coffee page in a new tab. It stays hidden until you give it the address, so nothing ships with a placeholder.

1. Copy your Buy Me a Coffee page address (it looks like `https://buymeacoffee.com/yourname`).
2. Cloudflare dashboard, **Workers & Pages**, your Pages project, **Settings**, **Variables and Secrets**, production environment: add `VITE_SUPPORT_URL` with that address.
3. **Deployments**, retry the latest deployment (the value is baked in at build time).

To hide the row again, delete the variable and redeploy.

Verify: open the site, More tab, Help group shows "Support PostSzn"; tapping it opens your page in a new tab.
