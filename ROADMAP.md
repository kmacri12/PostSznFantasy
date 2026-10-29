# ROADMAP.md — Hardening & Best-Practices Phase

Forward-looking work only. Completed phases 1–14 are archived in [REWRITE_ROADMAP.md](REWRITE_ROADMAP.md); open items from it are carried over below. Update this file as items land (and keep [AGENTS.md](AGENTS.md) / [README.md](README.md) in sync per the documentation mandate).

> [!IMPORTANT]
> **PRE-DEVELOPMENT / LOCAL-ONLY CONTEXT**: no production DB, no users, no legacy data. Schema wipes, route renames and wholesale rewrites are fine — no migrations shims or backward compatibility.

**PostSzn Fantasy**: fantasy football for the NFL postseason (Wild Card → Divisional → Conference Championships → Super Bowl). Drafted players are eliminated as their real teams lose, so player survival drives the standings.

Stack: FastAPI + async SQLAlchemy 2.0 + Postgres 16 (Alembic) · Supabase Auth (JWT/JWKS) · React 18 + Vite + MUI + TanStack Table · uv, Ruff, Mypy, Biome, Vitest, pytest.

Guiding principles: KISS, comments explain *why* only, self-documenting names.

---

## History (done)

| Phase | Summary |
| :--- | :--- |
| 1 | Tooling: `uv` + `pyproject.toml`, Ruff/Mypy, Biome, `.env.example`s, Docker Compose Postgres |
| 2 | Flask → FastAPI: routers, lifespan, `Depends` auth/DB, Pydantic v2 schemas, native WebSockets |
| 3 / 3.5 | SQLAlchemy 2.0 models, async session, Alembic, FK cascades, Pydantic Settings |
| 4 | Scoring engine, elimination logic, resilient httpx RapidAPI client |
| 5 | Frontend refactor: user context, missing views, WS client, TanStack Table v8, TS build fixes |
| 6 | Backend/frontend test suites, GitHub Actions CI |
| 7 | README, CONTRIBUTING, AGENTS docs |
| 8 | Firebase → Supabase Auth (JWKS verification) |
| 9 | Ingestion pipeline, `seed_nfl_data.py`, admin "update all" endpoint, dev quick-sync UI |
| 10 | Postgres schema segregation (`fantasy` / `nfl`) |
| 11 | Missing player/team/settings endpoints, enriched standings |
| 12 | Dark-first UI overhaul and landing page |
| 13 | Sleeper-default PPR scoring, fractional scoring columns |
| 14 | Fix stale league list after league creation |
| Backlog 2 | Structured logging (API + frontend) |

### Carried over (still open)
- [x] Phase 10: ingestion and queries use the schema-qualified `fantasy` / `nfl` models only; the connection-level `search_path` override is removed (verified against a freshly migrated DB).
- [x] Phase 13: Sleeper scoring gaps closed — blocked kick and defensive 2-pt return (DST), per-length FG-miss penalties, and stacking 300/400 pass, 100/200 rush and 100/200 receiving yardage bonuses. New stat columns (`kicking_fg_yards_missed`, `dst_blocked_kicks`, `dst_two_point_returns`) are read from RapidAPI keys `FGYardsMissed`, `DSTBlockedKicks`, `DST2PtReturns`; verify those key names against live box scores, since they default to 0 if absent.

---

## Phase 15: Security Fixes (Critical)

- [x] **C1 — Remove the unsigned-JWT fallback** (`api/dependencies/auth.py`): when `SUPABASE_URL` is unset the code decodes with `verify_signature=False`, so a missing env var in a deployed environment lets anyone forge any identity. Make `SUPABASE_URL` required at startup; tests already override `get_current_user`.
- [x] **C2 — Authenticate and authorize the draft WebSocket** (`api/routers/drafts.py`): anyone can connect to `/api/drafts/ws/{league_id}` and broadcast arbitrary events; the fallback branch rebroadcasts any client message.
  - [x] Verify the JWT on connect (query param or first message) and require league membership.
  - [x] Replace client-trusted `PICK_MADE` relaying with server-side pick validation (turn order, availability, roster limits), persistence to `DraftPick`, then broadcast.
  - [x] Whitelist inbound event types; reject the rest.
