from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

LEAGUE_ROUTES = [
    "/api/drafts/draft-info/1",
    "/api/leagues/1/settings",
    "/api/leagues/1/teams",
    "/api/leagues/1/standings",
]
LOOKUP_ROUTES = ["/api/drafts/draft-picks/1", "/api/leagues/teams/1"]


def no_rows() -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.first.return_value = None
    result.scalar.return_value = None
    return result


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LEAGUE_ROUTES)
async def test_non_member_is_forbidden_on_league_routes(
    unauthorized_client: AsyncClient, mock_db_session: AsyncMock, path: str
) -> None:
    mock_db_session.execute.return_value = no_rows()
    response = await unauthorized_client.get(path)
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LOOKUP_ROUTES)
async def test_unknown_draft_or_team_is_not_found(
    unauthorized_client: AsyncClient, mock_db_session: AsyncMock, path: str
) -> None:
    mock_db_session.execute.return_value = no_rows()
    response = await unauthorized_client.get(path)
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LOOKUP_ROUTES)
async def test_non_member_is_forbidden_when_resolving_league(
    unauthorized_client: AsyncClient, mock_db_session: AsyncMock, path: str
) -> None:
    league_lookup = MagicMock()
    league_lookup.scalar.return_value = 1
    league_lookup.scalars.return_value.first.return_value = None
    mock_db_session.execute.return_value = league_lookup
    response = await unauthorized_client.get(path)
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    ["/api/players/player-list", "/api/players/player-season-stats"],
)
async def test_player_routes_require_login(path: str) -> None:
    from httpx import ASGITransport

    from api.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(path)
    assert response.status_code in (401, 403)
