# Contributing to PostSzn Fantasy

Thank you for contributing to **PostSzn Fantasy** (`postsznfantasy`). This document outlines our branch strategy, commit standards, architectural principles, and definition of done.

---

## 1. Core Engineering Principles

All contributions—whether submitted by human engineers or AI agents—must adhere to these guiding principles:

- **KISS (Keep It Simple, Stupid)**: Build the simplest working solution. Avoid premature abstractions, speculative interfaces, or gratuitous indirection.
- **Intent-Driven Comments (Explain WHY, Not WHAT)**: Code must be self-explanatory through expressive naming and clear logic. Reserve comments strictly for non-obvious domain rules, hardware/protocol quirks, or external library workarounds. Never write comments that merely narrate what the next line of code does.
- **Self-Documenting Code**: Choose descriptive names for functions, classes, and variables so that the intent is immediately clear from the code alone.
- **Mobile-First UI**: The app is used primarily on phones. Every UI is designed for a ~375px-wide viewport first and then scaled up. Prefer a single vertical column; never spread one control across multiple rows or columns of a grid, and avoid horizontal scrolling and hover-only interactions. Touch targets are at least 44px tall.
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

Before opening a pull request, run everything CI runs. Both the backend and frontend must pass without errors or warnings.

```bash
make check      # lint + type check + tests + production build
make format     # auto-fix Ruff and Biome findings
```

Narrower targets: `make lint`, `make typecheck`, `make test`, each with `-api` / `-web` variants. The backend is FastAPI on Python 3.13 managed by `uv` (Ruff, strict Mypy, pytest); the frontend is React 18 + TypeScript + Vite checked with Biome and Vitest. A pre-commit hook runs Ruff and Biome on staged files (`pre-commit install`).

### Migrations must be additive

Production runs `alembic upgrade head` as the host's release command while the previous version is still serving traffic, and a failed migration aborts the deploy. So every migration has to work with both the old and the new code:

- Add columns as nullable or with a server default; backfill in the same migration or a later one.
- Never drop or rename a column, table or enum value that the currently deployed code reads or writes. Ship the code that stops using it first, then drop it in a **later** release.
- Avoid long locks (index builds on large tables: `CREATE INDEX CONCURRENTLY` in an autocommit block).
- Never edit a migration that has been merged; add a new one.

See [docs/deploy/cutover-runbook.md](docs/deploy/cutover-runbook.md) for the deploy flow.

---

## 4. Definition of Done (DoD)

A pull request is ready for merge only when all of the following criteria are met:

1. **Clean Checks & Build**:
   - `make check` succeeds: Ruff, strict Mypy, Biome, `tsc`, tests and the production build.
2. **Comprehensive Test Coverage**:
   - All existing tests pass (`make test`).
   - New business logic, scoring formulas, or API routes include corresponding unit/integration tests.
3. **Architectural Consistency**:
   - Database modifications include an Alembic migration (`make migration m="..."`).
   - Request/response contracts use typed Pydantic models with camelCase aliasing (`BaseSchema`).
   - Async database sessions are scoped via FastAPI dependency injection (`DbSession`).
4. **Mobile Verification (every UI change)**:
   - Run the app and look at the changed screen at phone width (375x812) and at desktop width before calling the work done: no horizontal scroll, no clipped or truncated text, no overlapping elements, tap targets of at least 44px, and drag interactions that work by touch.
   - Fix anything that looks off, then re-check. Do not hand off UI work that has only been type-checked.
5. **Documentation Synchronization**:
   - Any new environment variables are documented in `api/.env.example` or `frontend/.env.example` and registered in `api/core/config.py`.
   - Structural or workflow changes are reflected in `README.md` and `AGENTS.md`.
