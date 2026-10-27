# AGENTS.md — Agent Playbook for Post Season Fantasy (`postsznfantasy`)

## 1. Project Overview & Architecture Status

**Post Season Fantasy** is a fantasy football application tailored specifically for the NFL postseason (Wild Card, Divisional, Conference Championship, Super Bowl). Unlike full-season fantasy platforms, playoff fantasy features cascading elimination mechanics: as real NFL teams lose, their players are eliminated, making player survival and scoring progression central to league standings.

### Current Architecture vs. Modern Target Stack
> **CRITICAL ARCHITECTURAL CONTEXT**: The existing repository is a paused codebase built on **Flask 3** that has begun an incomplete transition toward a **FastAPI** backend (Pydantic schemas with `to_camel` exist in `api/models/`, but routes, app lifecycle, and database sessions are legacy Flask/Flask-SQLAlchemy). The frontend is a **React 18 + Vite** SPA in TypeScript.

| Component | Current Implementation | Target / Modern Rewrite Spec |
| :--- | :--- | :--- |
| **Backend Framework** | Flask 3.1.0 (`Flask`, `flask-cors`, `Flask-Bcrypt`) | **FastAPI** (ASGI, `uvicorn`, async routes) |
| **Package & Env Manager** | Legacy `pip` + flat `requirements.txt` | **`uv`** + standard **`pyproject.toml`** (`uv.lock`) |
| **Backend Lint / Format / Type** | `.flake8` (E501 ignored), no formatter, no static typing | **Ruff** (lint & format) + **Mypy** (strict typing) |
| **API Validation** | Hybrid: Pydantic 2.11.2 models in `api/models/` + unchecked Flask `request.json` | Full Pydantic v2 schemas for all requests/responses |
| **Real-Time / Sockets**| `flask-socketio` 5.5.1 / `python-socketio` 5.12.1 (incompatible with frontend client) | **FastAPI WebSockets** (`starlette.websockets`) or SSE |
| **ORM & Database** | SQLAlchemy 2.0.40 via `Flask-SQLAlchemy` 3.1.1 + raw `psycopg2-binary` 2.9.10 | SQLAlchemy 2.0 (async session) or SQLModel + PostgreSQL |
| **DB Migrations** | Imperative table creation scripts (`api/utils/db/setup.py`) | **Alembic** migrations |
| **Auth** | Firebase Admin SDK 6.7.0 (`verify_id_token` decorator) | Firebase Admin / JWT verified via FastAPI `Depends()` |
| **NFL Data Ingestion** | RapidAPI client (`requests` + `requests-cache`) with stubbed updates | Async HTTP client (`httpx`) + background ingestion tasks |
| **Frontend Runtime** | React 18.2.0, Vite 5.2.0, TypeScript 5.4.3 | React 18 / 19, Vite 5 / 6, strict TypeScript |
| **Frontend Linter & Formatter** | Legacy ESLint 8 (`.eslintrc.cjs`, 45 TS/lint errors) | **Biome** (`@biomejs/biome`, `biome.json`) |
| **UI Components** | MUI (`@mui/material` 5.15.14, Emotion 11.11) | MUI 5 / Joy UI or Tailwind + shadcn/ui |
| **Table Component** | `react-table` 7.8.0 (untyped, broken build) | TanStack Table v8 (`@tanstack/react-table`) |
| **State Management** | React Context (`UserContext`) + disjointed `useState` hooks | Zustand or TanStack Query + synchronized Context |

---

## 2. Directory Structure & Key Logic Map

