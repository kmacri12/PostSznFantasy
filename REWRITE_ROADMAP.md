# REWRITE_ROADMAP.md — Modernization & Best Practices Checklist

## 1. Executive Summary & App Domain

> [!IMPORTANT]
> **PRE-DEVELOPMENT / LOCAL-ONLY CONTEXT (CLEAN SLATE REFACTOR)**:
> This application is strictly in **pre-development and running locally**. There are **no production databases, no active users, and no legacy data to preserve**. 
> Future agents and developers have complete freedom to:
> - Rethink or redesign database schemas from scratch (no complex data migration steps needed).
> - Completely tear down and replace Flask endpoints, database helpers, and WebSocket handlers with clean FastAPI primitives.
> - Overhaul frontend state, component hierarchies, or routing without backward-compatibility friction.

**Post Season Fantasy** (`postsznfantasy`) is a niche fantasy football platform for the NFL playoffs. 
Unlike standard season-long leagues that conclude at Week 18, postseason fantasy leagues run through four knockout playoff rounds:
1. **Wild Card Round**
2. **Divisional Round**
3. **Conference Championships**
4. **Super Bowl**

### Core Mechanics & User Journey
- **Roster & Elimination Mechanics**: League members draft players from playoff-bound NFL teams. When an NFL team is eliminated, its players can no longer accumulate fantasy points. A team owner's success depends both on player performance and predicting which NFL teams will advance deep into February.
- **League Creation & Granular Customization**: Commissioners configure league size (e.g., 4–16 teams), roster composition (QB, RB, WR, TE, Flex, K, DST, Bench), and extensive custom scoring rules across passing, rushing, receiving, carrying/turnovers, kicking distance brackets, and defensive scoring events.
- **Real-Time Snake Draft**: A synchronized draft room with live pick timers, round-by-round draft matrices, searchable/position-filtered player selection, and auto-pick fallback.
- **Playoff Standings & Player Survival**: A dashboard breaking down team scoring by playoff round alongside a live count of active "players remaining".
- **Player Database & External Stats Ingestion**: Synchronization of NFL teams, player rosters, and game box scores sourced via external sports APIs (RapidAPI NFL endpoints).

---

## 2. Current State vs. Target State Comparison

```mermaid
flowchart TD
    subgraph Current_Legacy_State ["Current Legacy State (Paused)"]
        PKG_OLD["pip + requirements.txt<br/>(Flat, unpinned)"]
        F_OLD["Flask 3 + Blueprints<br/>(Synchronous)"]
        LINT_PY_OLD[".flake8<br/>(No auto-formatter, no mypy)"]
        WS_OLD["Flask-SocketIO<br/>(Engine.IO / Socket.IO)"]
        DB_OLD["Flask-SQLAlchemy + Raw psycopg2<br/>(Imperative setup.py DDL)"]
        AUTH_OLD["Firebase Admin<br/>(@token_required wrapper)"]
        FE_OLD["React 18 + Vite<br/>(45 TS Build Errors, react-table v7)"]
        FE_LINT_OLD["ESLint 8 + .eslintrc.cjs<br/>(Slow, 47 warnings/errors)"]
        DATA_OLD["requests + requests-cache<br/>(Stubbed random scoring)"]
    end

    subgraph Target_Modern_State ["Target Modern Architecture (FastAPI + React)"]
        PKG_NEW["uv + pyproject.toml<br/>(uv.lock, sub-second resolution)"]
        F_NEW["FastAPI + APIRouter<br/>(Asynchronous ASGI)"]
        LINT_PY_NEW["Ruff + Mypy<br/>(Format, lint & strict typing in pyproject.toml)"]
        WS_NEW["Native FastAPI WebSockets<br/>(RFC 6455 + ConnectionManager)"]
        DB_NEW["SQLAlchemy 2.0 / SQLModel<br/>(Alembic Migrations)"]
        AUTH_NEW["FastAPI Depends()<br/>(Dependency Injection + Auth Bearer)"]
        FE_NEW["React 18/19 + Vite<br/>(Strict TS, TanStack Table v8, Clean Context)"]
        FE_LINT_NEW["Biome<br/>(biome.json, instant formatting & linting)"]
        DATA_NEW["httpx async client<br/>(Deterministic scoring engine)"]
    end

    Current_Legacy_State ==>|Modern Agentic Rewrite| Target_Modern_State
```

