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
| **ORM & Database** | SQLAlchemy 2.0 (`asyncpg` async session) + PostgreSQL 16 |
| **DB Migrations** | **Alembic** migrations (`alembic upgrade head`) |
| **Configuration** | **Pydantic Settings** (`api/core/config.py` cached singleton) |
| **Auth** | Supabase Auth (JWT verification via FastAPI `Depends(get_current_user)`) |
| **NFL Data Ingestion** | Async HTTP client (`httpx.AsyncClient`) with `tenacity` retries |
| **Frontend Runtime** | React 18, Vite 5, strict TypeScript |
| **Frontend Linter & Formatter** | **Biome** (`@biomejs/biome`, `biome.json`) |
| **UI Components** | MUI (`@mui/material` 5.15, Emotion 11.11) |
| **Table Component** | TanStack Table v8 (`@tanstack/react-table`) |
| **State Management** | React Context (`UserContext`) + native `useWebSocket` hook |

---

## 2. Directory Structure & Key Logic Map

```
PostSznFantasy/
├── docker-compose.yml          # PostgreSQL 16 container definition
├── pyproject.toml              # UV workspace root (tool configurations)
├── README.md                   # System documentation & developer quickstart
├── CONTRIBUTING.md             # Contribution guidelines, branching, & DoD
├── AGENTS.md                   # This agent operational playbook
├── ROADMAP.md                  # Active roadmap (hardening & best practices)
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
│   │       ├── user.py         # User model
│   │       ├── league.py       # League, LeagueSettings, Team, Roster models
│   │       ├── draft.py        # Draft and DraftPick models
│   │       └── nfl.py          # NFLTeam, NFLPlayer, Stats, Game models
│   ├── dependencies/           # FastAPI dependency providers
│   │   ├── auth.py             # Supabase JWT validation (verify_token, get_current_user)
│   │   └── league.py           # LeagueMember/DraftMember/TeamMember guards (403 for non-members)
│   ├── models/                 # Pydantic v2 DTO schemas (camelCase serialization)
│   │   ├── base.py             # BaseSchema with alias_generator = to_camel
│   │   ├── auth_models.py      # Auth exchange DTOs
│   │   ├── league_models.py    # League CRUD, Standings, Team DTOs
│   │   ├── draft_models.py     # Draft status and pick DTOs
│   │   └── players_models.py   # Player directory DTOs
│   ├── routers/                # Modular APIRouters
│   │   ├── admin.py            # Ingestion triggers (admin only)
│   │   ├── auth.py             # User onboarding & token exchange
│   │   ├── drafts.py           # Draft info/picks + authenticated draft WebSocket
│   │   ├── leagues.py          # League CRUD, teams, rosters, standings
│   │   └── players.py          # Player database & stats endpoints
│   ├── scripts/                # Database seeding & administrative CLI scripts
│   │   └── seed_nfl_data.py    # Unified on-demand NFL data seeder
│   ├── services/               # Decoupled ingestion & domain services
│   │   ├── eliminations.py     # mark_eliminated_teams
│   │   ├── draft_picks.py      # Server-side pick validation (turn, availability, roster limits)
│   │   ├── scheduler.py        # Opt-in background sync/live-poll/elimination loop
│   │   └── ingestion/          # Async batch upsert services
│   │       ├── schemas.py      # Upstream DTOs & parsing helpers
│   │       ├── teams_ingest.py # Multi-row NFL team upserts
│   │       ├── players_ingest.py # Chunked active player upserts
│   │       ├── season_stats_ingest.py # Chunked regular season stat upserts
│   │       └── box_scores_ingest.py # Playoff games & player box score upserts
│   ├── utils/
│   │   ├── calculations/       # Deterministic scoring & elimination logic
│   │   │   ├── fantasy_points_utils.py # Stat-to-points evaluator
│   │   │   └── standings_utils.py     # Round scoring & player survival queries
│   │   └── rapidapi/
│   │       └── rapidapi.py     # Resilient httpx client for NFL data
│   ├── ws/                     # Real-time WebSocket layer (join after AUTH; inbound events whitelisted in routers/drafts.py)
│   │   └── draft_manager.py    # DraftConnectionManager (state, pick broadcasts)
│   ├── tests/                  # Pytest backend test suite
│   │   ├── conftest.py         # Test fixtures & dependency overrides
│   │   ├── test_scoring.py     # Unit tests for scoring evaluator
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
        │   ├── layout/         # NavBar (blurred header, league switcher, drawer)
        │   ├── draft/          # DraftBoard, Countdown, PlayerSelector
        │   ├── league/         # StandingsTable
        │   ├── players/        # PlayersTable (TanStack Table v8)
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

### Backend (`api/` or root with `uv`)

The project uses **`uv`** as the unified Python package and project manager.

```bash
cd api

