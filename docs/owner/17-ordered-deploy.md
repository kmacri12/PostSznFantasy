# Step 17: Ordered deploys (API first, then the website)

About 10 minutes, in two sittings. Issue #249. [Back to the list](README.md)

Merging to `main` now runs the **Deploy** workflow: it stops if a draft is live, deploys the API when it changed, checks it is healthy, and only then tells Cloudflare to build the website. Cloudflare must stop building on its own, but only after the first successful run. Doing it earlier stops the website deploying at all.

## Before merging the PR

1. Cloudflare dashboard, **Workers & Pages**, project `postszn`, **Settings**, **Builds**, **Deploy hooks**, **Add deploy hook**. Name `github-deploy`, branch `main`. Copy the URL it shows.
2. Save it as a GitHub secret without pasting it anywhere else (it is a secret: anyone with it can trigger builds):
   ```bash
   cd ~/code/PostSznFantasy
   gh secret set CLOUDFLARE_PAGES_DEPLOY_HOOK
   ```
   Paste the URL when asked, then Enter.
3. Nothing to change for Fly: `FLY_API_TOKEN` and `PROD_DATABASE_URL` already exist.

## After merging, once one run is green

4. Merge the PR. Watch the run: GitHub, **Actions**, **Deploy**. It is green when the API (if it changed), the health check and the Pages trigger all pass. Check the website deployed in Cloudflare, **Deployments**.
5. Only now: Cloudflare, project `postszn`, **Settings**, **Builds**, **Branch control**, set **Automatic production branch deployments** to **Disabled**. Keep preview deployments on.
6. Optional rehearsal: **Actions**, **Deploy**, **Run workflow** on `main`, tick "I checked". With nothing new it says "production already runs ..." and does nothing.

## Verify

- `curl -s https://api.postsznfantasy.com/api` shows `"version"` with the commit of the latest API deploy.
- A run with a live draft is red and says "A draft is live"; the scheduled run every 15 minutes ships `main` after the draft ends.
- A failed run is red on `main` and the old API and website keep serving.

## If it goes wrong

- Run red at "Trigger the Cloudflare Pages build": the secret is missing or the hook was deleted; redo steps 1 and 2, then **Run workflow**.
- Website stopped updating after step 5: re-enable automatic deployments, then tell the coordinator.
- Rolling back to the last good version: [fly.md](../deploy/fly.md#roll-back).
- Off-season: the workflow must be disabled while the API is stopped ([shutdown runbook](../deploy/shutdown-runbook.md)).
