import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import League
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league

WRITES = [
    ("patch", "/api/leagues/{league}", {"name": "New name"}),
    ("patch", "/api/leagues/{league}/settings", {}),
    ("post", "/api/drafts/{league}/control/start", None),
    ("patch", "/api/teams/{team}", {"name": "Renamed"}),
    (
        "post",
        "/api/teams/{team}/lineup",
        {"round": 4, "playerId": 1, "slotIndex": None},
    ),
    ("post", "/api/leagues/{league}/invite", None),
]


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
async def test_a_finished_league_rejects_writes(
    db: AsyncSession,
    client_as: ClientFactory,
    method: str,
    path: str,
    body: dict[str, object] | None,
) -> None:
    league, teams, _ = await finished_league(db)
    url = path.format(league=league.id, team=teams[0].id)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.request(method, url, json=body)
    assert response.status_code == 409
    assert "archive" in response.json()["detail"]
    await db.refresh(league)
    assert league.name == "Test League"


async def test_a_finished_league_stays_readable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, teams, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        for path in (
            f"/api/leagues/{league.id}",
            f"/api/leagues/{league.id}/standings",
            f"/api/leagues/{league.id}/settings",
            f"/api/teams/{teams[1].id}",
            f"/api/teams/{teams[1].id}/breakdown",
            f"/api/leagues/{league.id}/activity",
        ):
            assert (await member.get(path)).status_code == 200, path


async def test_a_league_whose_season_is_not_over_is_still_editable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db, finished_through=3)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.patch(
            f"/api/leagues/{league.id}", json={"name": "New name"}
        )
    assert response.status_code == 200
    assert (await db.get(League, league.id)) is not None


async def test_the_user_league_list_carries_the_season_and_finished_flag(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        (row,) = (await member.get("/api/leagues/user-leagues")).json()
    assert (row["id"], row["season"], row["finished"]) == (league.id, 2025, True)
