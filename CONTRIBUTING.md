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

Narrower targets: `make lint`, `make typecheck`, `make test`, each with `-api` / `-web` variants. The backend is FastAPI on Python 3.13 managed by `uv` (Ruff, strict Mypy, pytest); the frontend is React 19 + TypeScript + Vite checked with Biome and Vitest. A pre-commit hook runs Ruff and Biome on staged files (`pre-commit install`).

The CI "End-to-end (make e2e)" job always reports a result, but on a pull request whose files are all on the allowlist in `scripts/e2e-needed.sh` (docs, Markdown, deploy/backup/docker-build/quality-nightly workflows, `scripts/`, `Dockerfile`, `fly.toml`, and backend-only changes under `api/`) its steps are skipped. Backend-only PRs skip on purpose, with the full run on every push to `main` as the safety net; `api/scripts/seed_e2e.py`, `api/alembic/**`, `api/dependencies/auth.py`, `api/core/config.py`, `api/pyproject.toml` and `api/uv.lock` still run it. Pushes to `main`, scheduled runs and everything else run it in full. Unlisted paths run e2e by default.

### CI jobs and workflows

Pull requests and pushes to `main` run `.github/workflows/ci.yml`; the other workflows are scheduled or manual. Every job picks its runner from the repo variables `CI_RUNS_ON` / `CI_E2E_RUNS_ON` (unset = GitHub-hosted).

| Workflow / job | When | What it checks |
| :--- | :--- | :--- |
| CI, **Backend** (`make check-api`) | every PR and push, weekly | Ruff, strict Mypy, pytest including the Postgres tier (a `postgres:17` service) and the **API authorization matrix** (below) |
| CI, **Frontend** (`make check-web`) | every PR and push, weekly | Biome, `lint-e2e`, tour check, `tsc`, Vitest, production build |
| CI, **End-to-end** (`make e2e`) | every PR (steps skipped when `scripts/e2e-needed.sh` says nothing observable changed) and push | Playwright suite plus the replay suite |
| CI, **Dependency audit** | every PR and push, weekly | `pip-audit` and `npm audit --omit=dev` |
| CI, **Secret scan (gitleaks)** | every PR and push, weekly | gitleaks over the full git history with the default rules plus `.gitleaks.toml` |
| `e2e-stress.yml` | nightly, manual | The whole e2e suite repeated 5 times; a spec that fails once is flaky |
| `quality-nightly.yml`, **Screenshots and axe** | nightly, manual | Screenshots and an axe scan of the key pages (below), one job per device project |
| `quality-nightly.yml`, **Lighthouse budget** | nightly, manual | Lighthouse scores and timings of the landing and league pages against `e2e/lighthouse/budget.json` |
| `draft-load.yml` | nightly, manual | 12 teams and 30 sockets drafting against a seeded API |
| `docker-build.yml`, `backup.yml`, `deploy.yml` | see [docs/deploy](docs/deploy) | Image build, database backup, deploy |

The slow gates (device-matrix screenshots, Lighthouse) stay out of the pull request path on purpose: they run nightly and on demand from the Actions tab, so a red nightly is investigated the next morning rather than blocking a merge.

### API authorization matrix

`api/tests/authz_expectations.py` lists every route of the OpenAPI schema with the answer each kind of caller must get: anonymous, stranger (signed in, never in the league), former member, member, team and message owner, and commissioner. `api/tests/test_authz_coverage.py` fails when a route has no entry (or an entry has no route), and `api/tests/postgres/test_authorization_matrix.py` calls every route as every role against a real database. **A new route must add one line to `EXPECTED`** with the policy that fits (`PUBLIC`, `SIGNED_IN`, `LEAGUE_MEMBER`, `COMMISSIONER`, `TEAM_OWNER_OR_COMMISSIONER`, `ADMIN`, ...) or a one-off `Policy(...)`. The probe sends no body, so a permitted call usually answers 422 or 409; if the guard is inside the handler rather than a dependency (so validation answers first), give the route a valid body in `BODIES`. WebSocket routes are not in the OpenAPI schema; their authentication is covered by `test_draft_websocket.py`.

### Abuse tests and secret scanning

