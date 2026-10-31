# Production API image. Build context is the repository root; the frontend is
# built and hosted by Cloudflare Pages, so there is no Dockerfile for it.
FROM ghcr.io/astral-sh/uv:0.13.6 AS uv

FROM python:3.13-slim-bookworm AS builder
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/api
# Dependencies first so code-only changes reuse this layer.
COPY api/pyproject.toml api/uv.lock api/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.13-slim-bookworm AS runtime
RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=builder /app/api/.venv /app/api/.venv
COPY --chown=app:app api ./api
# PYTHONPATH: `fly ssh console -C "python -m api.scripts..."` need not start in /app.
ENV PATH="/app/api/.venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080
USER app
EXPOSE 8080

# /api checks the database too, so a dead pool marks the container unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api', timeout=4)"]

# One worker: WebSocket rooms and the draft clock live in this process.
CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers"]
