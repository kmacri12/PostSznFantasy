# Error tracking with Sentry (epic #84)

Both apps report unhandled errors to Sentry, and both are **inert until a DSN is set**: no SDK client, no network request, no console output. Account and project creation is a manual walkthrough (`scripts/wizards/sentry-setup.sh`, issue #85); this page covers wiring and alerts.

## Variables

| Variable | Where | Value |
| :-- | :-- | :-- |
| `SENTRY_DSN` | Fly secret (API) | the **postszn-api** project DSN; empty or unset disables the SDK |
| `SENTRY_RELEASE` | Fly secret or `fly.toml`, optional | release name, e.g. a git SHA, to group errors by deploy |
| `ENVIRONMENT` | `fly.toml` (already `production`) | doubles as the Sentry environment tag |
| `VITE_SENTRY_DSN` | Cloudflare Pages build variable | the **postszn-frontend** project DSN; unset disables the SDK |
| `VITE_SENTRY_ENVIRONMENT` | Cloudflare Pages build variable, optional | environment tag; defaults to the Vite mode (`production` in a Pages build) |

DSNs are ingest-only keys (the frontend one ships in the public bundle), but keep the API one a Fly secret like the rest.

```bash
fly secrets set SENTRY_DSN='<postszn-api DSN>' --app postszn-api   # restarts the machine: never during a live draft
```

Frontend: add `VITE_SENTRY_DSN` under Pages, Settings, Variables and Secrets (production), then retry the deployment, because Vite bakes it in at build time. Without it the Sentry chunk is not even in the build.

## What is sent

- **API**: unhandled request exceptions (FastAPI integration), `logger.error`/`logger.exception` records, and exceptions the draft clock and scheduler swallow (explicit `sentry_sdk.capture_exception()` in their `except` blocks). No tracing, no performance data.
- **Frontend**: uncaught errors, the `ErrorBoundary`, and every `createLogger(...).error(...)`. Draft WebSocket state (`connected`, `closed`, `reconnecting`, `resync`) is added as `draft.connection` breadcrumbs, so an error report shows the connection history that led to it.
- **Never sent** (`api/core/observability.py`, `frontend/src/utils/sentry.ts`): `user`, cookies, `Authorization`/`Cookie` headers, request bodies, query strings and URL fragments (auth redirects put tokens there), invite codes (`/join/<code>`, `/invites/<code>` become `[code]`), and any email address or JWT found in a message or exception text. Frontend console breadcrumbs are dropped.

## Alert rules to create (issue #88, after #85)

Alerts live in the Sentry UI (Alerts, Create Alert), so they cannot be committed. Create these three in the **postszn-api** project, environment `production`, notifying your email.

### 1. Scheduler or sync failures during games

The scheduler logs each failed poll, reconcile, schedule refresh or cycle with `logger.exception`, which becomes a Sentry event with the `logger` tag `api.services.scheduler`.

- Type: **Issue alert**
- When: *an event is seen*
- If (filter): `logger` equals `api.services.scheduler` **and** `environment` equals `production`
- Then: *Frequency*: more than **3** events in **10 minutes** (use "The issue is seen more than 3 times in 10 minutes")
- Action: send a notification to you; action interval 30 minutes.

During the live window the poll runs every 180 s, so a persistently failing sync trips this within about ten minutes.

**Gap, be aware:** this catches a sync that *errors*. It cannot catch a scheduler that has stopped; look at `lastSyncedAt` on `/api/players/sync-status` (login-protected, so an external keyword monitor cannot read it) on game days. A spent daily RapidAPI budget has its own alert, rule 3 below.

### 2. Repeated draft pick failures

A failed auto-pick (the draft clock tried to pick for a team and was refused) is logged at error level and a draft clock tick that crashes is captured; both carry the `logger` tag `api.services.draft_clock`. An unexpected error inside a pick request is a 5xx on `/api/drafts`, captured by the FastAPI integration.

Create it as two rules with the same threshold and action (Sentry filters are ANDed):

- Rule 2a. If: `logger` equals `api.services.draft_clock` and `environment` equals `production`.
- Rule 2b. If: the issue's `transaction` contains `/api/drafts` and `environment` equals `production`.
- Then, for both: more than **2** events in **5 minutes**; notify you immediately (action interval 5 minutes), since a draft happens in real time.

Ordinary user mistakes (taking a drafted player, picking out of turn) are 4xx responses, which Sentry does not record, so they will not trigger this.

### 3. Daily Tank01 request budget spent

When the daily cap (`RAPIDAPI_DAILY_REQUEST_LIMIT`) is reached, live polling stops and the data goes stale, but nothing is raised. The client therefore sends one Sentry message, "Tank01 daily request budget spent" (level `warning`, no payload), per UTC day, from `RapidApiClient`. The count is in memory, so a restart after the cap is hit can send it again.

- Type: **Issue alert**
- When: *a new issue is created* (a first occurrence), or *an event is seen*
- If (filter): `message` contains `Tank01 daily request budget spent` **and** `environment` equals `production`
- Action: notify you; action interval 24 hours.

### Check the rules

Use **Send Test Notification** on each rule. Sentry's project setup page also has a verification step that sends a real test event once the DSN is deployed.

## Not validated without a Sentry account

Nothing here has been sent to a real project: the SDK wiring, `before_send` scrubbing and the no-op behaviour are unit tested, but delivery, the `logger` tag filters above, and the alert conditions need the first real events. Check in Sentry that events carry no user, cookie or Authorization data, and that the `logger` tag names match.
