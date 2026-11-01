"""A finished season is a read-only archive; its league never is."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import League
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league

SEASON_WRITES = [
    ("patch", "/api/seasons/{season}", {"numberTeams": 3}),
    ("patch", "/api/seasons/{season}/settings", {}),
    ("post", "/api/drafts/{season}/control/start", None),
    ("patch", "/api/teams/{team}", {"name": "Renamed"}),
    (
        "post",
        "/api/teams/{team}/lineup",
        {"round": 4, "playerId": 1, "slotIndex": None},
    ),
    ("put", "/api/seasons/{season}/teams/{team}/owner", {"userId": None}),
]


@pytest.mark.parametrize(("method", "path", "body"), SEASON_WRITES)
async def test_a_finished_season_rejects_writes(
    db: AsyncSession,
    client_as: ClientFactory,
    method: str,
    path: str,
    body: dict[str, object] | None,
) -> None:
    season, teams, _ = await finished_league(db)
    url = path.format(season=season.id, team=teams[0].id)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.request(method, url, json=body)
    assert response.status_code == 409
    assert "archive" in response.json()["detail"]


async def test_a_finished_season_stays_readable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        for path in (
            f"/api/leagues/{season.league_id}",
            f"/api/seasons/{season.id}",
            f"/api/seasons/{season.id}/standings",
            f"/api/seasons/{season.id}/settings",
            f"/api/teams/{teams[1].id}",
            f"/api/teams/{teams[1].id}/breakdown",
            f"/api/seasons/{season.id}/activity",
        ):
            assert (await member.get(path)).status_code == 200, path


async def test_the_league_still_takes_member_and_invite_changes(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    league_url = f"/api/leagues/{season.league_id}"
    async with client_as("uid-0") as commissioner:
        renamed = await commissioner.patch(league_url, json={"name": "New name"})
        invite = await commissioner.post(f"{league_url}/invite", json={})
        promoted = await commissioner.patch(
            f"{league_url}/members/{teams[1].owner_id}", json={"role": "commissioner"}
        )
    assert renamed.status_code == 200
    assert invite.status_code == 201
    assert promoted.status_code == 200
    league = await db.get(League, season.league_id)
    assert league is not None and league.name == "New name"


async def test_the_season_overview_says_whether_the_caller_may_edit(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    async with client_as("uid-0") as commissioner:
        body = (await commissioner.get(f"/api/seasons/{season.id}")).json()
    assert (body["finished"], body["canEdit"], body["canCommission"]) == (
        True,
        False,
        False,
    )


async def test_a_season_that_is_not_over_is_editable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db, finished_through=3)
    async with client_as("uid-0") as commissioner:
        body = (await commissioner.get(f"/api/seasons/{season.id}")).json()
        renamed = await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"name": "New name"}
        )
    assert (body["canEdit"], body["canCommission"]) == (True, True)
    assert renamed.status_code == 200


async def test_the_user_league_list_carries_the_latest_season_and_finished_flag(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        (row,) = (await member.get("/api/leagues/user-leagues")).json()
    assert (row["id"], row["seasonId"], row["season"], row["finished"]) == (
        season.league_id,
        season.id,
        2025,
        True,
    )
