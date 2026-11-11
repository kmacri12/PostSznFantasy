import os

# Must precede the api imports: api.main builds Settings at import time, and CI has no .env.
os.environ.setdefault("PG_HOST", "localhost")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from api.core.rate_limit import reset_all
from api.db.session import get_db
from api.dependencies.auth import get_current_user, get_token_email
from api.dependencies.league import (
    LeagueMembership,
    get_draft_member,
    get_league_member,
    get_team_member,
)
from api.main import app
from api.services import push


@pytest.fixture
def mock_user_id() -> str:
    return "test-supabase-uid-12345"


@asynccontextmanager
async def _savepoint() -> AsyncGenerator[None]:
    yield


@pytest.fixture
def mock_db_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.close = AsyncMock()
    session.begin_nested = _savepoint
    return session


@pytest.fixture
async def unauthorized_client(
    mock_user_id: str,
    mock_db_session: AsyncMock,
) -> AsyncGenerator[AsyncClient]:
    """Authenticated caller whose league-membership lookups find nothing."""

    async def override_get_current_user() -> str:
        return mock_user_id

    async def override_get_db() -> AsyncGenerator[AsyncMock]:
        yield mock_db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_token_email] = lambda: None
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def async_client(
    mock_user_id: str,
    mock_db_session: AsyncMock,
) -> AsyncGenerator[AsyncClient]:
    async def override_get_current_user() -> str:
        return mock_user_id

    async def override_get_db() -> AsyncGenerator[AsyncMock]:
        yield mock_db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_token_email] = lambda: None
    app.dependency_overrides[get_db] = override_get_db

    async def override_member() -> LeagueMembership:
        return MagicMock(spec=LeagueMembership)

    for guard in (get_league_member, get_draft_member, get_team_member):
        app.dependency_overrides[guard] = override_member

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> None:
    reset_all()


@pytest.fixture(autouse=True)
def _no_background_notifications(monkeypatch: pytest.MonkeyPatch) -> None:
    """A spawned notification opens its own session on the configured database, not the
    test one; tests call the notify functions directly instead."""
    monkeypatch.setattr(push, "spawn", lambda *args, **kwargs: None)
