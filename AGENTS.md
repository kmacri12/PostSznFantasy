# AGENTS.md — Agent Playbook for PostSzn Fantasy (`postsznfantasy`)

## 1. Project Overview & Architecture Status

**PostSzn Fantasy** is a fantasy football application tailored specifically for the NFL postseason (Wild Card, Divisional, Conference Championship, Super Bowl). Unlike full-season fantasy platforms, playoff fantasy features cascading elimination mechanics: as real NFL teams lose, their players are eliminated, making player survival and scoring progression central to league standings.

### Modern Architecture Spec
> [!IMPORTANT]
> **PRE-DEVELOPMENT / LOCAL-ONLY CONTEXT (ZERO MIGRATION CONSTRAINTS)**:
> This project is in an **early pre-dev, local-only prototyping phase**. There are **no production databases, no active users, no live data, and no backward-compatibility requirements**.
> Everything is on the table: schema redesigns, table wipes, dropping legacy code wholesale, replacing state management, or restructuring routes. Do not write complex data migrations or retain deprecated shims for existing data—build the cleanest target architecture from scratch.
>
> The codebase has been fully modernized to a **FastAPI** backend with async SQLAlchemy 2.0 and Pydantic v2 schemas, and a **React 18 + Vite** SPA in TypeScript.

| Component | Modern Implementation Stack |
| :--- | :--- |
| **Backend Framework** | **FastAPI** (ASGI, `uvicorn`, async routes, dependency injection) |
| **Package & Env Manager** | **`uv`** + standard **`pyproject.toml`** (`uv.lock`) |
| **Backend Lint / Format / Type** | **Ruff** (lint & format) + **Mypy** (strict static typing) |
| **API Validation** | Full Pydantic v2 schemas for all requests/responses (`BaseSchema` with `to_camel`) |
| **Real-Time / Sockets**| Native **FastAPI WebSockets** (`starlette.websockets` + `DraftConnectionManager`) |
| **ORM & Database** | SQLAlchemy 2.0 (`asyncpg` async session) + PostgreSQL 17 |
| **DB Migrations** | **Alembic** migrations (`alembic upgrade head`) |
| **Configuration** | **Pydantic Settings** (`api/core/config.py` cached singleton) |
| **Auth** | Supabase Auth (JWT verification via FastAPI `Depends(get_current_user)`) |
| **NFL Data Ingestion** | Async HTTP client (`httpx.AsyncClient`) with `tenacity` retries |
| **Frontend Runtime** | React 18, Vite 8, strict TypeScript |
| **Frontend Linter & Formatter** | **Biome** (`@biomejs/biome`, `biome.json`) |
| **UI Components** | MUI (`@mui/material` 5.15, Emotion 11.11) |
| **Table Component** | TanStack Table v8 (`@tanstack/react-table`) |
| **State Management** | React Context (`UserContext`) + native `useWebSocket` hook |

---

## 2. Directory Structure & Key Logic Map