`api/tests/test_abuse.py` asks whether the rate limits and the invite code space hold against someone trying to get around them: guessing codes is cut off at the preview limit (and the code space cannot be covered at that rate), a forged `X-Forwarded-For` or a fresh code per attempt does not dodge a limit, every `RateLimiter` stops at its first rule, and a limiter that is defined but on no route fails. The route-level limits themselves are in `test_rate_limits.py`. gitleaks fails the build on a committed secret; a false positive goes in `.gitleaks.toml` as a narrow allowlist entry (one value or one file) with a comment saying why, never as a broad path.

### Visual regression, accessibility and Lighthouse (nightly)

`e2e/playwright.quality.config.ts` runs `e2e/quality/` against the same seeded stack as the main suite (`make e2e` never picks it up). `pages.spec.ts` visits landing, home, a league before its draft, the draft room, a drafted league's standings, team, feed, More and settings, in Dark and Light, at iPhone SE (375x667), small Android (360x640), iPad (768x1024) and desktop (1280x800). Each visit runs axe (WCAG 2 A/AA; anything above minor fails except what `e2e/quality/knownViolations.ts` waives per page and theme, with a reason) and compares a full-page screenshot with the baseline (`maxDiffPixelRatio` 1%; `<time>` elements are masked). `lighthouse.spec.ts` runs Lighthouse (mobile profile) on the landing page and a league page and fails below the scores and timings in `e2e/lighthouse/budget.json`; Lighthouse is its own package (`e2e/lighthouse`) so the PR e2e job never installs it. Lighthouse 12 has no PWA score, so installability stays with `e2e/tests/install-offline.spec.ts`.

Run it locally with `make db-up`, then `cd e2e && npx playwright test -c playwright.quality.config.ts --project=iphone-se` (and `cd e2e/lighthouse && npm ci` once for `--project=lighthouse`).

**Baselines** live in `e2e/quality/__screenshots__/<project>/` and must be rendered on the CI runner image (fonts differ by machine). To create or replace them, run the "Quality nightly" workflow from the Actions tab with `update_baselines` checked, download the `visual-baselines-*` artifacts and commit their contents under that folder. A page that changed on purpose gets new baselines in the same PR (run the workflow on the PR branch); a nightly diff you did not intend is a regression, and the failed job's `quality-report-*` artifact has the expected, actual and diff images.

### Writing stable e2e specs

The suite has `retries: 0` on purpose: a spec that needs a retry is a bug in the spec or in the app, and a retry hides it. Every failure that has ever shown up on CI came from one of the causes below, so check your spec against them.

- **When you change UI, grep `e2e/` for the labels, button names and text you touched and run those specs before opening the PR** (`E2E_ARGS="--project=mobile -g settings" make e2e`). Another PR can rewrite a spec against the old UI while yours merges (the settings rename spec broke on `main` that way).
- **Select by role and exact accessible name**: `getByRole("button", { name: "Discard", exact: true })`. A bare substring also matches rows whose label contains your test data (a league called "Discard League" matched "Edit league name Discard League"), and a MUI dialog or drawer can carry the same `aria-label` as its field, so prefer `getByRole("textbox", { name })` over `getByLabel`. Use `data-testid` only where role and label are inherently ambiguous.
- **No positional selectors without a reason**: `scripts/lint-e2e.sh` (`make lint-e2e`, also in CI) fails on `.first()`, `.last()` and `.nth()` without a `//` comment on the same or previous line saying why the match order is stable, and on `waitForTimeout`, `page.pause`, `test.only` and `networkidle`.
- **Assert the loaded state before you act on it.** Wait for the data you are about to use (`await expect(slot).not.toContainText("Empty")`), not for a click to have returned. If a screen keeps local form state seeded from a query, hold the query's route in a spec (`page.route` plus a promise you resolve) to prove a late response cannot overwrite what the user typed or send stale data. See the draft setup specs in `settings.spec.ts`.
- **Never race a wall-clock timer.** The e2e build (`VITE_E2E=true`, set in the Playwright configs) makes MUI transitions instant, the "tap again to confirm" draft window and the refresh toast static (`frontend/src/utils/e2e.ts`). If you add a timer-driven piece of UI, gate it on `E2E_BUILD` the same way instead of lengthening a Playwright timeout.
- **Await in-flight intercepted requests**: finish a spec that uses `page.route` with `await page.unrouteAll({ behavior: "wait" })`.
- **Use `unique("name")` for every league, user and team name** so data from other specs or earlier runs cannot collide with UI text.
- **Live replay specs assert what holds at any speed** (eliminations only accumulate and follow a fixed order), never an exact mid-replay state.
- **Prove a new spec is stable before you push**: `cd e2e && npx playwright test tests/your.spec.ts --repeat-each=10`. `make e2e-stress` repeats the whole suite (`E2E_STRESS_REPEAT=5`), and the "E2E stress" workflow runs it nightly and on demand. On CI failures, the report, traces, screenshots and video are uploaded as the `playwright-report` artifact.

