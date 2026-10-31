# Step 7: Cloudflare Pages site and API address

About 30 minutes. Issues #106 (part 2) and #92. Needs Steps 3 (domain **Active**) and 6 (API healthy). [Back to the list](README.md)

Cloudflare Pages serves the website. Cloudflare now steers brand-new projects toward Workers, but Pages still works and our build files (`_redirects`, `_headers`) are written for it.

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/cloudflare-pages.sh
```

1. **Account and domain**: answer yes once `postsznfantasy.com` is **Active**.
2. **Create the Pages project.** Cloudflare dashboard, **Workers & Pages**, **Create application**, **Pages**, **Connect to Git** (if the screen opens on Workers, look for the **Pages** tab or a "deploy Pages" link). Authorize GitHub and pick `kmacri12/PostSznFantasy`. Then:
   - Project name `postszn`
   - Production branch `main`
   - Framework preset **None**
   - Build command `npm ci && npm run build`
   - Build output directory `dist`
   - Root directory (advanced): `frontend`
   - **Save and Deploy**. The first build may fail or show a blank site: the variables come next.
3. **Build variables.** The script prints the list with your Supabase values filled in. In the project, **Settings**, **Variables and Secrets** (older screens: **Environment variables**), **Production**, add each:
   - `NODE_VERSION` = `22.12`
   - `VITE_API_URL` = `https://api.postsznfantasy.com`
   - `VITE_WS_URL` = `wss://api.postsznfantasy.com`
   - `VITE_SUPABASE_URL` = from the script
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = from the script

   Then **Deployments**, the latest one, **Retry deployment**. The site reads variables only when it is built.
4. **Custom domain**: project, **Custom domains**, **Set up a custom domain**, `postsznfantasy.com`. Accept the DNS record Cloudflare suggests. Add `www.postsznfantasy.com` too if you want it.
5. **API address.** The script runs `fly certs add api.postsznfantasy.com --app postszn-api` and prints DNS records. In Cloudflare, **DNS**, **Records**, **Add record**, add exactly those. **Set Proxy status to DNS only (grey cloud).** An orange cloud breaks the live draft. Wait until this says **Issued**:
   ```bash
   fly certs show api.postsznfantasy.com --app postszn-api
   ```
6. The script prints four checks.

## Verify

All four lines from the script look like this:

- API health: `{"status":"healthy"}`
- Site: `200`
- Deep link `/leagues/1`: `200` (not 404)
- CORS allow-origin: `https://postsznfantasy.com`

Then open https://postsznfantasy.com on your phone. You see the landing page with **Sign in**, not a "back for the next postseason" notice. Optional:

```bash
curl -sI https://postsznfantasy.com/ | grep -i -E 'cache-control|x-frame'
```

shows the headers from `frontend/public/_headers`. Close #92 and #106.

## If it goes wrong

- Old or blank page: you skipped **Retry deployment** after adding variables.
- "Back for the next postseason" notice: the site cannot reach the API. Either the API is down (`curl https://api.postsznfantasy.com/api`), or CORS is wrong. Send the coordinator the names (never values) from `fly secrets list --app postszn-api`.
- `ERR_SSL` or a certificate error on `api.`: the DNS record is orange (should be grey) or not created yet.
