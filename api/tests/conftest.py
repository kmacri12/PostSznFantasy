from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from api.dependencies.auth import get_current_user
from api.dependencies.db import get_db
from api.main import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def mock_user_id() -> str:
    return "test-firebase-uid-12345"


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
    return session


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
    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