```
postsznfantasy/
├── .flake8                     # Legacy Python linting config (to be replaced by ruff in pyproject.toml)
├── .gitignore                  # Git ignore rules
├── AGENTS.md                   # This agent operational guide
├── REWRITE_ROADMAP.md          # Architecture migration checklist
├── pyproject.toml              # Target: uv project definition, dependencies, ruff & mypy config
├── uv.lock                     # Target: uv lockfile
├── api/                        # Backend service (Python)
│   ├── app.py                  # Flask app factory, CORS config, blueprint registration
│   ├── run.py                  # Entrypoint runner script (currently commented out)
│   ├── requirements.txt        # Legacy unpinned pip dependencies (migrating to pyproject.toml)
│   ├── models/                 # Pydantic v2 DTO schemas
│   │   ├── base.py             # BaseSchema with camelCase alias generator & model_dump overrides
│   │   ├── league_models.py    # LeaguesByUser, Standings, TeamSimple
│   │   └── players_models.py   # Player DTO schema
│   ├── routes/                 # Flask Blueprints (to be migrated to APIRouter)
│   │   ├── admin_routes.py     # Healthcheck, manual DB setup & sync triggers
│   │   ├── draft_routes.py     # Draft status, pick history (contains runtime bug)
│   │   ├── league_routes.py    # League CRUD, default teams generation, standings, rosters
│   │   ├── main_routes.py      # Base '/' ping route
│   │   ├── players_routes.py   # Position-filtered players & season stats endpoints
│   │   └── user_routes.py      # Firebase token authentication & user onboarding
│   └── utils/
│       ├── calculations/       # Fantasy scoring & elimination logic
│       │   ├── fantasy_points_utils.py # Player stat-to-points evaluator (stubbed)
│       │   └── standings_utils.py     # Weekly playoff scoring & players-left tracker (stubbed)
│       ├── db/                 # Database models and legacy setup
│       │   ├── models.py       # SQLAlchemy ORM models (User, Team, League, Draft, Stats, etc.)
│       │   ├── pg_utils.py     # Raw psycopg2 connection wrappers
│       │   ├── setup.py        # DDL scripts and initial RapidAPI seeding
│       │   └── update.py       # Data updater stubs
│       ├── rapidapi/
│       │   └── rapidapi.py     # Client for RapidAPI NFL endpoints
│       ├── security/
│       │   └── firebase.py     # Token verification decorator (has import-time crash risk)
│       └── socketio/
│           └── socketio_handlers.py # Flask-SocketIO event handlers
└── frontend/                   # Frontend SPA (React + TypeScript + Vite)
    ├── package.json            # Scripts & dependencies
    ├── tsconfig.json           # Strict TypeScript configuration
    ├── vite.config.ts          # Vite build config
    ├── biome.json              # Target: Biome linter, formatter & import sorting config
    ├── .eslintrc.cjs           # Legacy ESLint config (to be retired in favor of Biome)
    └── src/
        ├── App.tsx             # Root layout, MUI AppBar, auth trigger, route declarations
        ├── main.tsx            # Vite DOM mount point
        ├── vite-env.d.ts       # Vite client types
        ├── contexts/
        │   └── UserContext.tsx # Context for logged-in user state
        ├── hooks/
        │   └── useWebSocket.ts # Native browser WebSocket hook (incompatible with Socket.IO)
        ├── pages/
        │   ├── CreateLeaguePage.tsx # Multi-accordion league configuration form
        │   ├── DraftPage.tsx   # Live draft room (timer, draft board, player drawer)
        │   ├── LeaguePage.tsx  # Standings display
        │   ├── PlayersPage.tsx # Player database and stats list
        │   ├── SettingsPage.tsx# League settings (stub)
        │   ├── TeamPage.tsx    # Roster management (stub)
        │   └── NotFoundPage.tsx# 404 handler
        └── components/
            ├── auth/firebase.ts# Client Firebase auth configuration
            ├── draft/          # DraftBoard, Countdown, PlayerSelector
            ├── league/         # StandingsTable
            ├── players/        # PlayersTable & CSS
            └── settings/       # RosterSettings & scoring accordion components
```

---

## 3. Core Development Commands

### Backend (`api/` or root with `uv`)

The project is migrating to **`uv`** as the unified Python package and project manager.

```bash
# === Modern uv Workflow (Target) ===
# Install / sync dependencies from pyproject.toml & uv.lock
uv sync

# Run FastAPI backend (Target state):
uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Linting and formatting with Ruff:
uv run ruff check api/          # Lint check
uv run ruff check --fix api/    # Auto-fix lint violations
uv run ruff format api/         # Format Python files
uv run ruff format --check api/ # Check formatting

# Static type checking with Mypy:
uv run mypy api/

# === Legacy Flask Workflow (Current state) ===
source api/venv/bin/activate
pip install -r api/requirements.txt
export FLASK_APP=api.app:create_app
export PG_URI="postgresql://user:password@localhost:5432/postszn"
export FIREBASE_SERVICE_ACCOUNT_KEY_PATH="/path/to/firebase-key.json"
flask run --port 5000
```

### Frontend (`frontend/`)

The frontend is migrating from legacy ESLint/Prettier to **Biome** for fast formatting and linting.

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev

# Run TypeScript type check & production build (currently fails due to known debt below)
npm run build

# === Biome Modern Tooling (Target) ===
npx @biomejs/biome check src/          # Lint, format check, and import sorting
npx @biomejs/biome check --write src/  # Auto-fix lint & format issues
npx @biomejs/biome format --write src/ # Format code
npx @biomejs/biome lint src/           # Run Biome linter only

# === Legacy ESLint (Current state) ===
npm run lint