---

## 3. Checklist of Modern Agentic Coding Best Practices

This checklist outlines the sequence of refactor tasks for developers and AI coding agents to elevate this repository into a maintainable, high-performance, production-ready system.

> **Engineering Guiding Light**:
> - **KISS**: Write the simplest code that solves the problem. Eliminate speculative features or needless layers of indirection.
> - **Comment Minimization & Intent**: Code explains *what*; comments are reserved strictly for *why* (non-obvious domain rules, hardware/protocol constraints, bug workarounds). If code needs a comment to explain what it does, refactor and rename first.

### Phase 1: Environment, Tooling & Modern Packaging
- [x] **Migrate Backend Packaging to `uv` & `pyproject.toml`**:
  - [x] Initialize `api/pyproject.toml` using `uv` to manage Python 3.13 dependencies.
  - [x] Migrate dependencies from `api/requirements.txt` to `api/pyproject.toml` with pinned semver constraints and delete `requirements.txt`.
  - [x] Generate deterministic lockfile `api/uv.lock` via `uv lock`.
  - [x] Retire legacy virtual environment scripts in favor of `uv run` and `uv sync` in `api/`.
- [x] **Configure Ruff (Format & Lint) & Mypy**:
  - [x] Configure `[tool.ruff]` in `api/pyproject.toml` with line-length 88 and target version `py313`.
  - [x] Enable rulesets: `E` (Pycodestyle errors), `F` (Pyflakes), `I` (isort imports), `B` (flake8-bugbear), `UP` (pyupgrade).
  - [x] Configure `[tool.ruff.format]` to eliminate manual styling divergence.
  - [x] Deprecate `.flake8`.
  - [x] Configure `[tool.mypy]` in `api/pyproject.toml` with `strict = true`, `disallow_untyped_defs = true`, and Pydantic plugin.
- [x] **Migrate Frontend Tooling to Biome (`biome.json`)**:
  - [x] Install `@biomejs/biome` in `frontend/package.json`.
  - [x] Initialize `frontend/biome.json` configured for React 18/TypeScript with:
    - Code formatter (spaces, 2 indents, 80-100 column limit).
    - Linter with recommended rules enabled.
    - Automatic import sorting (`organizeImports`).
  - [x] Replace ESLint npm scripts in `frontend/package.json`:
    - `"lint": "biome check src/"`
    - `"format": "biome format src/ --write"`
    - `"check": "biome check --write src/"`
  - [x] Remove `.eslintrc.cjs` and redundant ESLint plugins (`eslint`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).
- [x] **Standardize Environment Configuration**:
  - [x] Add `.env.example` in `api/` and `frontend/` documenting all required secrets:
    - Backend (`api/.env.example`): `PG_URI`, `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DBNAME`, `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`, `RAPIDAPI_BASEURL`, `RAPIDAPI_APIKEY`, `RAPIDAPI_APIHOST`, `SEASON_YEAR`.
    - Frontend (`frontend/.env.example`): `VITE_API_URL`, `VITE_WS_URL`, `VITE_FIREBASE_*`.
- [x] **Local Containerization**:
  - [x] Create `docker-compose.yml` defining PostgreSQL 16 with healthchecks and a volume mount for local development.

---

### Phase 2: FastAPI Backend Migration
- [x] **Application Skeleton & ASGI Setup**:
  - [x] Initialize FastAPI app with `lifespan` context manager for startup/shutdown events (replacing global module side-effects).
  - [x] Replace Flask blueprints with modular `APIRouter` instances:
    - `api/routers/auth.py` (User onboarding & token exchange)
    - `api/routers/leagues.py` (League CRUD, settings, teams)
    - `api/routers/drafts.py` (Draft status, pick submission, draft state)
    - `api/routers/players.py` (Player directory, season & playoff stats)
    - `api/routers/admin.py` (Ingestion & DB management)
- [x] **Eliminate Fatal Import-Time Side Effects**:
  - [x] Refactor Firebase Admin SDK initialization into a lazy dependency provider (`get_firebase_app`).
  - [x] Remove `conn: connection = get_pg_connection()` default arguments in `setup.py`, `update.py`, and `pg_utils.py`.
