from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import pytest
from api.core.config import get_settings
from httpx import AsyncClient


@pytest.fixture(autouse=True)
def reset_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


ADMIN_ROUTES = [
    "/api/admin/update/all",
    "/api/admin/update/nfl_teams",
    "/api/admin/update/nfl_players",
    "/api/admin/update/nfl_players_and_stats",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ADMIN_ROUTES)
async def test_non_admin_cannot_trigger_ingestion(
    async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "someone-else")
    with patch("api.routers.admin.run_full_ingestion_pipeline") as pipeline:
        response = await async_client.post(path)
    assert response.status_code == 403
    pipeline.assert_not_called()


@pytest.mark.asyncio
async def test_non_admin_cannot_eliminate_teams(
    async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "")
    with patch("api.routers.admin.mark_eliminated_teams") as eliminate:
        response = await async_client.post(
            "/api/admin/update/eliminate_teams", json={"team_ids": [1]}
        )
    assert response.status_code == 403
    eliminate.assert_not_called()


@pytest.mark.asyncio
async def test_listed_admin_is_allowed(
    async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, mock_user_id: str
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", f"other-uid, {mock_user_id}")
    with patch("api.routers.admin.ingest_nfl_teams", new=AsyncMock()):
        response = await async_client.post("/api/admin/update/nfl_teams")
    assert response.status_code == 200
