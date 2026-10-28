# Contributing to PostSzn Fantasy

Thank you for contributing to **PostSzn Fantasy** (`postsznfantasy`). This document outlines our branch strategy, commit standards, architectural principles, and definition of done.

---

## 1. Core Engineering Principles

All contributions—whether submitted by human engineers or AI agents—must adhere to these guiding principles:

- **KISS (Keep It Simple, Stupid)**: Build the simplest working solution. Avoid premature abstractions, speculative interfaces, or gratuitous indirection.
- **Intent-Driven Comments (Explain WHY, Not WHAT)**: Code must be self-explanatory through expressive naming and clear logic. Reserve comments strictly for non-obvious domain rules, hardware/protocol quirks, or external library workarounds. Never write comments that merely narrate what the next line of code does.
- **Self-Documenting Code**: Choose descriptive names for functions, classes, and variables so that the intent is immediately clear from the code alone.
- **Documentation Synchronization Mandate**: Whenever you introduce or modify endpoints, database schemas, environment variables, dependencies, or workflows, you **must update the relevant documentation** (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, or `.env.example`). Stale documentation is treated as a build-breaking defect.

---

## 2. Git Workflow & Branching

We adhere to a feature-branch workflow based on conventional branching:

- **Main Branch**: `main` is always releasable and protected.
- **Feature Branches**: Branch off `main` using descriptive prefixes:
  - `feature/<short-description>`: New functionality
  - `fix/<short-description>`: Bug fixes
  - `refactor/<short-description>`: Code restructuring without functional alterations
  - `test/<short-description>`: Test suite additions or modifications
  - `docs/<short-description>`: Documentation changes

### Commit Conventions

Use Conventional Commits syntax: `<type>(<scope>): <summary>`:

- `feat(api)`: Add endpoint or backend feature
- `feat(ui)`: Add frontend component or UI feature
- `fix(draft)`: Resolve draft synchronization bug
- `refactor(db)`: Modernize SQLAlchemy relationship or query
- `test(scoring)`: Add test coverage for scoring calculation
- `docs(readme)`: Update setup or configuration instructions

Keep summaries imperative and lowercase (e.g., `feat(api): add player playoff stats endpoint`).

---

## 3. Code Standards & Verification Commands

Before opening a pull request, verify all code quality checks locally. Both the backend and frontend must pass all verification steps without errors or warnings.

### Backend (`api/`)

The backend is built with FastAPI, Python 3.13, and managed via `uv`.

```bash
cd api

# 1. Lint check (Ruff)
uv run ruff check .

# 2. Auto-fix linting issues if necessary
uv run ruff check --fix .

# 3. Format check (Ruff)
uv run ruff format --check .

# 4. Strict Static Type Checking (Mypy)
uv run mypy .

# 5. Unit & Integration Tests (Pytest)
uv run pytest
```

### Frontend (`frontend/`)

The frontend is built with React 18, TypeScript, Vite, and checked with Biome.

```bash
cd frontend

# 1. Lint, formatting check, and import sorting (Biome)
npx @biomejs/biome check src/

# 2. Auto-fix formatting and lint issues
npx @biomejs/biome check --write src/

# 3. TypeScript compilation & production build check
npm run build

# 4. Unit tests (Vitest)
npm run test
```

---

## 4. Definition of Done (DoD)

A pull request is ready for merge only when all of the following criteria are met:

1. **Clean Checks & Build**:
   - `uv run ruff check .` and `uv run ruff format --check .` succeed with zero errors.
   - `uv run mypy .` succeeds with zero errors under strict mode.
   - `npx @biomejs/biome check src/` passes.
   - `npm run build` succeeds cleanly without TypeScript compilation errors.
2. **Comprehensive Test Coverage**:
   - All existing tests pass (`uv run pytest` and `npm run test`).
   - New business logic, scoring formulas, or API routes include corresponding unit/integration tests.
3. **Architectural Consistency**:
   - Database modifications include an Alembic migration (`uv run alembic revision --autogenerate -m "..."`).
   - Request/response contracts use typed Pydantic models with camelCase aliasing (`BaseSchema`).
   - Async database sessions are scoped via FastAPI dependency injection (`DbSession`).
4. **Documentation Synchronization**:
   - Any new environment variables are documented in `api/.env.example` or `frontend/.env.example` and registered in `api/core/config.py`.
   - Structural or workflow changes are reflected in `README.md` and `AGENTS.md`.
