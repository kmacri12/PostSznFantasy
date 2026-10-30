# PostSzn Fantasy (`postsznfantasy`)

PostSzn Fantasy is a fantasy football application tailored specifically for the NFL postseason (Wild Card, Divisional, Conference Championships, and Super Bowl). 

Unlike standard season-long fantasy leagues that conclude at NFL Week 18, postseason fantasy features cascading elimination dynamics: as real NFL teams are eliminated from playoff contention, their players can no longer accumulate fantasy points. Success requires both player talent evaluation and strategic bracket forecasting.

---

## Architecture Overview

PostSzn Fantasy is architected as an asynchronous backend API service paired with a modern React single-page frontend:

- **Backend (`api/`)**:
  - **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (ASGI, async route handlers, automatic OpenAPI docs).
  - **Packaging & Tooling**: Managed with [`uv`](https://docs.astral.sh/uv/) via `pyproject.toml` and `uv.lock`.
  - **Code Quality**: Strict type enforcement via [Mypy](https://mypy-lang.org/) and linting/formatting via [Ruff](https://docs.astral.sh/ruff/).
  - **Database & ORM**: PostgreSQL 17 accessed via asynchronous [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (`asyncpg`), with migrations managed by [Alembic](https://alembic.sqlalchemy.org/).
  - **Configuration**: Strongly typed application settings via [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/).
  - **Real-Time Communication**: Native RFC 6455 WebSockets with a centralized connection manager (`DraftConnectionManager`) broadcasting live draft state, timers, and picks. Clients authenticate with an `AUTH` message carrying their Supabase JWT, send `MAKE_PICK {playerId}`, and the server validates turn order, availability and roster limits before persisting and broadcasting `PICK_MADE`.
  - **Authentication**: Token verification via Supabase Auth (Asymmetric ES256 verification via Supabase JWKS using `pyjwt[crypto]`) with dependency injection (`get_current_user`).
  - **External Ingestion**: Asynchronous HTTP client ([HTTPX](https://www.python-httpx.org/)) with exponential backoff retries via [Tenacity](https://tenacity.readthedocs.io/) for RapidAPI NFL stats.

- **Frontend (`frontend/`)**:
  - **Framework & Build**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/).
  - **Formatting & Linting**: Ultra-fast AST-based code checking and formatting via [Biome](https://biomejs.dev/).
  - **UI & Layout**: Material UI (MUI v5) components.
  - **Data Tables**: Type-safe headless tabular display with [@tanstack/react-table](https://tanstack.com/table/v8).
  - **State & Real-Time**: React Context (`UserContext`) and native WebSocket hook (`useWebSocket`) for synchronized draft boards.

---

## Prerequisites

Before running the application locally, ensure you have the following installed:

- **Docker & Docker Compose**: PostgreSQL container execution.
- **Python 3.13+**: Backend runtime.
- **`uv`**: High-performance Python package and project manager ([Installation Guide](https://docs.astral.sh/uv/getting-started/installation/)).
- **Node.js 20+ & npm**: Frontend runtime and package management.

---

## Playing a League

- **Leagues & invites:** the creator is a commissioner (promote more, never fewer than one). Share the invite link (`/join/CODE`) or the code; joining claims an open team, and is blocked once the league is full or the draft has started (configurable).
- **Draft:** the commissioner schedules it, assigns slots (manual or randomize), opens the lobby and presses Start. The pick clock lives on the server, so reloads never reset it; expired picks auto-pick from the team's queue, then best available (never a position the team has capped out). The pool is the 14 playoff teams' players, a draft can't start until that field is set or after the first Wild Card kickoff, and roster slots, position caps and team count lock at draft start.
- **Settings:** one page for League, Roster, Scoring, Draft and Postseason (round multipliers, joining after the draft starts). The season comes from `SEASON_YEAR` and is read-only per league.

## Local Setup & Quickstart

### 1. Clone, Install & Configure

Prerequisites: [`uv`](https://docs.astral.sh/uv/), Node.js >= 22.12 (see `frontend/.nvmrc`), Docker and `make`. Run `make help` to list every target.

```bash
git clone https://github.com/your-org/postsznfantasy.git
cd PostSznFantasy

# Installs backend + frontend dependencies and creates api/.env and frontend/.env
make setup
```

Review `api/.env` and `frontend/.env`. Provide your Supabase project credentials (`SUPABASE_URL` in backend; `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in frontend).

#### Setting Up Supabase Auth & Google OAuth
1. Create a project at [supabase.com](https://supabase.com).
2. Under **Project Settings > API Keys**:
   - In the **Publishable and secret API keys** tab, obtain your **Publishable Key** (`sb_publishable_...`). Configure this as `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env`.
   - Copy your **Project URL** (`https://<project-ref>.supabase.co`) for `VITE_SUPABASE_URL` in `frontend/.env` and `SUPABASE_URL` in `api/.env`.
3. Token Signature Verification in Backend:
   - Supabase signs user session JWTs asymmetrically (e.g. `ES256`).
   - The backend automatically retrieves and caches the public verification keys directly from Supabase's JWKS endpoint (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`). No shared JWT secret needs to be stored or shared with the backend.
4. To enable Google Sign-In:
   - Navigate to **Authentication > Providers > Google**.
   - Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with Authorized redirect URI set to: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Paste the Google Client ID and Client Secret into Supabase and enable Google provider.
   - In **Authentication > URL Configuration**, add `http://localhost:5173` to the Redirect URLs list.

### 2. Start the Stack

```bash
make db-up      # PostgreSQL 17 via Docker Compose (waits until healthy)
make migrate    # alembic upgrade head
make api        # FastAPI on http://localhost:8000 (docs at /docs), auto-reload
make web        # Vite on http://localhost:5173 (proxies /api to the API)
```

`make dev` runs the database, migrations, API and web server together. Moving from a PostgreSQL 16 container to 17 needs one `make db-reset`, since the old data directory is incompatible. After a schema change that is not backwards compatible (this project has no data to preserve), `make db-reset` wipes and recreates the local database.

The API is a package imported as `api.main` from the repository root (`uvicorn api.main:app`); the `make` targets handle this, and `api/` holds its own `pyproject.toml` and `uv.lock`.

### 4. Database Seeding & Ingestion Pipeline

> An opt-in background scheduler (`api/services/scheduler.py`) can run the daily sync, poll box scores during live playoff games, and auto-eliminate losing teams. It is **off by default**; set `SCHEDULER_ENABLED=true` (plus `SCHEDULER_ROSTER_SYNC_HOURS`, `SCHEDULER_LIVE_POLL_SECONDS`) to enable.

PostSzn Fantasy includes an asynchronous batch ingestion pipeline that populates NFL teams, active rosters/players, season stats, and playoff game box scores from RapidAPI using chunked PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` operations.

#### Option A: On-Demand CLI Seeding

```bash
# Default: teams + active players + season stats
make seed
make seed SEED_ARGS="--no-stats"   # skip season stats

# Specific flags
make seed SEED_ARGS="--season 2026 --teams-only"
make seed SEED_ARGS="--season 2026 --players-only"
make seed SEED_ARGS="--season 2026 --with-box-scores"
```

The seed fails loudly if teams, players or stats come back empty, and prints the remaining RapidAPI quota. The roster endpoint only serves the current season, so keep `SEASON_YEAR` current. Set `RAPIDAPI_CACHE_DIR` in `api/.env` to replay responses from disk while developing. API details and quirks: [docs/rapidapi-tank01.md](docs/rapidapi-tank01.md).

#### Option B: Admin API Trigger
Trigger complete batch ingestion over HTTP via the admin router. Only users whose Supabase id (the JWT `sub`) is listed in `ADMIN_SUPABASE_UIDS` in `api/.env` are allowed; everyone else gets a 403:

```bash
curl -X POST http://localhost:8000/api/admin/update/all \
  -H "Authorization: Bearer <SUPABASE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"season": "2024", "withStats": true, "withBoxScores": false}'
```

Returns duration and record counts:
```json
{
  "status": "success",
  "durationMs": 1420,
  "synced": {
    "teams": 32,
    "players": 1450,
    "stats": 980,
    "games": 0
  }
}
```

#### Option C: Dev Quick-Sync in UI
When running the frontend in local development mode (`npm run dev`), click the **`[Dev] Seed NFL Data`** button in the navigation header to open the dialog and trigger on-demand seeding directly from the browser.

### 5. Setup and Run Frontend SPA (`frontend/`)

In a new terminal, navigate to the `frontend/` directory:

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend application is now accessible at `http://localhost:5173`.

---

## Deployment Constraints

- **One process only.** Run `uvicorn api.main:app --workers 1 --proxy-headers` on a single always-on instance. `DraftConnectionManager` keeps WebSocket connections in memory and the draft clock runs inside the API process, so extra workers or instances would split broadcasts. Hosts that sleep when idle (free tiers) are unsuitable because nothing auto-picks while the server is asleep.
- Error tracking (Sentry, off unless `SENTRY_DSN` / `VITE_SENTRY_DSN` are set) and its alert rules: [docs/deploy/sentry.md](docs/deploy/sentry.md).
- Production hosting (Cloudflare Pages, Fly.io, Supabase) and the launch checklist: [docs/deploy/cutover-runbook.md](docs/deploy/cutover-runbook.md).
- User requests never call Tank01; only `/api/admin/*` and the opt-in scheduler spend RapidAPI quota.
- Open work is tracked in [GitHub Issues](https://github.com/kmacri12/PostSznFantasy/issues) (labels `draft`, `ingestion`, `deploy`, `scaling`). Design decisions: [docs/api-decisions.md](docs/api-decisions.md).

## Verification & Testing

```bash
make check      # everything CI runs: lint, type check, tests, production build
make lint       # Ruff (check + format) and Biome
make typecheck  # Mypy and tsc
make test       # pytest and Vitest
make format     # auto-fix both apps
```

Each target also has an `-api` / `-web` variant (e.g. `make check-api`). CI runs the same `make check-api` and `make check-web` targets.

The tests under `api/tests/postgres/` run against a real, throwaway Postgres database
(`TEST_DATABASE_URL`, default `postgresql+asyncpg://postgres:postgres@localhost:5433/postszn_test`;
the schemas are dropped and recreated each run, so never point it at a database you care about).
They skip automatically when the database is unreachable and fail in CI.

---

## Common Troubleshooting

- **PostgreSQL Connection Failures**:
  - Ensure the Docker container is up: `docker compose ps`.
  - Compose publishes Postgres on host port `5433` (override with `PG_PORT`) so it does not clash with a system PostgreSQL on `5432`; if `5433` is also taken, check `lsof -i :5433` or `sudo systemctl status postgresql`.
  - Verify that `PG_URI` in `api/.env` aligns with the credentials in `docker-compose.yml`.

- **Supabase Authentication Setup**:
  - `SUPABASE_URL` is required: the API refuses to start without it and always verifies token signatures against the project JWKS (there is no unsigned fallback).
  - When configuring live authentication, verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are defined in `frontend/.env`, and that `SUPABASE_URL` is set in `api/.env`. Modern asymmetric tokens are validated against Supabase's JWKS endpoint automatically without needing a shared secret.

- **Alembic Database Migration Desync**:
  - To recreate local schema cleanly from scratch:
    ```bash
    docker compose down -v
    docker compose up -d
    cd api && uv run alembic upgrade head
    ```

- **WebSocket Connection Refused on Draft Page**:
  - Verify that the backend is running at `http://localhost:8000`.
  - Locally the Vite dev server proxies `/api` (including the WebSocket) to port 8000; make sure the API is running there, or set `VITE_API_URL` / `VITE_WS_URL` in `frontend/.env` if it lives elsewhere.

---

## Directory Map

```
PostSznFantasy/
├── docker-compose.yml          # Local PostgreSQL 17 container definition
├── pyproject.toml              # UV workspace root (tool configurations)
├── README.md                   # System documentation & developer quickstart
├── CONTRIBUTING.md             # Developer workflow, branching, standards, and definition of done
├── AGENTS.md                   # Agent guidelines, domain playbook, and architectural specs
├── ROADMAP.md                  # Active roadmap
├── REWRITE_ROADMAP.md          # Archived refactoring history (phases 1-14)
├── api/                        # FastAPI application service
│   ├── alembic/                # Database migrations
│   ├── core/                   # Application config (`Settings`) & constants
│   ├── db/                     # Async session provider and SQLAlchemy 2.0 ORM models
│   ├── dependencies/           # FastAPI dependency injection (auth, db session)
│   ├── models/                 # Pydantic v2 DTO schemas (camelCase serialization)
│   ├── routers/                # Modular APIRouter endpoints
│   ├── scripts/                # Utility and seeding CLI scripts (`seed_nfl_data.py`)
│   ├── services/               # Decoupled ingestion domain services (`teams`, `players`, `stats`, `box_scores`)
│   ├── tests/                  # Pytest unit and integration test suite
│   ├── utils/                  # Ingestion client and fantasy calculation engines
│   └── ws/                     # Native WebSocket connection manager
└── frontend/                   # React 18 + Vite + TypeScript application
    ├── biome.json              # Biome linting and formatting configuration
    └── src/
        ├── components/         # Modular UI components (draft board, dev quick sync, player table, etc.)
        ├── contexts/           # Authentication and global state
        ├── hooks/              # Custom hooks (e.g., useWebSocket)
        └── pages/              # Application views and routing
```

## End-to-end tests

Playwright tests in `e2e/` drive the real app in a 375px iPhone viewport (primary) plus a small desktop smoke run. `make e2e-install` installs Chromium once; `make e2e` starts the API and Vite itself and runs the suite (`E2E_ARGS="--project=mobile -g draft"` to filter). A second suite (`e2e/live/`) replays a saved postseason through the real poll, scoring and elimination code and checks the app as games finish. CI runs both on every pull request.
