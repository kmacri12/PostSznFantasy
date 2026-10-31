# API decisions

Settled in a design review on 2026-10-29. Open work lives in GitHub Issues.

## Context
- MVP for a handful of family and friends leagues, ahead of the 2027 playoffs. Members are trusted; defend against outsiders and accidents, not malicious members.
- Single always-on process (about $5/month). Fan-out and the draft clock are in-process, so `--workers 1` is a hard requirement. The exit route is built but opt-in: `DRAFT_BROADCAST=postgres`.

## Running more than one API instance (`DRAFT_BROADCAST=postgres`)

- `DraftConnectionManager.broadcast` publishes through `api/ws/broadcast_relay.py` (`PostgresRelay`) instead of writing to sockets; every instance, the publisher included, receives the NOTIFY and writes to its own sockets via `deliver_local`. Payloads over the 8000-byte NOTIFY cap (the full `DRAFT_STATE`) are split into chunks and reassembled. If a publish fails the instance still delivers to its own sockets.
- The relay holds one dedicated asyncpg connection that LISTENs and publishes, and reconnects after a drop. It needs a direct or session-mode connection, not Supabase's transaction pooler.
- **No double auto-picks.** Each instance runs the draft clock. `auto_pick(only_if_overdue=True)` takes the draft row lock (`SELECT ... FOR UPDATE`) and re-checks the deadline; the loser blocks, sees the advanced deadline and raises `PickNotDue`. `test_multi_instance_clock.py` races two sessions. No advisory lock is needed. `extend_overdue_deadlines` at startup also locks the rows, but an instance restarting during a draft can give a just-lapsed pick a fresh window.
- Not covered: presence (`PRESENCE`) lists only the users connected to the broadcasting instance; the scheduler (`SCHEDULER_ENABLED`) must stay on at most one instance (ingestion has its own advisory lock, but polls would double RapidAPI spend); multi-instance has only been tested locally.

## Drafts
- Every pick path locks the `Draft` row (`load_draft_for_update`). The clock scans for expired deadlines before locking, so `auto_pick(only_if_overdue=True)` re-checks the deadline under the lock and raises `PickNotDue` rather than burning a turn that a drafter just used. Commissioner force-pick skips that check.
- After a restart, in-progress deadlines are extended by a full pick window instead of auto-picking in a burst.
- Reconnecting WebSocket clients get a full `DRAFT_STATE` snapshot; there is no event replay.
- Removing a member mid-draft unassigns their team, keeps its picks, and lets auto-pick cover it.

## Data and ingestion
- User requests never call Tank01. Only admin endpoints and the scheduler do, and each ingestion type takes a Postgres advisory lock so overlapping runs skip.
- Failed syncs are handled by a manual admin re-sync and a last-synced timestamp; reconciliation and alerting are deferred.

## Contract
- Errors stay as FastAPI `{"detail": "..."}` strings. The one exception: a commissioner moving a locked player gets 409 `{"detail": "...", "code": "override_confirmation_required"}`, so the client can ask them to confirm and resend with `confirmOverride`. Clients that ignore `code` still show a sensible `detail`.
- Player endpoints return full lists (no pagination), gzip-compressed, and the stats endpoint defaults to draftable positions.
- Invites are commissioner-generated, 8 random characters, default 7-day expiry shown in the UI; `allow_join_after_draft_start` governs joining mid-draft.
- Each API change updates `test_frontend_contract.py` and the frontend types in the same PR.
