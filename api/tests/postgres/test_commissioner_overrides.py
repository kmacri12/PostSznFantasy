"""Commissioner lineup edits: any lineup at any time, with a confirmation and a
permanent marker when a locked player is involved, an asterisk otherwise."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import LineupSlot, NFLGame, NFLPlayerGameStats
from api.tests.postgres.activity_support import (
    FLEX,
    FUTURE,
    HOUR,
    QB,
    RB,
    activity_league,
    game,
    slot_of,
)
from api.tests.postgres.conftest import ClientFactory

KICKED_OFF = datetime.now(UTC) - HOUR


async def _kc_started_league(db: AsyncSession, **kwargs: object):  # type: ignore[no-untyped-def]
    """KC (players 0-2) kicked off an hour ago; BUF (player 3) kicks off in a month."""
    return await activity_league(
        db,
        [game("g1", 1, 1, 3, KICKED_OFF), game("g2", 1, 2, 3, FUTURE)],
        **kwargs,  # type: ignore[arg-type]
    )


async def test_a_commissioner_can_set_an_unlocked_slot_on_another_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.post(s.lineup_url, json=s.move(s.players[1], RB))
        feed = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert response.status_code == 200
    mark = slot_of(response.json(), RB)["mark"]
    assert (mark["kind"], mark["actorName"]) == ("commissioner_set", "user0")
    assert mark["at"]
    event = feed["events"][0]
    assert event["kind"] == "lineup_move"
    assert event["payload"]["byCommissioner"] is True


async def test_the_asterisk_goes_when_the_player_locks(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.post(s.lineup_url, json=s.move(s.players[1], RB))
        kickoff = await db.get(NFLGame, "g1")
        assert kickoff is not None
        kickoff.game_time_epoch = str(int(KICKED_OFF.timestamp()))
        await db.flush()
        body = (await commissioner.get(f"/api/teams/{s.team.id}")).json()
    assert slot_of(body, RB)["player"]["locked"] is True
    assert slot_of(body, RB)["mark"] is None


async def test_an_owner_overwriting_a_commissioner_set_slot_clears_the_asterisk(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.post(s.lineup_url, json=s.move(s.players[1], RB))
        await commissioner.post(s.lineup_url, json=s.move(s.players[0], QB))
    async with client_as("uid-1") as owner:
        body = (await owner.post(s.lineup_url, json=s.move(s.players[2], RB))).json()
    assert slot_of(body, RB)["player"]["id"] == s.players[2].id
    assert slot_of(body, RB)["mark"] is None
    assert slot_of(body, QB)["mark"]["kind"] == "commissioner_set"


async def test_a_commissioner_on_their_own_team_makes_ordinary_moves(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db, roster_on=0)
    async with client_as("uid-0") as commissioner:
        body = (
            await commissioner.post(s.lineup_url, json=s.move(s.players[1], RB))
        ).json()
        feed = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert slot_of(body, RB)["mark"] is None
    assert feed["events"][0]["payload"]["byCommissioner"] is False


async def test_moving_a_locked_player_needs_the_confirm_flag(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    locked = s.players[1]
    async with client_as("uid-0") as commissioner:
        refused = await commissioner.post(s.lineup_url, json=s.move(locked, RB))
        feed = (await commissioner.get(f"/api/leagues/{s.league.id}/activity")).json()
    assert refused.status_code == 409
    assert refused.json()["code"] == "override_confirmation_required"
    assert "commissioner-only move" in refused.json()["detail"]
    assert feed["events"] == []
    assert (await db.execute(select(LineupSlot))).scalars().all() == []


async def test_a_confirmed_override_posts_to_the_league_feed_with_a_permanent_marker(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    locked = s.players[1]
    async with client_as("uid-0") as commissioner:
        done = await commissioner.post(
            s.lineup_url, json=s.move(locked, RB, confirmOverride=True)
        )
        league_feed = (
            await commissioner.get(f"/api/leagues/{s.league.id}/activity")
        ).json()
    assert done.status_code == 200
    mark = slot_of(done.json(), RB)["mark"]
    assert (mark["kind"], mark["actorName"]) == ("override", "user0")
    assert slot_of(done.json(), RB)["player"]["locked"] is True
    event = league_feed["events"][0]
    assert event["kind"] == "commissioner_override"
    assert event["actorName"] == "user0"
    assert event["payload"]["playerName"] == locked.name
    assert event["payload"]["toSlot"] == "RB"
    async with client_as("uid-1") as owner:
        later = (await owner.get(f"/api/teams/{s.team.id}")).json()
    assert slot_of(later, RB)["mark"]["kind"] == "override"


async def test_an_override_that_takes_a_locked_player_out_leaves_the_slot_marked(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    db.add(
        LineupSlot(team_id=s.team.id, round=1, player_id=s.players[1].id, slot_index=RB)
    )
    await db.flush()
    async with client_as("uid-0") as commissioner:
        done = await commissioner.post(
            s.lineup_url, json=s.move(s.players[1], None, confirmOverride=True)
        )
    slot = slot_of(done.json(), RB)
    assert slot["player"] is None
    assert slot["mark"]["kind"] == "override"


async def test_a_locked_swap_marks_both_slots(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    first, second = s.players[1], s.players[2]
    db.add_all(
        [
            LineupSlot(team_id=s.team.id, round=1, player_id=first.id, slot_index=RB),
            LineupSlot(
                team_id=s.team.id, round=1, player_id=second.id, slot_index=FLEX
            ),
        ]
    )
    await db.flush()
    async with client_as("uid-0") as commissioner:
        body = (
            await commissioner.post(
                s.lineup_url, json=s.move(second, RB, confirmOverride=True)
            )
        ).json()
    assert slot_of(body, RB)["player"]["id"] == second.id
    assert slot_of(body, FLEX)["player"]["id"] == first.id
    assert (
        slot_of(body, RB)["mark"]["kind"]
        == slot_of(body, FLEX)["mark"]["kind"]
        == "override"
    )


async def test_an_owner_cannot_override_even_with_the_flag(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    async with client_as("uid-1") as owner:
        refused = await owner.post(
            s.lineup_url, json=s.move(s.players[1], RB, confirmOverride=True)
        )
    assert refused.status_code == 409
    assert "code" not in refused.json()
    assert "locked" in refused.json()["detail"]


async def test_only_the_owner_or_a_commissioner_can_edit_a_lineup(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db, team_count=3)
    async with client_as("uid-2") as other_member:
        refused = await other_member.post(s.lineup_url, json=s.move(s.players[1], RB))
    assert refused.status_code == 403


async def test_a_player_drafted_after_kickoff_is_locked_until_a_commissioner_places_them(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db)
    late_pick = s.players[0]
    async with client_as("uid-1") as owner:
        body = (await owner.get(f"/api/teams/{s.team.id}")).json()
        refused = await owner.post(s.lineup_url, json=s.move(late_pick, QB))
    unplaced = {
        p["id"]: p
        for p in next(r for r in body["lineups"] if r["round"] == 1)["unassigned"]
    }
    assert unplaced[late_pick.id]["locked"] is True
    assert refused.status_code == 409
    async with client_as("uid-0") as commissioner:
        placed = await commissioner.post(
            s.lineup_url, json=s.move(late_pick, QB, confirmOverride=True)
        )
    assert slot_of(placed.json(), QB)["player"]["id"] == late_pick.id


async def test_a_commissioner_override_changes_the_standings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started_league(db, draft_status="completed")
    db.add(
        NFLPlayerGameStats(game_id="g1", player_id=s.players[0].id, passing_yards=300)
    )
    await db.flush()
    async with client_as("uid-0") as commissioner:
        await commissioner.post(
            s.lineup_url, json=s.move(s.players[0], QB, confirmOverride=True)
        )
        standings = (
            await commissioner.get(f"/api/leagues/{s.league.id}/standings")
        ).json()
    by_team = {row["teamId"]: row for row in standings}
    assert by_team[s.team.id]["wildCard"] == 12.0
