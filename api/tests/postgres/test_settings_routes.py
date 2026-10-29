from collections.abc import AsyncGenerator, Callable

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import LeagueSettings
from api.db.session import get_db
from api.dependencies.auth import get_current_user
from api.main import app
from api.tests.postgres.factories import make_league

ClientFactory = Callable[[str], AsyncClient]


@pytest.fixture
async def client_as(db: AsyncSession) -> AsyncGenerator[ClientFactory]:
    async def override_db() -> AsyncGenerator[AsyncSession]:
        yield db

    app.dependency_overrides[get_db] = override_db

    def build(uid: str) -> AsyncClient:
        app.dependency_overrides[get_current_user] = lambda: uid
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    yield build
    app.dependency_overrides.clear()


def update_body(**roster: int) -> dict[str, object]:
    return {
        "rosterSettings": {"numberTeams": 2, **roster},
        "scoringSettings": {"scoringPassingTd": 6},
    }


async def test_only_the_commissioner_can_update_settings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)
    build = client_as

    async with build("uid-1") as member:
        denied = await member.put(
            f"/api/leagues/{league.id}/settings", json=update_body()
        )
    assert denied.status_code == 403

    async with build("uid-0") as commissioner:
        ok = await commissioner.put(
            f"/api/leagues/{league.id}/settings", json=update_body(rosterTotal=5)
        )
    assert ok.status_code == 200
    assert ok.json()["rosterTotal"] == 5

    stored = await db.scalar(
        select(LeagueSettings).where(LeagueSettings.league_id == league.id)
    )
    assert stored is not None
    assert stored.roster_total == 5
    assert float(stored.scoring_passing_td) == 6.0


async def test_outsiders_cannot_read_league_data(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)
    build = client_as

    async with build("uid-1") as member:
        assert (
            await member.get(f"/api/leagues/{league.id}/settings")
        ).status_code == 200
        assert (await member.get(f"/api/leagues/{league.id}/teams")).status_code == 200
    async with build("stranger") as stranger:
        assert (
            await stranger.get(f"/api/leagues/{league.id}/settings")
        ).status_code == 403
