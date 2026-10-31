# Step 6: Fly.io API

About 30 minutes. Issues #104 and #11. Needs Steps 1, 2 and 4. [Back to the list](README.md) Screens checked 2026-10-30.

Fly runs the API: one always-on machine, about $6.70 a month (Fly's pricing page, 2026-10-30).

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/fly-setup.sh
```

1. **Account and billing**: it opens https://fly.io/app/sign-up. Create the account and add a card under **Billing** (every Fly organization needs one after the trial). If asked, approve `fly auth login` in the browser tab it opens.
2. **Create the app**: answer **y** to create `postszn-api`. The region is `iad` (Virginia), next to Supabase `us-east-1`. Do not change it.
3. **Non-secret settings**: press **Enter** for each. The defaults are right (Supabase URL from Step 4, allowed origin `https://postsznfantasy.com`, the two Tank01 addresses).
4. **Secrets** (typed hidden, sent straight to Fly):
   - the **Supabase direct URL** from your password manager (host `db.<ref>.supabase.co`, port 5432). The script refuses port 6543.
   - the **RapidAPI Tank01 key**.
5. **GitHub token**: automatic. It stores a deploy-only token as the GitHub secret `FLY_API_TOKEN`.
6. **First deploy**: answer **y** to start the **Deploy API** workflow. Watch it with `gh run watch`. It must finish green.
7. It then prints `fly status` and the health check.

## Verify

```bash
curl https://postszn-api.fly.dev/api
fly status --app postszn-api
```

The first prints `{"status":"healthy"}`. The second shows exactly **one** machine with its check passing.

## If it goes wrong

- Logs (`fly logs --app postszn-api`) say "network is unreachable" for the database: Fly could not reach Supabase over IPv6. Use the session pooler instead, then run **Deploy API** again (GitHub, **Actions**, **Deploy API**, **Run workflow**, tick "I checked: no draft is in the lobby, running or paused"; the run stops if it is not ticked):
  ```bash
  fly secrets set PG_URI='<Supabase session pooler URL>' --app postszn-api
  ```
- The workflow fails at "migrate": paste the log lines to the coordinator. The old version keeps running; nothing is broken.
- `fly: command not found`: redo [Step 1](01-prep-computer.md).