```
PostSznFantasy/
├── docker-compose.yml          # PostgreSQL 17 container definition
├── Makefile                    # Single entry point for setup, run, lint, test
├── README.md                   # System documentation & developer quickstart
├── CONTRIBUTING.md             # Contribution guidelines, branching, & DoD
├── AGENTS.md                   # This agent operational playbook
├── ROADMAP.md                  # Active roadmap (phases 15+)
├── REWRITE_ROADMAP.md          # Archived modernization history (phases 1-14)
├── api/                        # Backend service (Python 3.13 + FastAPI)
│   ├── alembic/                # Database migrations
│   │   ├── versions/           # Migration revisions
│   │   └── env.py              # Alembic environment runner
│   ├── core/                   # Centralized application configuration
│   │   ├── config.py           # Settings model via pydantic-settings
│   │   └── logging.py          # Logging setup (JSON/console) + request-ID middleware
│   ├── db/                     # Async database sessions & models
│   │   ├── base.py             # DeclarativeBase metadata
│   │   ├── session.py          # asyncpg connection engine & get_db dependency
│   │   └── models/             # Domain-scoped SQLAlchemy 2.0 ORM models
│   │       ├── activity.py     # ActivityEvent (append-only feed) and ActivityView (last-viewed per member and feed)
│   │       ├── user.py         # User model
│   │       ├── league.py       # League, LeagueSettings, Team, Roster models
│   │       ├── draft.py        # Draft and DraftPick models
│   │       └── nfl.py          # NFLTeam, NFLPlayer, Stats, Game models
│   ├── dependencies/           # FastAPI dependency providers
│   │   ├── auth.py             # Supabase JWT validation (verify_token, get_current_user)
│   │   └── league.py           # LeagueMember/DraftMember/TeamMember guards (403 for non-members)
│   ├── models/                 # Pydantic v2 DTO schemas (camelCase serialization)
│   │   ├── base.py             # BaseSchema with alias_generator = to_camel
│   │   ├── activity_models.py  # Activity event payloads, feed pages, slot marks, score changes
│   │   ├── auth_models.py      # Auth exchange DTOs
│   │   ├── league_models.py    # League CRUD, Standings, Team DTOs
│   │   ├── draft_models.py     # Draft status and pick DTOs
│   │   └── players_models.py   # Player directory DTOs
│   ├── routers/                # Modular APIRouters
│   │   ├── activity.py         # League and team activity feeds, viewed markers
│   │   ├── admin.py            # Ingestion triggers (admin only)
│   │   ├── auth.py             # User onboarding & token exchange
│   │   ├── drafts.py           # Draft state/setup/order/controls/queue/REST picks + authenticated WebSocket
│   │   ├── invites.py          # Invite create/regenerate/revoke, public preview, join
│   │   ├── leagues.py          # League CRUD, members/roles, settings PATCH, standings
│   │   ├── teams.py            # Team page: per-round lineups, rename, lineup moves
│   │   └── players.py          # Player database & stats endpoints
│   ├── scripts/                # Database seeding & administrative CLI scripts
│   │   └── seed_nfl_data.py    # Unified on-demand NFL data seeder
│   ├── services/               # Decoupled ingestion & domain services
│   │   ├── eliminations.py     # mark_eliminated_teams
│   │   ├── standings.py        # Recomputes fantasy.standings (starters' round points, players left, ranks) for drafted leagues after polls, reconciles, admin score changes and draft completion; a failing league keeps its old rows
│   │   ├── draft_flow.py       # Draft state machine, order, pause/resume/undo, queue, auto-pick
│   │   ├── playoff_field.py    # Playoff field (draft pool), first Wild Card kickoff cutoff
│   │   ├── activity.py         # Append-only activity feed: append, feed pages, per-member viewed markers, slot marks
│   │   ├── stat_corrections.py # Snapshots a final game's stats before ingest overwrites them; posts stat_correction events
│   │   ├── settings_changes.py # record_settings_change (old/new diff to the feed) + the recompute hook; Epic 13 calls it too
│   │   ├── draft_clock.py      # 1s loop auto-picking expired server-side deadlines
│   │   ├── draft_events.py     # PICK_MADE / DRAFT_STATE broadcast payloads
│   │   ├── invites.py          # Invite codes and joining
│   │   ├── league_members.py   # Role changes with the never-zero-commissioners rule
│   │   ├── league_admin.py     # Team resizing and post-draft locks
│   │   ├── lineups.py          # Per-round lineup: slot layout, legal moves, kickoff locks
│   │   ├── round_status.py     # Per-round alive/eliminated/bye and kickoffs, derived from game results
│   │   ├── draft_picks.py      # Server-side pick validation (turn, availability, roster limits)
│   │   ├── scheduler.py        # Opt-in background sync/live-poll/elimination loop
│   │   └── ingestion/          # Async batch upsert services
│   │       ├── schemas.py      # Upstream DTOs & parsing helpers
│   │       ├── teams_ingest.py # Multi-row NFL team upserts (+ one synthetic DST player per team)
│   │       ├── dst_stats.py # Per-team DST stat rows from a box score (synthetic DST players, id = -teamID)
│   │       ├── guard.py    # Per-type advisory lock (skip overlapping runs) + last-synced record
│   │       ├── players_ingest.py # Chunked active player upserts
│   │       ├── season_stats_ingest.py # Chunked regular season stat upserts
│   │       └── box_scores_ingest.py # Playoff games & player box score upserts
│   ├── utils/
│   │   ├── calculations/       # Deterministic scoring & elimination logic
│   │   │   ├── fantasy_points_utils.py # Stat-to-points evaluator
│   │   │   └── standings_utils.py     # Round index/multiplier & player survival queries
│   │   └── rapidapi/
│   │       └── rapidapi.py     # Resilient httpx client for NFL data
│   ├── ws/                     # Real-time WebSocket layer (join after AUTH; inbound events whitelisted in routers/drafts.py)
│   │   └── draft_manager.py    # DraftConnectionManager (state, pick broadcasts)
│   ├── tests/                  # Pytest backend test suite
│   │   ├── conftest.py         # Test fixtures & dependency overrides
│   │   ├── test_scoring.py     # Unit tests for scoring evaluator
│   │   ├── test_golden_2025.py # Replays 2025 box scores against the commissioner's sheet (fixtures/golden_2025)
│   │   └── test_api_integration.py # Integration tests for API endpoints
│   ├── main.py                 # FastAPI application factory, CORS, lifespan
│   ├── pyproject.toml          # uv backend project specification & tool settings
│   └── uv.lock                 # Deterministic backend dependency lockfile
└── frontend/                   # Frontend SPA (React + TypeScript + Vite)
    ├── package.json            # Scripts & dependencies
    ├── tsconfig.json           # Strict TypeScript configuration
    ├── vite.config.ts          # Vite build configuration
    ├── biome.json              # Biome linter, formatter & import sorting config
    └── src/
        ├── App.tsx             # Routes, league list state, wires NavBar
        ├── theme.ts            # Dark-first MUI theme + design tokens
        ├── main.tsx            # Vite DOM mount point
        ├── contexts/
        │   └── UserContext.tsx # Authentication & current user context
        ├── hooks/
        │   ├── useWebSocket.ts # Native RFC 6455 WebSocket hook
        │   └── useWebSocket.test.ts # Hook test suite
        ├── pages/
        │   ├── LandingPage.tsx # Root route: hero, round explainer, user's leagues
        │   ├── CreateLeaguePage.tsx # Multi-step league creation wizard
        │   ├── DraftPage.tsx   # Live synchronized draft room
        │   ├── LeaguePage.tsx  # Standings display
        │   ├── PlayersPage.tsx # Player directory with TanStack Table
        │   ├── SettingsPage.tsx# League configuration viewer
        │   ├── TeamPage.tsx    # Roster management view
        │   └── NotFoundPage.tsx# 404 handler
        ├── components/
        │   ├── activity/       # ActivityFeed (collapsed, new dot), SlotMarker (override / asterisk), ChangedScore tooltip, describeEvent
        │   ├── layout/         # NavBar (blurred header, league switcher, drawer)
        │   ├── draft/          # DraftBoard, Countdown, PlayerSelector
        │   ├── league/         # StandingsTable
        │   ├── players/        # PlayersTable (TanStack Table v8)
        │   ├── team/           # LineupList (tap/drag lineup), OverrideDialog (commissioner confirm)
        │   └── settings/       # SettingsSection/ScoringForm/RosterForm generated from src/settings schemas
        ├── utils/
        │   ├── draftCue.ts     # Web Audio on-deck beep
        │   ├── scoring.ts      # Numeric coercion + defaults diff for league forms
        │   ├── logger.ts       # Leveled client logger (debug/info dev-only)
        │   └── supabase.ts     # Supabase client singleton
        └── test/               # Vitest environment setup
```

