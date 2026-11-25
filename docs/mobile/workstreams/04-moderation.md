# 04: Moderation: report, block, community rules

Phase B. Needs nothing native: it is a web feature that ships to everyone. Overlaps 03 in `api/services/push.py` (recipient filtering only). Unblocks 05, which names these rules. [Back to the plan](../README.md)

## Goal

Any member can report a chat message, a picture or a member, and block a member; everyone agrees to short community rules before using the app; the owner can act on a report within 24 hours from a phone.

## Why

Apple 1.2 and Google's user-generated-content policy require a way to filter objectionable content, report it, block abusive users, and published contact details. PostSzn has chat with GIFs, @mentions and reactions, and profile, team and league pictures. Today a message can only be deleted by its author or a commissioner, and there is no report or block anywhere.

## Scope

1. **Report**: `POST /api/reports` `{kind: "message" | "picture" | "member", targetId, reason, note?}` (reasons: harassment, hate, sexual, spam, other). Stores one row (reporter, target, reason, note, created_at) and emails `SUPPORT_EMAIL` through the existing Resend path in `api/services/support.py` (its `_transport` seam for tests), with the reported content quoted and a link to act. Rate-limited like the other user routes (`api/core/rate_limit.py`). 503-safe when the support email is unset: the row is still stored.
2. **Where reports start**: "Report" in `components/feed/MessageActionMenu.tsx`; "Report picture" and "Report member" from the member rows (members sheet, team header, invite preview is excluded since it is public). Copy in `content/rules.ts`.
3. **Block**: `PUT /api/blocks/{userId}` `{blocked}` and a list in the account center ("Blocked members", unblock). Table `user_blocks (blocker_user_id, blocked_user_id, created_at)`. Effects, all for the blocker only:
   - the blocked member's messages are left out of `GET /api/seasons/{id}/feed` (`services/feed.py` `message_items`) and of the unread counts
   - their @mentions of the blocker do not notify (`services/mentions.py`)
   - their messages do not push to the blocker (`services/push.py` `notify_league_message`)
   - nothing else changes: both stay in the league, standings and drafts are untouched; removing someone stays a commissioner action
4. **Owner actions**: admin routes to soft-delete any message and clear any picture (`api/routers/admin.py`), each logged like other admin calls, so a report can be handled from the API docs or a script without SQL. The existing account-deletion script covers removing an account.
5. **Community rules**: a short section in the Terms (05 writes the final wording; this workstream adds a placeholder string in `content/rules.ts`). `users.terms_version_accepted` plus `POST /api/auth/terms` `{version}`; the login response carries the accepted version; the SPA shows a blocking sheet after sign-in until the current version is accepted. Bumping the version re-asks everyone.
6. **GIFs**: GIPHY is already queried with `rating: "pg-13"` (`utils/gifProvider.ts`). Lowering it to `pg` is a decision for 10 (it affects the age rating); leave it.
7. Every new route gets its line in `api/tests/authz_expectations.py`; new tables update `docs/erd.md`; AGENTS.md route map.

## Touches

`api/routers/` (new reports and blocks routers, `admin.py`, `auth.py`), `api/services/feed.py`, `api/services/mentions.py`, `api/services/push.py`, `api/services/support.py`, `api/db/models/` (two tables, one column), a migration, `docs/erd.md`, `api/tests/authz_expectations.py`, `frontend/src/components/feed/MessageActionMenu.tsx`, member-list components, `frontend/src/components/settings/AccountSheet.tsx`, `frontend/src/contexts/UserContext.tsx` (terms gate), `frontend/src/content/rules.ts`, e2e specs for report and block, `make tour` if the Feed changes visibly.

## Done when

- Report from a message, a picture and a member reaches the support inbox in e2e (the Resend stub's `GET /sent`).
- A blocked member's messages disappear for the blocker on the next feed fetch and never notify them; the blocked member sees no difference.
- A new account cannot reach the app before accepting the rules; an existing one is asked once.
- Admin can delete any message and clear any picture.
- pytest (service and route), Vitest (sheets), e2e (report, block, terms gate) pass.

## Re-verify before starting

- Apple 1.2 and Google's UGC policy wording, in case they now ask for more (for example a content filter on text).
- The current list of places a picture or a member appears.