- [x] **Dependency Injection & Authentication**:
  - [x] Implement `get_current_user` using `fastapi.security.HTTPBearer` and `Depends()` to extract and verify Firebase tokens.
  - [x] Implement `get_db` session dependency for scoped database transactions with auto-rollback on exception.
- [x] **Type Rigor & Schema Validation**:
  - [x] Define comprehensive Pydantic v2 schemas for all request payloads (`LeagueCreate`, `DraftPickSubmit`, etc.) instead of unchecked `request.json`.
  - [x] Standardize API response models using `response_model=...` and camelCase serialization (`BaseSchema`).
- [x] **Native WebSocket Draft Room**:
  - [x] Replace `flask-socketio` with native FastAPI WebSocket endpoint (`@router.websocket("/ws/draft/{league_id}")`).
  - [x] Implement a thread-safe `DraftConnectionManager` to broadcast pick events, clock ticks, and draft state to connected clients.
- [x] **Decommission Legacy Flask Architecture**:
  - [x] Purge all legacy Flask packages (`flask`, `flask-sqlalchemy`, `flask-socketio`, `flask-cors`, `flask-bcrypt`) from `pyproject.toml` and `uv.lock`.
  - [x] Delete deprecated Flask application files: `api/app.py`, `api/run.py`, `api/routes/`, and `api/utils/socketio/`.
  - [x] Remove Flask-coupled `token_required` decorator from `api/utils/security/firebase.py`.
  - [x] Add transitional SQLAlchemy `DeclarativeBase` shim in `api/utils/db/models.py` to allow existing ORM models to function without `Flask-SQLAlchemy` pending full Phase 3 rewrite.

---

### Phase 3: Database & Migration Architecture
- [x] **Modern SQLAlchemy 2.0 / SQLModel Setup**:
  - [x] Migrate models from legacy `db.Model` syntax to SQLAlchemy 2.0 `DeclarativeBase` with typed mapped columns (`Mapped[int] = mapped_column(...)`).
  - [x] Disambiguate duplicate `Standings` model (renamed ORM model to `LeagueStanding` to avoid conflict with Pydantic schema).
  - [x] Split monolithic `api/utils/db/models.py` into domain-scoped modules under `api/db/models/` (`user.py`, `league.py`, `draft.py`, `nfl.py`) with a unified `__init__.py` re-exporting all ORM classes.
- [x] **Async Database Session (`api/db/session.py`)**:
  - [x] Replace raw `psycopg2` connections with `asyncpg`-backed `create_async_engine` (dialect `postgresql+asyncpg://`).
  - [x] Production-grade pool config: `pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`, `expire_on_commit=False`.
  - [x] `init_db()` / `close_db()` lifecycle hooks wired into FastAPI `lifespan`; graceful `engine.dispose()` on shutdown.
  - [x] `get_db()` FastAPI dependency: yields `AsyncSession`, auto-commits on success, rolls back on exception.
  - [x] `DbSession = Annotated[AsyncSession, Depends(get_db)]` type alias for clean route injection.
  - [x] Delete `api/utils/db/pg_utils.py`, `api/utils/db/setup.py`, and `api/utils/db/update.py`; thin re-export bridge kept at `api/utils/db/models.py`.
- [x] **Automated Migrations with Alembic**:
  - [x] Initialize Alembic (`alembic init alembic`) with `env.py` pointing to the unified declarative metadata.
  - [x] Generate initial revision from current schema and deprecate raw DDL strings in `api/utils/db/setup.py` (deleted).
- [x] **Relational Integrity**:
  - [x] Configure proper foreign key cascades (`ondelete="CASCADE"`) between Leagues, Teams, Drafts, and DraftPicks.

---

### Phase 3.5: Centralized Configuration with PydanticSettings
- [x] **Add `pydantic-settings` dependency**:
  - [x] Run `uv add pydantic-settings` in `api/` to add `pydantic-settings>=2.7.0` to `pyproject.toml` and regenerate `uv.lock`.
- [x] **Define `Settings` model (`api/core/config.py`)**:
  - [x] Create a single `Settings` class extending `pydantic_settings.BaseSettings` with typed, validated fields for every env var currently scattered across `os.getenv()` call sites:
    ```python
    from pydantic import PostgresDsn
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

        # Database
        pg_uri: PostgresDsn

        # Firebase
        firebase_service_account_key_path: str

        # RapidAPI
        rapidapi_baseurl: str
        rapidapi_apikey: str
        rapidapi_apihost: str

        # App
        season_year: int = 2025
    ```
  - [x] Use Pydantic's `PostgresDsn` type for `pg_uri` so the connection string is structurally validated at startup rather than failing silently at first query.
  - [x] Declare `season_year` with a typed default so it is optional in `.env` but never arrives as a raw `str`.
