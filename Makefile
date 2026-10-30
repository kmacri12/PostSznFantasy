.DEFAULT_GOAL := help
.PHONY: help setup db-up db-down db-reset migrate migration api web dev seed \
	lint lint-api lint-web format typecheck typecheck-api typecheck-web \
	test test-api test-web build-web check check-api check-web e2e e2e-install

UV := uv run --project api
API_RUN := cd api && uv run
SEED_ARGS ?=
E2E_ARGS ?=

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies and create missing .env files
	cd api && uv sync
	cd frontend && npm install
	@test -f api/.env || cp api/.env.example api/.env
	@test -f frontend/.env || cp frontend/.env.example frontend/.env

db-up: ## Start Postgres (Docker Compose) and wait until healthy
	docker compose up -d --wait postgres

db-down: ## Stop Postgres (keeps data)
	docker compose down

db-reset: ## Wipe the local database and re-apply migrations
	docker compose down -v
	$(MAKE) db-up
	$(MAKE) migrate

migrate: ## Apply Alembic migrations
	$(API_RUN) alembic upgrade head

migration: ## Autogenerate a migration: make migration m="message"
	@test -n "$(m)" || (echo 'usage: make migration m="message"' && exit 1)
	$(API_RUN) alembic revision --autogenerate -m "$(m)"

api: ## Run the API with auto-reload on :8000
	$(UV) uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

web: ## Run the Vite dev server on :5173
	cd frontend && npm run dev

dev: db-up migrate ## Run database, API and web together (Ctrl-C stops both servers)
	@trap 'kill 0' INT TERM; $(MAKE) api & $(MAKE) web & wait

seed: ## Seed NFL data: make seed SEED_ARGS="--season 2026 --no-stats"
	$(UV) python -m api.scripts.seed_nfl_data $(SEED_ARGS)

lint-api:
	$(API_RUN) ruff check .
	$(API_RUN) ruff format --check .

lint-web:
	cd frontend && npx @biomejs/biome check src/

lint: lint-api lint-web ## Ruff + Biome checks

format: ## Auto-format and fix lint issues in both apps
	$(API_RUN) ruff check --fix .
	$(API_RUN) ruff format .
	cd frontend && npx @biomejs/biome check --write src/

typecheck-api:
	$(API_RUN) mypy .

typecheck-web:
	cd frontend && npx tsc --noEmit

typecheck: typecheck-api typecheck-web ## Mypy + tsc

test-api:
	$(API_RUN) pytest

test-web:
	cd frontend && npm run test

test: test-api test-web ## pytest + Vitest

build-web:
	cd frontend && npm run build

check-api: lint-api typecheck-api test-api
check-web: lint-web typecheck-web test-web build-web

check: check-api check-web ## Everything CI runs

e2e-install: ## Install the Playwright project and its Chromium
	cd e2e && npm install && npx playwright install --with-deps chromium

e2e: ## Playwright end-to-end tests (mobile first); needs Postgres (make db-up)
	cd e2e && npx playwright test $(E2E_ARGS)
