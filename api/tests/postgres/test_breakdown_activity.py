"""The round-by-round breakdown carries the same commissioner markers and changed-score
details as the lineup, with points after the round multiplier like everything there."""

from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLPlayerGameStats, SeasonSettings
from api.tests.postgres.activity_support import (
    FLEX,
    FUTURE,
    PAST,
    QB,
    ActivityLeague,
    activity_league,
    game,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.test_stat_corrections import _poll


async def _world(db: AsyncSession) -> ActivityLeague:
    """KC's QB threw 250 yards (10 points) in a finished Wild Card game; BUF's WR has
    not played yet. The league scores the Wild Card at 2x."""
    s = await activity_league(
        db,
        [
            game("g1", 19, 1, 3, PAST, score=(24, 17)),
            game("g2", 19, 2, 3, FUTURE),
        ],
        draft_status="completed",
    )
    await db.execute(update(SeasonSettings).values(multiplier_wild_card=2))
    db.add(
        NFLPlayerGameStats(game_id="g1", player_id=s.players[0].id, passing_yards=250)
    )
    await db.flush()
    return s


async def _breakdown(client_as: ClientFactory, s: ActivityLeague) -> dict[str, Any]:
    async with client_as("uid-1") as owner:
        body: dict[str, Any] = (
            await owner.get(f"/api/teams/{s.team.id}/breakdown")
        ).json()
    return body


async def test_slot_markers_appear_in_the_breakdown(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _world(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.post(
            s.lineup_url, json=s.move(s.players[0], QB, confirmOverride=True)
        )
        await commissioner.post(s.lineup_url, json=s.move(s.players[3], FLEX))
    starters = {
        slot["index"]: slot
        for slot in (await _breakdown(client_as, s))["rounds"][0]["starters"]
    }
    assert starters[QB]["mark"]["kind"] == "override"
    assert starters[QB]["mark"]["actorName"] == "user0"
    assert starters[FLEX]["mark"]["kind"] == "commissioner_set"
    assert starters[1]["mark"] is None


async def test_a_changed_score_carries_its_old_and_new_counted_points(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _world(db)
    await _poll(db, s, "Completed", "300")  # 10 -> 12 points, 2x in the Wild Card
    bench = (await _breakdown(client_as, s))["rounds"][0]["bench"]
    change = next(p for p in bench if p["playerId"] == s.players[0].id)
    assert change["points"] == 24
    assert (
        change["scoreChange"]["previousPoints"],
        change["scoreChange"]["newPoints"],
    ) == (20, 24)
    assert change["scoreChange"]["changedAt"]


async def test_a_player_whose_score_never_changed_has_no_score_change(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _world(db)
    bench = (await _breakdown(client_as, s))["rounds"][0]["bench"]
    assert [p["scoreChange"] for p in bench] == [None]