### Migrations must be additive

Production runs `alembic upgrade head` as the host's release command while the previous version is still serving traffic, and a failed migration aborts the deploy. The merge to `main` deploys the API first and the frontend a few minutes later ([docs/deploy/fly.md](docs/deploy/fly.md#how-a-deploy-works)), so the old UI also talks to the new API. Every migration and API change has to work with both the old and the new code:

- Add columns as nullable or with a server default; backfill in the same migration or a later one.
- Never drop or rename a column, table or enum value that the currently deployed code reads or writes. Ship the code that stops using it first, then drop it in a **later** release.
- Never remove or rename an endpoint, request field or response field in the same PR that stops the frontend using it. Ship the frontend change first and remove it from the API one release later. New required request fields break the old UI the same way; make them optional until the next release.
- Avoid long locks (index builds on large tables: `CREATE INDEX CONCURRENTLY` in an autocommit block).
- Never edit a migration that has been merged; add a new one.

A live draft holds back deployment of everything merged to `main` until it ends (the 15-minute catch-up then ships it). See [docs/deploy/fly.md](docs/deploy/fly.md#how-a-deploy-works) for the deploy flow and [docs/deploy/cutover-runbook.md](docs/deploy/cutover-runbook.md) for the launch.

---

## 4. Definition of Done (DoD)

A pull request is ready for merge only when all of the following criteria are met:

1. **Clean Checks & Build**:
   - `make check` succeeds: Ruff, strict Mypy, Biome, `tsc`, tests and the production build.
2. **Comprehensive Test Coverage**:
   - All existing tests pass (`make test`).
   - New business logic, scoring formulas, or API routes include corresponding unit/integration tests.
   - A new API route declares who may call it in `api/tests/authz_expectations.py` (see "API authorization matrix"); `make test-api` fails without it.
3. **Architectural Consistency**:
   - Database modifications include an Alembic migration (`make migration m="..."`).
   - Database modifications also update `docs/erd.md` (checked by `api/tests/test_erd.py`).
   - Request/response contracts use typed Pydantic models with camelCase aliasing (`BaseSchema`).
   - Async database sessions are scoped via FastAPI dependency injection (`DbSession`).
4. **Mobile Verification (every UI change)**:
   - Run the app and look at the changed screen at phone width (375x812) and at desktop width before calling the work done: no horizontal scroll, no clipped or truncated text, no overlapping elements, tap targets of at least 44px, and drag interactions that work by touch.
   - Fix anything that looks off, then re-check. Do not hand off UI work that has only been type-checked.
5. **First-run tour is current**:
   - `make tour-check` passes (it is part of `make check`). It fails when the League, Team, Draft, Feed, layout, theme or recap code changed after the tour's screenshots were taken.
   - If it fails, run `make tour` (needs `make db-up` and `make e2e-install`), look at the new images in `frontend/public/tour/`, and commit them with the change. The tour shows the real app; a tour with a retired design is a bug.
   - If you add a screen to the tour, add its step to `TOUR_STEPS` in `frontend/src/content/rules.ts` and its capture to `e2e/tour/capture.spec.ts`.
6. **Documentation Synchronization**:
   - Any new environment variables are documented in `api/.env.example` or `frontend/.env.example` and registered in `api/core/config.py`.
   - Structural or workflow changes are reflected in `README.md` and `AGENTS.md`.