- [x] **C3 — League-membership authorization**: `draft-info`, `draft-picks`, settings, teams, standings and `teams/{id}` only require a login. Add a shared dependency (e.g. `LeagueMember`) and apply it. Decide which `/api/players/*` routes need auth (they currently have none).
- [x] **C4 — Restrict `/api/admin/*`**: add an admin check (allow-list or role); today any logged-in user can trigger paid ingestion or eliminate NFL teams.
- [x] **C5 — Stop leaking exception text** in 401 responses; log details server-side, return a generic message.
- [x] **C6 — Fix `login_or_register`** (`api/routers/auth.py`): use `INSERT … ON CONFLICT` to remove the first-login race; drop the `user.id or 1` fallback; drop fake `@postszn.local` emails (make email nullable or require it).
- [x] Tests for each of the above (unauthenticated WS, non-member access, non-admin admin call, forged token) — see `api/tests/test_auth.py`, `test_draft_websocket.py`, `test_draft_picks.py`, `test_authorization.py`, `test_admin_access.py`.

---

## Phase 16: Backend FastAPI Best-Practice Gaps

- [x] **Camel-case contract**: make `LoginPayload`, `BoxScoreRequest`, `EliminateTeamsRequest`, `UpdateAllRequest` extend `BaseSchema`.
- [x] **Single source of truth for settings fields**: `ScoringSettings`, `LeagueSettingsResponse`, the ORM `LeagueSettings` and the 7 frontend settings components repeat ~80 fields. Generate the response from `ScoringSettings` / `RosterSettings` (or restructure into a grouped/JSON model).
- [x] **One transaction pattern**: `get_db` commits on success *and* routes call `commit()`. Pick one (recommended: `get_db` owns commit; routes only `flush`).
- [x] **Remove cruft routes**: legacy `/get_leagues_by_user` alias; five identical router-level `GET /` health endpoints; keep one health endpoint that also checks the DB.
- [x] **Config-driven deployment settings**: CORS origins, pool size/overflow into `Settings`; resolve `.env` path independent of working directory.
- [x] **Schema hygiene** (DB is disposable — redo the migration freely):
  - [x] Add indexes on FKs (`teams.league_id`, `teams.owner_id`, `draft_picks.draft_id`, `draft_picks.team_id`, `standings.league_id`, …) and a unique constraint on `league_settings.league_id` (and `drafts.league_id` if one draft per league). Verify against the current migration first.
  - [x] Tighten nullability (`Draft.status`, `league_id`-style columns, etc.); use enums / `CheckConstraint` for `status` and `draft_type` (`api/models/enums.py` exists).
  - [x] Replace `Team.roster` `ARRAY(Integer)` with a proper roster join table.
  - [x] Move the hardcoded draft defaults in `create_league` (start in 7 days, 60 s/pick) into settings or the request.
  - [x] Run `alembic revision --autogenerate` on a fresh DB and confirm the diff is empty.
- [x] **RapidAPI client** (`api/utils/rapidapi/rapidapi.py`): reuse one `httpx.AsyncClient`; bound the cache; retry only 5xx / transport errors (not 4xx); let failures propagate so a failed sync is not reported as "0 rows synced"; delete the `RapidApi` alias.
- [x] **Typing**: remove the mypy `ignore_errors` override for `api.utils.*` and fix what surfaces.
- [x] **Tooling**: set Ruff `known-first-party = ["api"]` so `api.*` imports sort correctly.
- [x] **Layout cleanup**: delete `api/utils/db/models.py` shim; move `update.py`'s logic into `services/`; collapse `dependencies/db.py` re-export; consider dropping `psycopg2-binary` (run Alembic with an async env).
- [x] **Tests**: add a Postgres-backed test tier (CI service container) for SQL, relationships and scoring/elimination paths; add WebSocket and commissioner-only settings tests. Current tests mock the session entirely.

---

## Phase 17: Frontend React Best-Practice Gaps

- [x] **Single API client**: ~15 call sites hand-build `${apiUrl}/api/...` and `Authorization` headers. Create one axios instance (or `fetch` wrapper) with `baseURL` and a token interceptor.
- [x] **Server-state layer**: adopt TanStack Query for loading/error/caching/cancellation; remove hand-rolled `useEffect` fetching (no abort handling today).
- [x] **`UserContext`**:
  - [x] Memoize the context value and wrap functions in `useCallback`.
  - [x] Drop the `user_id` / `userId` dual handling and the redundant `idToken` state.
  - [x] Don't `await` backend calls inside `onAuthStateChange`; avoid re-posting `/auth/login` on every token refresh.
  - [x] Surface login-sync failures to the UI instead of only logging.
