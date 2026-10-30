"""A box score fetched for a game that was already final, and that changes a rostered
player's score under the league's rules, is a stat correction in the feed."""

from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import LeagueSettings, NFLGame, NFLPlayerGameStats
from api.services.ingestion import poll_game_box_score
from api.tests.postgres.activity_support import (
    PAST,
    ActivityLeague,
    activity_league,
    game,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.test_live_polling import FakeClient


def _box(status: str, player_id: int, **passing: str) -> dict[str, Any]:
    return {
        "gameStatus": status,
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "3",
        "homePts": "24",
        "awayPts": "17",
        "playerStats": {str(player_id): {"Passing": passing}},
    }


async def _final_game(db: AsyncSession, yards: int = 250) -> ActivityLeague:
    """KC's QB (player 0, on user1's team) threw `yards` in a finished Wild Card game."""
    s = await activity_league(db, [game("g1", 19, 1, 3, PAST, score=(24, 17))])
    db.add(
        NFLPlayerGameStats(game_id="g1", player_id=s.players[0].id, passing_yards=yards)
    )
    await db.flush()
    return s


async def _poll(db: AsyncSession, s: ActivityLeague, status: str, yards: str) -> None:
    client = FakeClient([], {"g1": _box(status, s.players[0].id, passYds=yards)})
    await poll_game_box_score(db, "g1", "2025", client=client)  # type: ignore[arg-type]


async def _events(client_as: ClientFactory, s: ActivityLeague) -> list[dict[str, Any]]:
    async with client_as("uid-0") as commissioner:
        feed = await commissioner.get(f"/api/leagues/{s.league.id}/activity")
    events: list[dict[str, Any]] = feed.json()["events"]
    return events


async def test_a_corrected_stat_posts_old_and_new_score_to_the_roster_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db, yards=250)  # 10 points at 0.04 a yard
    await _poll(db, s, "Completed", "300")  # 12 points
    (event,) = await _events(client_as, s)
    assert event["kind"] == "stat_correction"
    assert (event["actorName"], event["teamId"]) == (None, s.team.id)
    assert event["createdAt"]
    assert event["payload"] == {
        "round": 1,
        "gameId": "g1",
        "playerId": s.players[0].id,
        "playerName": s.players[0].name,
        "previousPoints": 10,
        "newPoints": 12,
    }


async def test_it_is_in_the_team_feed_too(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db)
    await _poll(db, s, "Completed", "300")
    async with client_as("uid-1") as owner:
        feed = (await owner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert [e["kind"] for e in feed["events"]] == ["stat_correction"]


async def test_stats_moving_during_a_live_game_are_not_corrections(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db)
    live = await db.get(NFLGame, "g1")
    assert live is not None
    live.game_status = "Live - In Progress"
    await db.flush()
    await _poll(db, s, "Live - In Progress", "300")
    assert await _events(client_as, s) == []


async def test_a_refetch_that_changes_nothing_is_not_a_correction(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db, yards=300)
    await _poll(db, s, "Completed", "300")
    assert await _events(client_as, s) == []


async def test_a_change_the_league_does_not_score_is_not_a_correction(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db)
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == s.league.id)
        )
    ).scalar_one()
    settings.scoring_passing_yard = Decimal(0)
    await db.flush()
    await _poll(db, s, "Completed", "300")
    assert await _events(client_as, s) == []


async def test_the_first_stats_of_a_final_game_are_not_corrections(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db, [game("g1", 19, 1, 3, PAST, score=(24, 17))])
    await _poll(db, s, "Completed", "300")
    assert await _events(client_as, s) == []


async def _lineup_player(
    client_as: ClientFactory, s: ActivityLeague, player_index: int
) -> dict[str, Any]:
    async with client_as("uid-1") as owner:
        body = (await owner.get(f"/api/teams/{s.team.id}")).json()
    lineup = next(r for r in body["lineups"] if r["round"] == 1)
    wanted = s.players[player_index].id
    return next(p for p in lineup["unassigned"] if p["id"] == wanted)


async def test_the_lineup_shows_the_round_score_and_the_latest_correction(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db, yards=250)
    await _poll(db, s, "Completed", "300")
    player = await _lineup_player(client_as, s, 0)
    assert player["points"] == 12
    change = player["scoreChange"]
    assert (change["previousPoints"], change["newPoints"]) == (10, 12)
    assert change["changedAt"]
    other = await _lineup_player(client_as, s, 1)
    assert (other["points"], other["scoreChange"]) == (None, None)


async def test_an_uncorrected_score_has_no_change(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _final_game(db, yards=250)
    player = await _lineup_player(client_as, s, 0)
    assert (player["points"], player["scoreChange"]) == (10, None)
