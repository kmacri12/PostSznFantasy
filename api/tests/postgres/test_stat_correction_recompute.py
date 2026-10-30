"""A corrected box score re-fetched by the scheduler's reconcile reaches the stored
stats, the round score, the standings and the activity feed with nobody editing a
score by hand."""

import time
from typing import Any

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    LeagueSettings,
    LineupSlot,
    NFLPlayer,
    NFLPlayerGameStats,
    TeamPlayer,
)
from api.services.ingestion import poll_game_box_score
from api.services.scheduler import run_poll_cycle
from api.services.standings import recompute_standings
from api.tests.postgres.activity_support import (
    PAST,
    QB,
    ActivityLeague,
    activity_league,
    game,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.test_live_polling import FakeClient, summary


async def _standing_total(client_as: ClientFactory, s: ActivityLeague) -> float:
    async with client_as("uid-0") as client:
        body = (await client.get(f"/api/leagues/{s.league.id}/standings")).json()
    row = next(t for t in body["teams"] if t["teamId"] == s.team.id)
    total: float = row["total"]
    return total


async def test_a_reconciled_correction_updates_round_score_standings_and_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(
        db, [game("g1", 19, 1, 3, PAST, score=(24, 17))], draft_status="completed"
    )
    qb = s.players[0]
    db.add_all(
        [
            NFLPlayerGameStats(game_id="g1", player_id=qb.id, passing_yards=250),
            LineupSlot(team_id=s.team.id, round=1, player_id=qb.id, slot_index=QB),
        ]
    )
    await db.flush()
    await recompute_standings(db, 2025)
    assert await _standing_total(client_as, s) == 10  # 250 yds x 0.04

    corrected: dict[str, Any] = {
        "gameStatus": "Completed",
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "3",
        "homePts": "24",
        "awayPts": "17",
        "playerStats": {str(qb.id): {"Passing": {"passYds": "300"}}},
    }
    client = FakeClient([summary("g1", 0, "Final")], {"g1": corrected})
    await run_poll_cycle(db, 2025, client=client, now=time.time())  # type: ignore[arg-type]

    assert await _standing_total(client_as, s) == 12  # 300 yds x 0.04
    async with client_as("uid-0") as client_:
        feed = (await client_.get(f"/api/leagues/{s.league.id}/activity")).json()
    (event,) = feed["events"]
    assert event["kind"] == "stat_correction"
    assert event["payload"]["previousPoints"] == 10
    assert event["payload"]["newPoints"] == 12


async def test_a_backup_qbs_correction_reaches_a_team_qb_slot_and_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(
        db, [game("g1", 19, 1, 3, PAST, score=(24, 17))], draft_status="completed"
    )
    await db.execute(
        update(LeagueSettings)
        .where(LeagueSettings.league_id == s.league.id)
        .values(team_qb=True)
    )
    starter = s.players[0]
    backup = NFLPlayer(id=3000, name="Backup QB", position="QB", team_id=1)
    db.add(backup)
    await db.flush()
    db.add_all(
        [
            NFLPlayerGameStats(game_id="g1", player_id=starter.id, passing_yards=250),
            NFLPlayerGameStats(game_id="g1", player_id=backup.id, passing_yards=100),
            LineupSlot(team_id=s.team.id, round=1, player_id=starter.id, slot_index=QB),
        ]
    )
    await db.flush()
    await recompute_standings(db, 2025)
    assert await _standing_total(client_as, s) == 14  # the unit: 350 yds x 0.04

    corrected: dict[str, Any] = {
        "gameStatus": "Completed",
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "3",
        "homePts": "24",
        "awayPts": "17",
        "playerStats": {
            str(starter.id): {"Passing": {"passYds": "250"}},
            str(backup.id): {"Passing": {"passYds": "150"}},
        },
    }
    client = FakeClient([summary("g1", 0, "Final")], {"g1": corrected})
    await run_poll_cycle(db, 2025, client=client, now=time.time())  # type: ignore[arg-type]

    assert await _standing_total(client_as, s) == 16
    async with client_as("uid-0") as client_:
        feed = (await client_.get(f"/api/leagues/{s.league.id}/activity")).json()
    (event,) = feed["events"]
    assert (event["teamId"], event["payload"]["playerId"]) == (s.team.id, starter.id)
    assert (event["payload"]["previousPoints"], event["payload"]["newPoints"]) == (
        14,
        16,
    )


def _dst_box(sacks: int) -> dict[str, Any]:
    def team_stats(team_id: int) -> dict[str, str]:
        return {
            "teamID": str(team_id),
            "totalYards": "300",
            "fumblesLost": "0",
            "defensiveOrSpecialTeamsTds": "0",
        }

    return {
        "gameStatus": "Completed",
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "3",
        "homePts": "24",
        "awayPts": "17",
        "DST": {
            "home": {"teamID": "1", "sacks": str(sacks), "defensiveInterceptions": "0"},
            "away": {"teamID": "3", "sacks": "0", "defensiveInterceptions": "0"},
        },
        "teamStats": {"home": team_stats(1), "away": team_stats(3)},
        "scoringPlays": [],
        "playerStats": {},
    }


async def test_a_corrected_dst_stat_posts_to_the_team_holding_the_defense(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(
        db, [game("g1", 19, 1, 3, PAST, score=(24, 17))], draft_status="completed"
    )
    chiefs_dst = NFLPlayer(id=-1, name="KC DST", position="DST", team_id=1)
    db.add(chiefs_dst)
    await db.flush()
    db.add(TeamPlayer(team_id=s.team.id, league_id=s.league.id, player_id=-1))
    await db.flush()
    for sacks in (1, 3):
        client = FakeClient([], {"g1": _dst_box(sacks)})
        await poll_game_box_score(db, "g1", "2025", client=client)  # type: ignore[arg-type]

    async with client_as("uid-0") as commissioner:
        feed = (await commissioner.get(f"/api/leagues/{s.league.id}/activity")).json()
    (event,) = feed["events"]
    assert event["teamId"] == s.team.id
    assert event["payload"]["playerId"] == -1
    assert event["payload"]["newPoints"] - event["payload"]["previousPoints"] == 2


async def test_a_failed_recompute_in_the_reconcile_keeps_the_last_good_standings(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = await activity_league(
        db, [game("g1", 19, 1, 3, PAST, score=(24, 17))], draft_status="completed"
    )
    qb = s.players[0]
    db.add_all(
        [
            NFLPlayerGameStats(game_id="g1", player_id=qb.id, passing_yards=250),
            LineupSlot(team_id=s.team.id, round=1, player_id=qb.id, slot_index=QB),
        ]
    )
    await db.flush()
    await recompute_standings(db, 2025)

    def boom(_: object) -> None:
        raise RuntimeError("scoring blew up")

    monkeypatch.setattr("api.services.standings.rank_teams", boom)
    corrected = {
        "gameStatus": "Completed",
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "3",
        "homePts": "24",
        "awayPts": "17",
        "playerStats": {str(qb.id): {"Passing": {"passYds": "300"}}},
    }
    client = FakeClient([summary("g1", 0, "Final")], {"g1": corrected})
    await run_poll_cycle(db, 2025, client=client, now=time.time())  # type: ignore[arg-type]

    assert await _standing_total(client_as, s) == 10