---

## 3. Core Development Commands

Everything is driven from the repository root through the `Makefile` (`make help` lists targets). CI runs the same `check-api` / `check-web` targets, so local and CI cannot drift.

```bash
make setup      # uv sync + npm install + create missing .env files
make db-up      # Postgres via Docker Compose        (make db-down / make db-reset)
make migrate    # alembic upgrade head               (make migration m="message" to autogenerate)
make api        # uvicorn api.main:app --reload on :8000
make web        # Vite dev server on :5173 (proxies /api)
make dev        # database + migrations + API + web
make seed       # NFL data seeder (SEED_ARGS="--season 2026 --with-box-scores"; --no-stats skips season stats)

make lint       # Ruff check + format check, Biome
make typecheck  # Mypy (strict) and tsc
make test       # pytest (incl. the Postgres tier, see below) and Vitest
make check      # all of the above plus the production build
make format     # auto-fix Ruff and Biome
```

`api/` is a Python package imported as `api.main` from the repo root; it has its own `pyproject.toml` and `uv.lock` (there is no root `pyproject.toml`). Tests under `api/tests/postgres/` need a throwaway database via `TEST_DATABASE_URL` and skip without one.

---

### End-to-end tests (`e2e/`)

`make e2e-install` (once), then `make e2e` (needs `make db-up`; `E2E_ARGS="--project=mobile -g draft"` filters). Playwright starts its own API (:8100) and Vite (:5273) against a throwaway `postszn_e2e` database that `python -m api.scripts.seed_e2e` rebuilds from the committed fixtures in `e2e/fixtures/` (regenerate with `python3 e2e/fixtures/build_fixtures.py`). Tests sign in through the **test-auth stub**: `Bearer e2e-user:<uid>` is accepted only when `TEST_AUTH_STUB=true` *and* `ENVIRONMENT` is `development` or `test` (Settings refuses to start otherwise; proven in `api/tests/test_test_auth_stub.py`). Never set it outside local/CI runs. The main project also lists `e2e-admin` in `ADMIN_SUPABASE_UIDS`/`VITE_ADMIN_SUPABASE_UIDS` so tests can exercise the admin-only "Refresh now" button.