# Preview production bundle
npm run preview
```

---

## 4. Coding Conventions & Architectural Patterns

### Tooling & Standards
- **Backend Formatting & Linting**: Managed by **Ruff** in `pyproject.toml` (target line length: 88, rule selection: `E`, `F`, `I`, `B`, `UP`).
- **Backend Type Safety**: Checked via **Mypy** in strict mode (`disallow_untyped_defs = true`, `plugins = ["pydantic.mypy"]`).
- **Frontend Quality**: Managed by **Biome** (`biome.json`), replacing ESLint and Prettier for unified AST-based linting, whitespace formatting, and automatic import organization.

### Backend
- **CamelCase API Contract**: All API JSON responses are formatted in `camelCase` for TypeScript consumption, while internal Python uses `snake_case`. The base schema `api/models/base.py` enforces this using Pydantic's `alias_generator = to_camel` with `populate_by_name = True`.
- **Dual Model Layer**: 
  - SQLAlchemy models (`api/utils/db/models.py`) represent relational tables.
  - Pydantic models (`api/models/`) define external API payloads.
- **Route Authorization**: Protected routes expect a Bearer token in the `Authorization` header (`Authorization: Bearer <Firebase_ID_Token>`). In Flask, this is wrapped via `@token_required`; in FastAPI, migrate to `Depends(get_current_user)`.
- **Database Connection Management**: Legacy code mixes raw `psycopg2` cursors (`api/utils/db/pg_utils.py`) with `Flask-SQLAlchemy` scoped sessions. New logic must use standard SQLAlchemy 2.0 sessions exclusively.

### Frontend
- **Environment Configuration**: Runtime variables use Vite conventions (`import.meta.env.VITE_*`).
  - `VITE_API_URL`: Backend HTTP origin (e.g., `http://localhost:5000` or `http://localhost:8000`).
  - `VITE_WS_URL`: WebSocket endpoint (e.g., `ws://localhost:8000`).
  - `VITE_FIREBASE_*`: Public Firebase client credentials.
- **Component Styling**: Material-UI (MUI v5) styled components and `sx` prop / inline styles, alongside custom component CSS files (`PlayersTable.css`).
- **State Flow**: Firebase handles auth credentials client-side; on login, the Firebase JWT is sent to `/api/user/login` to upsert/resolve the relational `User.id`.

---

## 5. Known Technical Debt & Critical Bugs

Future agents must be aware of the following immediate blockers and defects in the codebase:

1. **Frontend Build Failure (`tsc` & `npm run build`)**:
   - `frontend/src/components/draft/DraftBoard.tsx`: Lines 13-14 reference `Team` and `DraftPick` types which were never imported or declared in that scope.
   - `frontend/src/components/players/PlayersTable.tsx`: Missing type definitions for `react-table` (`TS7016`).
   - Unused imports (`React` imported when JSX transform doesn't require it) trigger errors under strict `noUnusedLocals: true`.
   - `frontend/src/pages/CreateLeaguePage.tsx`: Line 123 has dynamic string indexing on a static object without an index signature (`TS7053`).
2. **WebSocket Mismatch**:
   - `frontend/src/hooks/useWebSocket.ts` connects via native browser WebSocket (`new WebSocket(`${wsUrl}/socket.io/`)`), but `api/app.py` runs Flask-SocketIO. These protocols are fundamentally incompatible.
3. **Fatal Import-Time Execution**:
   - `api/utils/security/firebase.py`: Executes `credentials.Certificate(os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY_PATH'))` at the root module level. Fails on import if the environment variable is unset.
   - `api/utils/db/pg_utils.py` & `setup.py`: Default function parameter `conn: connection = get_pg_connection()` executes during import, crashing with `TypeError` if `PG_PORT` is missing.
4. **Runtime Route Bugs**:
   - `api/routes/draft_routes.py` (`get_draft_picks`): Returns `jsonify(draft.to_dict())` instead of draft picks, triggering `UnboundLocalError: local variable 'draft' referenced before assignment`.
   - `frontend/src/pages/DraftPage.tsx`: Line 144 requests `${apiUrl}/api/draft-info/${leagueId}` instead of the blueprint-prefixed `${apiUrl}/api/draft/draft-info/${leagueId}`, producing a 404.
5. **Disconnected State in Frontend**:
   - `frontend/src/App.tsx` initializes `UserProvider`, but maintains its own local `useState` for `userId`, leaving `UserContext` unpopulated.
   - `frontend/src/pages/CreateLeaguePage.tsx`: Calls `const userId = useUser();` directly as an object instead of destructuring.
6. **Stubbed Fantasy Calculations**:
   - `api/utils/calculations/standings_utils.py` uses `random.randint(0, 16)` for players left and `random.uniform(10, 100)` for weekly fantasy points. Real calculations must be implemented.
7. **Empty Stubs**:
   - `frontend/src/components/settings/LeagueInfo.tsx` is completely empty (0 bytes).
   - `frontend/src/pages/TeamPage.tsx` and `SettingsPage.tsx` are non-functional placeholders.
   - `api/utils/db/update.py` functions are all empty `pass` blocks.
8. **Missing Infrastructure & Modern Tooling Files**:
   - No `.env.example` in repo.
   - No `Dockerfile` or `docker-compose.yml` for local PostgreSQL setup.
   - Missing `pyproject.toml` (for `uv`, `ruff`, and `mypy`) and `biome.json` (for UI).