- [x] **Expose a cached singleton via `lru_cache`**:
  - [x] Add `get_settings() -> Settings` decorated with `@lru_cache(maxsize=1)` so the `.env` file is parsed exactly once per process and is injectable as `Depends(get_settings)` in any route.
- [x] **Replace all `os.getenv` / `os.environ` call sites**:
  - [x] `api/db/session.py` — database URL passed to `create_async_engine`.
  - [x] Firebase credential provider (`api/utils/security/firebase.py`) — service account key path.
  - [x] `api/utils/rapidapi/rapidapi.py` — RapidAPI base URL, key, and host header.
  - [x] `api/alembic/env.py` — sync DB URL for migrations.
- [x] **Eager validation on startup**:
  - [x] Call `get_settings()` inside the FastAPI `lifespan` before the DB engine is initialized so a missing or malformed var raises a `ValidationError` with a clear field-level message before the server accepts any traffic.
- [x] **Update `.env.example`** to exactly mirror the snake_case field names declared in `Settings` (Pydantic-Settings resolves env vars case-insensitively by default, so `PG_URI` in the shell maps to `pg_uri` on the model).

---

### Phase 4: Business Logic & Ingestion Engine
- [x] **Deterministic Fantasy Scoring Engine**:
  - [x] Replace stubbed `calculate_player_points` in `api/utils/calculations/fantasy_points_utils.py` with an evaluator that parses player box scores against active `LeagueSettings`.
  - [x] Cover fractional scoring for passing/rushing/receiving yards, turnover penalties, kicker yardage tiers, and defensive scoring events.
- [x] **Playoff Elimination & Survival Logic**:
  - [x] Replace `random.randint` in `get_players_left` with a query against `NFLTeam.is_active` to count remaining rostered players.
  - [x] Replace `random.uniform` in `get_team_fantasy_points_by_week` with real point summation per playoff round.
- [x] **Resilient NFL Stats Ingestion Client**:
  - [x] Refactor `RapidApi` client to use `httpx.AsyncClient` with configurable retry policies (`tenacity`) and rate limiting.
  - [x] Implement real update logic in `api/utils/db/update.py` for game schedules, box scores, and active team rosters.

---

### Phase 5: Frontend Refactor & State Synchronization
- [x] **Unified Auth & User Context**:
  - [x] Wire `frontend/src/contexts/UserContext.tsx` directly into the Firebase `onAuthStateChanged` stream in `App.tsx`.
  - [x] Fix `CreateLeaguePage.tsx` to properly destructure `const { userId } = useUser();`.
- [x] **Complete Missing Views**:
  - [x] Implement `frontend/src/pages/TeamPage.tsx` to render a user's roster, player statuses, and lineup positions.
  - [x] Implement `frontend/src/pages/SettingsPage.tsx` and fill empty `LeagueInfo.tsx` (0 bytes).
- [x] **Draft Room WebSocket Client Alignment**:
  - [x] Update `frontend/src/hooks/useWebSocket.ts` to connect to standard FastAPI WebSocket (`ws://<backend>/ws/draft/<league_id>`) with reconnection backoff and heartbeat.
  - [x] Align message schema with backend broadcast events (`PICK_MADE`, `TIMER_UPDATE`, `DRAFT_COMPLETE`).
- [x] **Fix Endpoint Routing**:
  - [x] Correct API path in `DraftPage.tsx` line 144 from `/api/draft-info/${leagueId}` to `/api/draft/draft-info/${leagueId}` (or FastAPI equivalent).
- [x] **Modern Table Migration**:
  - [x] Migrate `PlayersTable.tsx` to `@tanstack/react-table` v8 for type-safe column definitions, virtualization, and position filtering.
- [x] **Frontend TypeScript Hygiene & Build Fixes**:
  - [x] Resolve legacy TypeScript build errors (`DraftBoard`, `CreateLeaguePage`, `PlayerSelector`, `PlayersTable`) to achieve green `npm run build`.

---

