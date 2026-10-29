from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_update_all_endpoint(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    with patch(
        "api.routers.admin.run_full_ingestion_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        mock_pipeline.return_value = {
            "status": "success",
            "duration_ms": 125,
            "synced": {
                "teams": 32,
                "players": 1500,
                "stats": 950,
                "games": 13,
            },
        }

        response = await async_client.post(
            "/api/admin/update/all",
            json={"season": "2024", "withStats": True, "withBoxScores": True},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["durationMs"] == 125
        assert data["synced"]["teams"] == 32
        assert data["synced"]["players"] == 1500
        assert data["synced"]["stats"] == 950
        assert data["synced"]["games"] == 13
        assert mock_pipeline.called