- [x] **`useWebSocket`**: send the auth token; exponential backoff with cap; don't reconnect after intentional close; use `ReturnType<typeof setTimeout>`; keep a message queue/callback rather than only the latest message; send `eventType` consistently with the server.
- [x] **Route-level code splitting**: `React.lazy` + `Suspense` per page (bundle is ~850 kB / 250 kB gzip); split MUI/vendor chunks.
- [x] **Dependency hygiene**:
  - [x] `npm audit fix` (7 vulnerabilities in prod deps incl. 1 critical, 4 high).
  - [x] Remove `@types/axios`, `@types/react-router-dom` (libs ship own types) and unused `dotenv`.
  - [x] Review upgrades: Vite, Vitest, `@mui/*` 5.18, `react-router-dom` 6.30.x.
- [x] **Type safety**: replace the 33 Biome `any` warnings (settings components take `any`); use generated or shared API types; consider `noUncheckedIndexedAccess`.
- [x] **Deduplicate settings UI**: the 7 `Scoring*SettingsComponent` files become one data-driven component fed by a field schema.
- [x] **Dev proxy**: add a Vite `server.proxy` for `/api` and `/api/drafts/ws` so `VITE_API_URL` / CORS config become optional locally.
- [ ] **Tests**: cover `useWebSocket` reconnect/backoff, auth flow, draft page.

---

## Phase 18: Makefile & Developer Workflow

Goal: one discoverable entry point for running the API, frontend and checks, replacing the multi-line command blocks in README / AGENTS / CONTRIBUTING.

- [ ] Add a root `Makefile` (`.PHONY`, `make help` listing targets via `##` comments) with at least:
  - [ ] `make setup` — `uv sync` + `npm install` + copy `.env.example` files if missing
  - [ ] `make db-up` / `db-down` / `db-reset` — Docker Compose Postgres
  - [ ] `make migrate` — `alembic upgrade head`; `make migration m="msg"` — autogenerate
  - [ ] `make api` — uvicorn with reload (hides the awkward `--app-dir ..` invocation)
  - [ ] `make web` — Vite dev server; `make dev` — DB + API + web
  - [ ] `make seed` — run `seed_nfl_data.py`
  - [ ] `make lint` / `format` / `typecheck` / `test` / `check` (everything CI runs)
- [ ] Make the API runnable the standard way: decide whether `api/` is a package imported as `api.main` from the repo root (current `--app-dir ..` hack) and simplify, e.g. a root `pyproject.toml` workspace or running uvicorn from the repo root. AGENTS.md already claims a root `pyproject.toml` that does not exist — fix the code or the doc.
- [ ] Point CI at the same `make` targets so local and CI cannot drift.
- [ ] Update README, CONTRIBUTING and AGENTS to use `make` targets.

---

## Phase 19: Repository Hygiene

- [ ] Reconcile docs with reality: AGENTS.md references a root `pyproject.toml`, a `utils/db/` that contradicts the documented layout, and `REWRITE_ROADMAP.md` as the active roadmap; mark `REWRITE_ROADMAP.md` as archived and link this file from README / AGENTS.
- [ ] Review `.gitignore`: it is a generic template with duplicate entries (`.env`, `*firebase*.json`, `.pylintrc`, `yarn.lock` ignored while Firebase is gone). Trim to what applies; ensure `.bin/`, caches and `dist/` stay ignored.
- [ ] Confirm CI (`.github/workflows/ci.yml`) runs Ruff check + format check, Mypy, pytest, Biome, `tsc`/build and Vitest, with dependency caching and a Postgres service for the new DB tests.
- [ ] Add dependency-update automation (Dependabot / Renovate) and a periodic `npm audit` / `pip-audit` step.
- [ ] Pin runtime versions (`.python-version` exists; add `.nvmrc` / `engines` for Node).
- [ ] Add pre-commit (or `make check` hook) running Ruff + Biome.
- [ ] Remove dead leftovers: Firebase mentions, stale "transitional shim" comments, unused assets (`react.svg`), the `DevQuickSync` once the admin flow is settled.
- [ ] Add a `LICENSE` and basic `SECURITY.md` if the repo is to be public.

---

## Phase 20: League Management, Invites, Draft Room Rebuild & Unified Settings
> Notes on a Sleeper/ESPN-style draft lifecycle. Pre-dev rules apply: redesign schemas freely, no migrations of old data.

- [ ] **League Page (replaces "Standings")**:
  - [ ] Rename the standings concept to a **League** page: standings, league info, members, commissioner tools, and upcoming draft status in one place.
  - [ ] Route/nav labels and `LeaguePage.tsx` updated; `StandingsTable` becomes one section of the page.
- [ ] **Commissioner Roles**:
  - [ ] Support one or more commissioners per league (`league_members.role`), enforced invariant: **never zero commissioners** (reject demoting/removing the last one).
  - [ ] Commissioner-only dependency on routes (`require_commissioner`) for settings, invites, draft control, and member management.
  - [ ] UI to promote/demote commissioners and remove members.
