"""Every settings change after league creation lands in the league feed, old and new
values side by side."""

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league


async def _feed(client: AsyncClient, league_id: int) -> list[dict[str, Any]]:
    response = await client.get(f"/api/leagues/{league_id}/activity")
    events: list[dict[str, Any]] = response.json()["events"]
    return events


async def test_a_scoring_edit_shows_the_changed_fields_before_and_after(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{league.id}/settings",
            json={
                "scoringPassingTd": 6,
                "scoringRushingTd": 6,
                "multiplierDivisional": 2,
            },
        )
        events = await _feed(commissioner, league.id)
    assert [e["kind"] for e in events] == ["settings_change"]
    event = events[0]
    assert (event["actorName"], event["teamId"]) == ("user0", None)
    changes = {
        c["field"]: (c["before"], c["after"]) for c in event["payload"]["changes"]
    }
    assert changes == {
        "scoringPassingTd": (4, 6),
        "multiplierDivisional": (1, 2),
    }


async def test_an_edit_that_changes_nothing_is_not_logged(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{league.id}/settings", json={"scoringPassingTd": 4}
        )
        assert await _feed(commissioner, league.id) == []


async def test_a_change_of_team_count_is_logged_whichever_route_makes_it(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db, teams=2, draft_status="unscheduled")
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(f"/api/leagues/{league.id}", json={"numberTeams": 4})
        await commissioner.patch(
            f"/api/leagues/{league.id}/settings", json={"numberTeams": 3}
        )
        events = await _feed(commissioner, league.id)
    assert [
        [(c["field"], c["before"], c["after"]) for c in e["payload"]["changes"]]
        for e in events
    ] == [[("numberTeams", 4, 3)], [("numberTeams", 2, 4)]]


async def test_settings_changes_are_league_wide_not_in_a_team_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, teams, _ = await make_league(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{league.id}/settings", json={"scoringPassingTd": 6}
        )
        team_feed = (
            await commissioner.get(f"/api/teams/{teams[0].id}/activity")
        ).json()
    assert team_feed["events"] == []
