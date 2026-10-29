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

- [ ] **C1 — Remove the unsigned-JWT fallback** (`api/dependencies/auth.py`): when `SUPABASE_URL` is unset the code decodes with `verify_signature=False`, so a missing env var in a deployed environment lets anyone forge any identity. Make `SUPABASE_URL` required at startup; tests already override `get_current_user`.
- [ ] **C2 — Authenticate and authorize the draft WebSocket** (`api/routers/drafts.py`): anyone can connect to `/api/drafts/ws/{league_id}` and broadcast arbitrary events; the fallback branch rebroadcasts any client message.
  - [ ] Verify the JWT on connect (query param or first message) and require league membership.
  - [ ] Replace client-trusted `PICK_MADE` relaying with server-side pick validation (turn order, availability, roster limits), persistence to `DraftPick`, then broadcast.
  - [ ] Whitelist inbound event types; reject the rest.
- [ ] **C3 — League-membership authorization**: `draft-info`, `draft-picks`, settings, teams, standings and `teams/{id}` only require a login. Add a shared dependency (e.g. `LeagueMember`) and apply it. Decide which `/api/players/*` routes need auth (they currently have none).
- [ ] **C4 — Restrict `/api/admin/*`**: add an admin check (allow-list or role); today any logged-in user can trigger paid ingestion or eliminate NFL teams.
- [ ] **C5 — Stop leaking exception text** in 401 responses; log details server-side, return a generic message.
- [ ] **C6 — Fix `login_or_register`** (`api/routers/auth.py`): use `INSERT … ON CONFLICT` to remove the first-login race; drop the `user.id or 1` fallback; drop fake `@postszn.local` emails (make email nullable or require it).
- [ ] Tests for each of the above (unauthenticated WS, non-member access, non-admin admin call, forged token).

---

## Phase 16: Backend FastAPI Best-Practice Gaps

- [ ] **Camel-case contract**: make `LoginPayload`, `BoxScoreRequest`, `EliminateTeamsRequest`, `UpdateAllRequest` extend `BaseSchema`.
- [ ] **Single source of truth for settings fields**: `ScoringSettings`, `LeagueSettingsResponse`, the ORM `LeagueSettings` and the 7 frontend settings components repeat ~80 fields. Generate the response from `ScoringSettings` / `RosterSettings` (or restructure into a grouped/JSON model).
- [ ] **One transaction pattern**: `get_db` commits on success *and* routes call `commit()`. Pick one (recommended: `get_db` owns commit; routes only `flush`).
- [ ] **Remove cruft routes**: legacy `/get_leagues_by_user` alias; five identical router-level `GET /` health endpoints; keep one health endpoint that also checks the DB.
- [ ] **Config-driven deployment settings**: CORS origins, pool size/overflow into `Settings`; resolve `.env` path independent of working directory.
- [ ] **Schema hygiene** (DB is disposable — redo the migration freely):
  - [ ] Add indexes on FKs (`teams.league_id`, `teams.owner_id`, `draft_picks.draft_id`, `draft_picks.team_id`, `standings.league_id`, …) and a unique constraint on `league_settings.league_id` (and `drafts.league_id` if one draft per league). Verify against the current migration first.
  - [ ] Tighten nullability (`Draft.status`, `league_id`-style columns, etc.); use enums / `CheckConstraint` for `status` and `draft_type` (`api/models/enums.py` exists).
  - [ ] Replace `Team.roster` `ARRAY(Integer)` with a proper roster join table.
  - [ ] Move the hardcoded draft defaults in `create_league` (start in 7 days, 60 s/pick) into settings or the request.
  - [ ] Run `alembic revision --autogenerate` on a fresh DB and confirm the diff is empty.
- [ ] **RapidAPI client** (`api/utils/rapidapi/rapidapi.py`): reuse one `httpx.AsyncClient`; bound the cache; retry only 5xx / transport errors (not 4xx); let failures propagate so a failed sync is not reported as "0 rows synced"; delete the `RapidApi` alias.
- [ ] **Typing**: remove the mypy `ignore_errors` override for `api.utils.*` and fix what surfaces.
- [ ] **Tooling**: set Ruff `known-first-party = ["api"]` so `api.*` imports sort correctly.
- [ ] **Layout cleanup**: delete `api/utils/db/models.py` shim; move `update.py`'s logic into `services/`; collapse `dependencies/db.py` re-export; consider dropping `psycopg2-binary` (run Alembic with an async env).
- [ ] **Tests**: add a Postgres-backed test tier (CI service container) for SQL, relationships and scoring/elimination paths; add WebSocket and commissioner-only settings tests. Current tests mock the session entirely.

---

## Phase 17: Frontend React Best-Practice Gaps

- [ ] **Single API client**: ~15 call sites hand-build `${apiUrl}/api/...` and `Authorization` headers. Create one axios instance (or `fetch` wrapper) with `baseURL` and a token interceptor.
- [ ] **Server-state layer**: adopt TanStack Query for loading/error/caching/cancellation; remove hand-rolled `useEffect` fetching (no abort handling today).
- [ ] **`UserContext`**:
  - [ ] Memoize the context value and wrap functions in `useCallback`.
  - [ ] Drop the `user_id` / `userId` dual handling and the redundant `idToken` state.
  - [ ] Don't `await` backend calls inside `onAuthStateChange`; avoid re-posting `/auth/login` on every token refresh.
  - [ ] Surface login-sync failures to the UI instead of only logging.
- [ ] **`useWebSocket`**: send the auth token; exponential backoff with cap; don't reconnect after intentional close; use `ReturnType<typeof setTimeout>`; keep a message queue/callback rather than only the latest message; send `eventType` consistently with the server.
- [ ] **Route-level code splitting**: `React.lazy` + `Suspense` per page (bundle is ~850 kB / 250 kB gzip); split MUI/vendor chunks.
- [ ] **Dependency hygiene**:
  - [ ] `npm audit fix` (7 vulnerabilities in prod deps incl. 1 critical, 4 high).
  - [ ] Remove `@types/axios`, `@types/react-router-dom` (libs ship own types) and unused `dotenv`.
  - [ ] Review upgrades: Vite, Vitest, `@mui/*` 5.18, `react-router-dom` 6.30.x.
- [ ] **Type safety**: replace the 33 Biome `any` warnings (settings components take `any`); use generated or shared API types; consider `noUncheckedIndexedAccess`.
- [ ] **Deduplicate settings UI**: the 7 `Scoring*SettingsComponent` files become one data-driven component fed by a field schema.
- [ ] **Dev proxy**: add a Vite `server.proxy` for `/api` and `/api/drafts/ws` so `VITE_API_URL` / CORS config become optional locally.
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