- [ ] **Invite Flow (Link + Join Code)**:
  - [ ] `league_invites` table: unique short code, league FK, created_by, optional expiry/max uses, revoked flag.
  - [ ] Endpoints: create/regenerate/revoke invite (commissioner), resolve invite (`GET /api/invites/{code}`), join (`POST /api/invites/{code}/join`).
  - [ ] Shareable link `/join/:code`: unauthenticated users are sent through login then returned to auto-join.
  - [ ] Homepage "Join with Code" input accepting the same code.
  - [ ] Commissioner invite panel on the League page: copy link, copy code, regenerate.
  - [ ] Joining creates a team for the user; block joins when league is full or draft has started (configurable).
- [ ] **My Team Page**:
  - [ ] Show the roster slot layout even when empty (QB/RB/WR/TE/FLEX/K/DEF etc. per league roster settings), with placeholders per slot.
  - [ ] Owner can edit team name (and avatar later); commissioner can edit any team name.
  - [ ] Roster management actions allowed by league rules (add/drop when free agency is enabled, swaps between rounds).
  - [ ] Alive/eliminated badges and next-game status per player.
- [ ] **Draft Lifecycle Rebuild (match Sleeper / ESPN draft room)**:
  - [ ] Draft states: `unscheduled` → `scheduled` → `lobby/waiting` → `in_progress` → `paused` → `completed`. Visiting the Draft tab must **never** auto-start a timer.
  - [ ] Commissioner **draft setup**: date/time, time per pick, draft type (snake, linear, third-round reversal; auction later), rounds, pick-clock behavior on timeout (auto-pick from queue / best available).
  - [ ] **Draft order**: no pre-assigned slots. Commissioner assigns each team to a slot manually, with a randomize button and manual reorder; order locked once started.
  - [ ] Draft lobby: participants join the room, presence indicators, countdown to scheduled start, commissioner **Start / Pause / Resume** controls.
  - [ ] **Server-authoritative timer**: persist `current_pick_deadline`/`pick_started_at` in the DB and broadcast over WebSocket; clients render countdown from server time so page reloads never reset the clock.
  - [ ] Fix pick submission: clicking Draft on a player must validate turn, player availability, and roster rules, then broadcast to all clients (REST + WS parity, idempotent).
  - [ ] Draft room UI: board grid (teams as columns in assigned order, rounds as rows, cells colored by position), available players list with search/position filters, **pick queue** (pre-rank), your-roster tab, pick feed, on-the-clock / on-deck indicators.
  - [ ] Reconnect/resync: full state snapshot on WebSocket connect.
  - [ ] Commissioner extras: undo last pick, force/auto pick, edit time per pick mid-draft.
- [ ] **Season & Players Defaults**:
  - [ ] Players page defaults to the configured season (`.env` season, currently 2025) instead of hardcoded 2024; single source of truth exposed via a `/api/config` (or similar) endpoint to the frontend.
  - [ ] League `season` is **read-only**, defaulted from `.env` at creation.
- [ ] **Unified League Settings (editable by commissioners)**:
  - [ ] Header block editable: league name, number of teams, commissioners (one or more). Season displayed but not editable.
  - [ ] Single **Settings** page with grouped sections: **League**, **Roster**, **Scoring** (all scoring combined under one header with subheaders: passing, rushing, receiving, kicking, defense, etc.), **Draft** (centralized: type, date/time, time per pick, order, rounds), and **Postseason**.
  - [ ] Lock settings that can't change after the draft starts (team count, roster size, draft order).
  - [ ] Backend `PATCH` endpoints with validation + commissioner authorization; changes reflected live for members.
- [ ] **Postseason-Specific Fantasy Settings** (what makes this different from a regular season):
  - [ ] **Free agency toggle**: whether players can be picked up from the free agent pool during the playoffs (and when: between rounds only, waiver priority vs. first-come).
  - [ ] **Per-round scoring multipliers** (e.g. Wild Card 1x, Divisional 1.5x, Conference 2x, Super Bowl 3x), configurable by commissioner.
  - [ ] Roster lock timing per round, and whether eliminated players can be swapped out between rounds.
  - [ ] Tiebreaker rules and handling of bye-week teams (no game in Wild Card round).
  - [ ] Settings stored on `LeagueSettings` with sane defaults and surfaced in the Settings page and landing explainer.
- [ ] **Docs**: update `README.md`, `AGENTS.md` (route map, new models/endpoints), and `.env.example` as each piece lands.