### Phase 6: Testing, Observability & CI Pipeline
- [x] **Backend Test Suite**:
  - [x] Add `pytest` and `pytest-asyncio` using `uv add --dev pytest pytest-asyncio`.
  - [x] Write unit tests for scoring calculation logic across various scoring configurations (`tests/test_scoring.py`).
  - [x] Write integration tests for league creation, draft picks, and authentication checks using `httpx.AsyncClient` (`tests/test_api_integration.py`).
- [x] **Frontend Test Suite**:
  - [x] Configure `vitest` and `@testing-library/react` for component and hook testing (`useWebSocket`, `Countdown`).
- [x] **Automated CI Workflow (`.github/workflows/ci.yml`)**:
  - [x] Python Job:
    - [x] `uv sync --frozen`
    - [x] `uv run ruff check .`
    - [x] `uv run ruff format --check .`
    - [x] `uv run mypy .`
    - [x] `uv run pytest`
  - [x] Frontend Job:
    - [x] `npm ci`
    - [x] `npx @biomejs/biome check src/`
    - [x] `npm run build`
    - [x] `npm run test`

---

### Phase 7: Repository Documentation & Developer Experience
- [ ] **Core Documentation Overhaul (`README.md`)**:
  - [ ] Rewrite root `README.md` to provide full architectural context, high-level system overview, and quickstart instructions.
  - [ ] Document prerequisites (Python 3.13+, `uv`, Node.js 20+, Docker Compose, PostgreSQL 16).
  - [ ] Provide step-by-step local setup: cloning, `.env` file configuration, DB startup (`docker compose up -d`), backend startup (`uv run uvicorn ...`), and frontend startup (`npm run dev`).
  - [ ] Include common troubleshooting tips (database connection, Firebase emulator or credentials setup, seed data).
- [ ] **Contribution & Development Standards (`CONTRIBUTING.md`)**:
  - [ ] Create `CONTRIBUTING.md` defining branching models, PR guidelines, commit conventions, and definition of done.
  - [ ] Detail development standards: KISS principle, self-documenting code, intent-driven comments (documenting *why*, not *what*).
  - [ ] Document code quality verification commands for contributors (`uv run ruff check`, `uv run mypy`, `npx @biomejs/biome check`, test runners).
- [ ] **Agent & Contributor Context Mapping**:
  - [ ] Align `AGENTS.md` and `README.md` cross-references so both human contributors and AI agents have unified domain context, directory maps, and operational workflows.
  - [ ] Keep file structures and documentation locations standard and idiomatic (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and module-level docs where appropriate) with zero unnecessary fluff.
- [ ] **Continuous Agent & Human Documentation Maintenance Rule**:
  - [ ] Explicitly mandate in `AGENTS.md` and `CONTRIBUTING.md` that AI agents and human contributors must update documentation whenever modifying architecture, dependencies, endpoints, models, or developer workflows.
  - [ ] Establish documentation synchronization as a mandatory checklist item in PR guidelines and agent task-completion protocols (no stale commands, paths, or architectural discrepancies).

---

### Phase 8: Standardized Logging Framework (UI & API)
- [ ] **Backend Structured Logging (`api/`)**:
  - [ ] Configure Python standard `logging` / `structlog` via centralized setup in `api/core/logging.py`.
  - [ ] Standardize log output format: JSON in production/containerized environments, colorized human-readable format for local development.
  - [ ] Add FastAPI request logging middleware to track incoming requests, method, path, status code, response time, and correlation/request IDs (`X-Request-ID`).
  - [ ] Integrate contextual logging for key lifecycle and domain events: database connection pool status, WebSocket draft room connection/disconnection/events, RapidAPI ingestion jobs, and auth failures.
  - [ ] Replace any leftover `print()` statements across backend modules with typed logger instances (`logger = logging.getLogger(__name__)`).
- [ ] **Frontend Logging & Telemetry (`frontend/`)**:
  - [ ] Create a lightweight client logging utility (`src/utils/logger.ts`) supporting log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`).
  - [ ] Guard debug/info logs behind environment flags (`import.meta.env.DEV`) to prevent console pollution in production builds.
  - [ ] Instrument WebSocket events in `useWebSocket.ts` (connection states, reconnection attempts, protocol payload mismatches) with clear contextual logs.
  - [ ] Standardize frontend error logging across React Error Boundaries and API fetch wrappers.
