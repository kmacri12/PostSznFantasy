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
  - **Database & ORM**: PostgreSQL 16 accessed via asynchronous [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (`asyncpg`), with migrations managed by [Alembic](https://alembic.sqlalchemy.org/).
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

## Local Setup & Quickstart

### 1. Clone Repository & Setup Environment Files

```bash
git clone https://github.com/your-org/postsznfantasy.git
cd PostSznFantasy

# Configure backend environment
cp api/.env.example api/.env

# Configure frontend environment
cp frontend/.env.example frontend/.env
```

Review `api/.env` and `frontend/.env` to customize settings. Provide your Supabase project credentials (`SUPABASE_URL` in backend; `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in frontend).

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

### 2. Start PostgreSQL Database

Launch PostgreSQL 16 using Docker Compose:

```bash
docker compose up -d
```

Verify that the container is healthy:

```bash
docker compose ps
```

### 3. Setup and Run Backend Service (`api/`)

From the `api/` directory:

```bash
cd api

# Install all runtime and development dependencies
uv sync

# Run database migrations with Alembic
uv run alembic upgrade head

# Start the FastAPI application with auto-reload
uv run uvicorn api.main:app --app-dir .. --host 0.0.0.0 --port 8000 --reload
```

The API service is now accessible at `http://localhost:8000`. Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

### 4. Database Seeding & Ingestion Pipeline

> An opt-in background scheduler (`api/services/scheduler.py`) can run the daily sync, poll box scores during live playoff games, and auto-eliminate losing teams. It is **off by default**; set `SCHEDULER_ENABLED=true` (plus `SCHEDULER_ROSTER_SYNC_HOURS`, `SCHEDULER_LIVE_POLL_SECONDS`) to enable.

PostSzn Fantasy includes an asynchronous batch ingestion pipeline that populates NFL teams, active rosters/players, season stats, and playoff game box scores from RapidAPI using chunked PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` operations.

#### Option A: On-Demand CLI Seeding
From the `api/` directory, run the standalone seeding runner:

```bash
cd api

# Full seed (teams + active players + season stats)
PYTHONPATH=.. uv run python -m api.scripts.seed_nfl_data

# Seeding with specific flags
PYTHONPATH=.. uv run python -m api.scripts.seed_nfl_data --season 2024 --teams-only
PYTHONPATH=.. uv run python -m api.scripts.seed_nfl_data --season 2024 --players-only
PYTHONPATH=.. uv run python -m api.scripts.seed_nfl_data --season 2024 --with-box-scores
```

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

## Verification & Testing

### Backend Verification
From the `api/` directory:
```bash
# Check formatting and linting
uv run ruff check .
uv run ruff format --check .

# Run static type checking
uv run mypy .

# Run unit and integration tests
uv run pytest
```

The tests under `api/tests/postgres/` run against a real, throwaway Postgres database
(`TEST_DATABASE_URL`, default `postgresql+asyncpg://postgres:postgres@localhost:5432/postszn_test`;
the schemas are dropped and recreated each run, so never point it at a database you care about).
They skip automatically when the database is unreachable and fail in CI.

### Frontend Verification
From the `frontend/` directory:
```bash
# Lint, format check, and import sorting
npx @biomejs/biome check src/

# Run TypeScript type check and production bundle build
npm run build

# Run frontend unit tests
npm run test
```

---

## Common Troubleshooting

- **PostgreSQL Connection Failures**:
  - Ensure the Docker container is up: `docker compose ps`.
  - Verify that the port (`5432`) is not already claimed by a local PostgreSQL daemon (`lsof -i :5432` or `sudo systemctl status postgresql`).
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
├── docker-compose.yml          # Local PostgreSQL 16 container definition
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