# Install / sync dependencies from pyproject.toml & uv.lock
uv sync

# Run database migrations:
uv run alembic upgrade head

# Run FastAPI backend with auto-reload:
uv run uvicorn api.main:app --app-dir .. --host 0.0.0.0 --port 8000 --reload

# Linting and formatting with Ruff:
uv run ruff check .          # Lint check
uv run ruff check --fix .    # Auto-fix lint violations
uv run ruff format .         # Format Python files
uv run ruff format --check . # Check formatting

# Static type checking with Mypy:
uv run mypy .

# Run pytest test suite:
uv run pytest
```

### Frontend (`frontend/`)

The frontend uses **Biome** for fast formatting and linting, and **Vitest** for unit tests.

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (http://localhost:5173)
npm run dev

# Run Biome lint, formatting check, and import sorting:
npx @biomejs/biome check src/
npx @biomejs/biome check --write src/  # Auto-fix lint & format issues

# Run TypeScript type check & production build:
npm run build

# Run Vitest test suite:
npm run test
```

---

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
- **CamelCase API Contract**: All API JSON responses are formatted in `camelCase` for TypeScript consumption, while internal Python uses `snake_case`. The base schema `api/models/base.py` enforces this using Pydantic's `alias_generator = to_camel` with `populate_by_name = True`.
- **Dual Model Layer**: 
  - SQLAlchemy models (`api/db/models/`) represent relational database tables.
  - Pydantic models (`api/models/`) define external API payloads and schemas.
- **Route Authorization**: Protected routes inject `Depends(get_current_user)`, which extracts and verifies Supabase JWT Bearer tokens from the `Authorization` header.
- **Async Database Connection**: All database access uses SQLAlchemy 2.0 async sessions injected via `DbSession` (`Annotated[AsyncSession, Depends(get_db)]`).
- **Logging**: Use `logger = logging.getLogger(__name__)`, never `print()`. `setup_logging()` (called in lifespan and CLI scripts) emits JSON unless `ENVIRONMENT=development`; `RequestLoggingMiddleware` logs every request and sets `X-Request-ID`. Frontend uses `createLogger(scope)` from `utils/logger.ts`, not `console.*`.
- **Centralized Configuration**: All environment variables are strongly typed and accessed via `get_settings()` from `api/core/config.py`.

### Frontend Patterns
- **Environment Configuration**: Runtime variables use Vite conventions (`import.meta.env.VITE_*`).
  - `VITE_API_URL`: Backend HTTP origin; optional locally because the Vite dev server proxies `/api` to `http://localhost:8000`.
  - `VITE_WS_URL`: WebSocket origin; optional for the same reason (defaults to the page origin).
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase project publishable API key (`sb_publishable_...`, with fallback to legacy `VITE_SUPABASE_ANON_KEY`).
- **Component Styling**: Material-UI (MUI v5) styled components and `sx` prop.
- **State Flow**: Supabase handles auth credentials client-side; on session initialization or auth state change, the Supabase access token is sent to `/api/auth/login` to resolve/upsert the relational `User.id` into `UserContext`.
