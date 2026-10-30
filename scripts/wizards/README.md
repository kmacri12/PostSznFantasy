# Human-gated setup wizards

Interactive walkthroughs for steps only a human can do. They open the right pages, say what to
click, and never ask for secrets: keys are pasted straight into the provider dashboard. Non-secret
values are saved to `~/.config/postszn-wizards/*.env`, outside the repo.

| Order | Script | Issue |
| :-- | :-- | :-- |
| 1 (start first, Google verification takes days) | `production-google-oauth.sh` | #91 |
| 2 | `custom-smtp.sh` | #67 |
| 3 | `sentry-setup.sh` | #85 |
| Production launch, in this order (see [the cutover runbook](../../docs/deploy/cutover-runbook.md)) | `supabase-prod.sh`, then `fly-setup.sh`, then `cloudflare-pages.sh` | #105, #104, #106 |

Run from the repo root: `./scripts/wizards/production-google-oauth.sh`. Ctrl-C and re-run is safe.
Quota research for #71 is in [docs/research/rapidapi-quota.md](../../docs/research/rapidapi-quota.md).
