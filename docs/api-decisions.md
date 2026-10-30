# API decisions

Settled in a design review on 2026-10-29. Open work lives in GitHub Issues.

## Context
- MVP for a handful of family and friends leagues, ahead of the 2027 playoffs. Members are trusted; defend against outsiders and accidents, not malicious members.
- Single always-on process (about $5/month). Fan-out and the draft clock are in-process, so `--workers 1` is a hard requirement. The exit route (Postgres LISTEN/NOTIFY behind `DraftConnectionManager.broadcast`) is tracked in the `scaling` issue.

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
