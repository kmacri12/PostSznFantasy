# Owner launch guide (Kyle)

Everything only you can do (accounts, dashboards, keys), in order. One page per step. Every page ends with a **Verify** line: tick the box in #132 when it is true.

Provider screens were checked against their own docs on **2026-10-30**. If a button has moved, look for the nearest match and tell the coordinator, who will fix the page.

## Words used here

- **Setup script**: a file in `scripts/wizards/`. You run one command, it asks one question at a time, opens the right page and says what to click. Secrets are typed hidden and go straight to the service.
- **Repo root**: the project folder. Every command starts there: `cd ~/code/PostSznFantasy`.
- **Coordinator**: the Claude session that runs this project for you. When a page says "tell the coordinator", post in that chat or on the issue.
- **Password manager**: where every password, key and connection string goes. **Never paste one into a chat, an issue or a file in the project.**

## The steps

Before anything
1. [Prep your computer](01-prep-computer.md), 20 min

Accounts and keys
2. [RapidAPI account and key](02-rapidapi-key.md), 10 min (#71)
3. [Move the domain to Cloudflare](03-domain-on-cloudflare.md), 15 min, then wait up to a few hours (#106 part 1). **Start this first.**
4. [Supabase production project](04-supabase-project.md), 30 min (#105)
5. [Production Google sign-in](05-google-sign-in.md), 30 min, then Google may take days (#91)

Put the app online
6. [Fly.io API](06-fly-api.md), 30 min (#104, #11)
7. [Cloudflare Pages site and API address](07-cloudflare-pages.md), 30 min (#106 part 2, #92)
8. [Test Google sign-in on the live site](08-test-google-sign-in.md), 5 min (#91)

Email, monitoring, backups
9. [Email so magic links reach inboxes](09-email-smtp.md), 30 min (#67)
10. [Sentry error tracking and alerts](10-sentry.md), 40 min (#85, #88)
11. [Weekly encrypted backup](11-backups.md), 40 min (#107)
12. [Uptime monitor](12-uptime.md), 10 min (#108)

Data and launch
13. [Load NFL data and make yourself admin](13-load-data-admin.md), 20 min (#74)
14. [Verify stat keys](14-stat-keys.md), 2 min for you (#77)
15. [Mock draft on phones, launch checklist](15-mock-draft.md), 1 to 2 hours with friends (#95)
- [Restore a deleted league](league-restore.md), 2 min, only when a commissioner asks (#231)
- [Set the playoff field](playoff-field.md), 5 min, once for the mock draft and again when the seeds are known (#214)
16. [Turn on live scoring before game day](16-scheduler.md), 10 min (#78)

After the season (engineering runbooks, written for you too)
- [Shut down after the Super Bowl](../deploy/shutdown-runbook.md)
- [Wake up before the next postseason](../deploy/wake-up-runbook.md)
- [Rehearse both](../deploy/dormancy-rehearsal.md)

Decisions only you can make
- [Pick a performance target](decisions.md#performance-target) (#94)

## Costs

Free: Cloudflare, Supabase (Free plan), Google Cloud, Sentry (Developer), UptimeRobot, Resend (3,000 emails a month), RapidAPI Basic.

Paid:
- Fly.io machine: about **$6.70 a month** (1 GB shared CPU, always on). Needs a card.
- RapidAPI Pro in January: **$10 a month**. Cancel after the Super Bowl.

## Rules that protect you

1. **Never deploy, restart the API, or run `fly secrets set` while a draft is live.** It disconnects everyone. First run:
   ```bash
   DATABASE_URL='<session pooler string>' scripts/check-live-drafts.sh
   ```
   Before launch there are no drafts, so this only matters from Step 15 on.
2. If a setup script stops halfway, run it again. It is safe to re-run and remembers your non-secret answers in `~/.config/postszn-wizards/`.
3. If something fails and the page's **If it goes wrong** does not help, paste the error text (never a secret) to the coordinator.

The engineering view of the same order, with go/no-go checks and rollback, is [the cutover runbook](../deploy/cutover-runbook.md).