`e2e/live/` is the replay suite (`playwright.live.config.ts`, run by `make e2e` after the main suite): it starts its own API on :8101 with the scheduler in replay mode (`e2e/fixtures/replay.json`, 2000x) against `postszn_e2e_live`, and asserts eliminations land as each replayed game finishes.

## 3b. Route Map (Phase 20)

| Area | Endpoints |
| :--- | :--- |
| Config | `GET /api/config` (season) |
| Leagues | `POST /api/leagues/create-league`, `GET /api/leagues/user-leagues`, `GET/PATCH /api/leagues/{id}`, `GET/PATCH /api/leagues/{id}/settings` (roster/scoring/postseason; roster shape locks once the draft starts), `PATCH/DELETE /api/leagues/{id}/members/{userId}` |
| Invites | `GET/POST/DELETE /api/leagues/{id}/invite` (commissioner), `GET /api/invites/{code}` (public preview), `POST /api/invites/{code}/join` |
| Teams | `GET/PATCH /api/teams/{id}` (the GET carries all four rounds' lineups: slots, unassigned and eliminated players, lock times, empty-starter count), `POST /api/teams/{id}/lineup` (`{round, playerId, slotIndex, confirmOverride?}`; `slotIndex: null` takes a player out; 409 when any player involved is locked or eliminated; the owner or a commissioner. A commissioner moving a locked player gets 409 `{detail, code: "override_confirmation_required"}` until the request repeats with `confirmOverride: true`; there is no add/drop in v1), `PUT /api/leagues/{id}/teams/{teamId}/owner` (commissioner assigns/unassigns a team) |
| Activity | `GET /api/leagues/{id}/activity`, `GET /api/teams/{id}/activity` (`?limit=&before=` keyset pages, newest first, members only; each event has `isNew`, the feed has `hasNew`), `POST .../activity/viewed` (`{upToEventId?}`, 204). The league feed is every event of the league; a team's feed is the events with its `team_id` (settings changes have none). `GET /api/leagues/user-leagues` carries `hasNewActivity` for the nav dot. Events: `lineup_move`, `commissioner_override`, `stat_correction`, `settings_change`; the lineup slot `mark` (override or commissioner-set) is derived from them, and lineup players carry `points` and `scoreChange` |
| Admin | `PUT /api/admin/playoff-field` (exactly 14 NFL team ids; drafts need the field set), other ingest triggers |
| Players | `GET /api/players/draft-pool` (draftable positions on playoff teams), `GET /api/players/player-list`, `GET /api/players/player-season-stats?season=&leagueId=` (`fantasyPoints` scored under that league's settings; draftable positions only unless `position` is given), `GET /api/players/sync-status` (last successful sync per ingestion type, plus `budgetExhausted` when the daily Tank01 cap has stopped polling); players carry `eliminated` (their NFL team is out) |
| Draft | `GET /api/drafts/draft-info/{leagueId}`, `PATCH /api/drafts/{leagueId}` (setup), `PUT .../order` (`teamIds` may contain `null` for unfilled slots; starting requires a full order), `POST .../order/randomize`, `POST .../control/{lobby,start,pause,resume,undo}`, `POST .../force-pick`, `POST .../picks`, `GET/PUT .../queue`, `WS /api/drafts/ws/{leagueId}` |

Draft rules (Epic 16): the pool is players on `nfl_teams.in_playoffs` (set by ingesting postseason games, which adds teams, or by the admin endpoint); `start_draft` needs `Settings.playoff_field_size` (14; the e2e stack uses 8) teams in it, and scheduling or starting after the first Wild Card kickoff (`nfl_games.game_week` 19) is refused with 409. Tank01 `FB` is stored as `RB`. `record_pick` rejects non-pool players and positions at their cap (`position_capped`); auto-pick skips both. Roster slots, position caps and team count lock at draft start; scoring, multipliers and team QB/K stay editable and go through `settings_changes.on_editable_settings_changed`.

Authorization: `LeagueMember` (any member), `LeagueCommissioner` (`require_commissioner`) and `TeamMember`/`DraftMember` dependencies in `api/dependencies/league.py`. A league always keeps at least one commissioner. Draft states: `unscheduled -> scheduled -> lobby -> in_progress <-> paused -> completed`; only an explicit commissioner action starts a draft, and the pick deadline is persisted server-side (clients render countdowns from `currentPickDeadline` + `serverTime`).

## 4. Coding Conventions & Architectural Patterns

### Core Engineering Principles
- **KISS (Keep It Simple, Stupid)**: Favor minimal, straightforward implementations over clever abstractions, indirection, or over-engineered scaffolding.
- **Intent-Driven Comments (Explain WHY, Not WHAT)**: Minimize comments to only what is strictly necessary. Never restate what the code clearly does; document the non-obvious *why*, edge-case rationale, or external constraints.
- **Self-Documenting Code**: Choose expressive identifier and symbol names so the code explains itself without narrative commentary.
- **Continuous Documentation Maintenance Mandate**: Whenever modifying architecture, endpoints, database models, environment variables, or workflows, you **must update the relevant documentation** (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, or `.env.example`).

### Tooling & Standards
- **Backend Formatting & Linting**: Managed by **Ruff** in `pyproject.toml` (target line length: 88, rule selection: `E`, `F`, `I`, `B`, `UP`).
- **Backend Type Safety**: Checked via **Mypy** in strict mode (`disallow_untyped_defs = true`, `plugins = ["pydantic.mypy"]`).
- **Frontend Quality**: Managed by **Biome** (`biome.json`) for unified AST-based linting, whitespace formatting, and automatic import organization.

### Backend Patterns
- **Product rules**: [docs/product-rules.md](docs/product-rules.md) is the source of truth for how the game is played (per-round lineups, kickoff locks, team QB/K, scoring defaults, tiebreakers). Read it before changing lineup, scoring, standings or draft behaviour, and update it with the code. Work is tracked as Epics 11-18 in GitHub Issues.
- **RapidAPI ingestion**: Tank01 nests stats by category with string values; all mapping lives in `api/services/ingestion/schemas.py`. Read [docs/rapidapi-tank01.md](docs/rapidapi-tank01.md) before touching ingest.
- **CamelCase API Contract**: All API JSON responses are formatted in `camelCase` for TypeScript consumption, while internal Python uses `snake_case`. The base schema `api/models/base.py` enforces this using Pydantic's `alias_generator = to_camel` with `populate_by_name = True`.
- **ERD**: [docs/erd.md](docs/erd.md) is the entity-relationship diagram. Any change to `api/db/models/` or an Alembic migration (table, column, foreign key) must update it in the same PR; `api/tests/test_erd.py` fails when the diagram drifts from the models.
- **Dual Model Layer**: 
  - SQLAlchemy models (`api/db/models/`) represent relational database tables.
  - Pydantic models (`api/models/`) define external API payloads and schemas.
- **Route Authorization**: Protected routes inject `Depends(get_current_user)`, which extracts and verifies Supabase JWT Bearer tokens from the `Authorization` header.
- **Async Database Connection**: All database access uses SQLAlchemy 2.0 async sessions injected via `DbSession` (`Annotated[AsyncSession, Depends(get_db)]`).
- **Logging**: Use `logger = logging.getLogger(__name__)`, never `print()`. `setup_logging()` (called in lifespan and CLI scripts) emits JSON unless `ENVIRONMENT=development`; `RequestLoggingMiddleware` logs every request and sets `X-Request-ID`. Frontend uses `createLogger(scope)` from `utils/logger.ts`, not `console.*`.
- **Error tracking**: Sentry is inert without `SENTRY_DSN` (API, `api/core/observability.py`) / `VITE_SENTRY_DSN` (SPA, `utils/sentry.ts`, lazy-loaded). `logger.error` forwards to it, so never put PII in error messages; extend the scrubbers when adding new fields. See [docs/deploy/sentry.md](docs/deploy/sentry.md).
- **Centralized Configuration**: All environment variables are strongly typed and accessed via `get_settings()` from `api/core/config.py`.

### Frontend Patterns
- **Mobile-first, always**: The app is used primarily on phones. Design every screen for ~375px width first, then scale up. Default to one vertical column; do not spread a single control across rows/columns of a grid; no horizontal scrolling (exception: the draft board grid, which scrolls both ways with pinned headers) or hover-only interactions; touch targets at least 44px; drag-and-drop must work by touch (delayed `TouchSensor` so scrolling still works).
- **Visual verification is part of every UI change**: After each UI step, launch the app (the `run` skill / built-in browser), use `resize_window` with the `mobile` preset (375x812) and look at the actual rendering, then check desktop. Fix anything clipped, overlapping, cramped or oddly laid out before reporting the work done. Reset the viewport to `desktop` afterward.
- **Environment Configuration**: Runtime variables use Vite conventions (`import.meta.env.VITE_*`).
  - `VITE_API_URL`: Backend HTTP origin; optional locally because the Vite dev server proxies `/api` to `http://localhost:8000`.
  - `VITE_WS_URL`: WebSocket origin; optional for the same reason (defaults to the page origin). Both are required in production builds (Cloudflare Pages build vars). Full contract: `api/.env.example`, `frontend/.env.example`.
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase project publishable API key (`sb_publishable_...`, with fallback to legacy `VITE_SUPABASE_ANON_KEY`).
- **Component Styling**: Material-UI (MUI v5) styled components and `sx` prop.
- **State Flow**: Supabase handles auth credentials client-side; on session initialization or auth state change, the Supabase access token is sent to `/api/auth/login` to resolve/upsert the relational `User.id` into `UserContext`.
