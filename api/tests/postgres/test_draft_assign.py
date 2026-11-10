import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    ActivityEvent,
    Draft,
    DraftPick,
    Season,
    Team,
    TeamPlayer,
    User,
)
from api.services import activity, draft_flow
from api.services.draft_flow import assign_pick, auto_pick, build_state
from api.services.draft_picks import DraftPickError, make_pick
from api.tests.postgres.factories import make_players, make_season

# Two teams, three rounds, snake: A, B, B, A, A, B (overall slots 1-6).


async def _actor(db: AsyncSession, user_id: int) -> activity.Actor:
    user = await db.get(User, user_id)
    assert user is not None
    return activity.Actor.of(user)


async def _setup(
    db: AsyncSession, **roster: int
) -> tuple[Season, list[User], list[Team], Draft, activity.Actor]:
    season, users, teams, draft = await make_season(db, roster_total=3, **roster)  # type: ignore[arg-type]
    return season, users, teams, draft, await _actor(db, users[0].id)


async def test_a_reserved_slot_is_filled_when_it_comes_up(db: AsyncSession) -> None:
    season, users, teams, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR", "TE", "RB", "WR"])

    assert (
        await assign_pick(db, season.id, 3, players[5].id, replace=False, actor=actor)
        is None
    )
    await make_pick(db, season.id, users[0], players[0].id)
    second = await make_pick(db, season.id, users[1], players[1].id)

    assert [c.pick.number_pick_overall for c in second.chained] == [3]
    assert second.chained[0].pick.player_id == players[5].id
    assert second.chained[0].pick.team_id == teams[1].id
    assert not second.chained[0].pick.autopick
    state = await build_state(db, draft)
    assert state.current_pick_overall == 4
    assert state.on_the_clock_team_id == teams[0].id
    assert state.reserved_picks == []


async def test_assigning_the_slot_on_the_clock_picks_now(db: AsyncSession) -> None:
    season, _, teams, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR"])

    result = await assign_pick(
        db, season.id, 1, players[0].id, replace=False, actor=actor
    )

    assert result is not None
    assert result.pick.team_id == teams[0].id
    assert result.pick.player_id == players[0].id
    assert (await build_state(db, draft)).current_pick_overall == 2
    event = await db.scalar(
        select(ActivityEvent).where(ActivityEvent.kind == "draft_pick_assigned")
    )
    assert event is not None
    assert event.payload["pickNumber"] == 1
    assert event.payload["scheduled"] is False
    assert event.team_id == teams[0].id


async def test_reserved_players_are_off_limits_to_everyone_else(
    db: AsyncSession,
) -> None:
    season, users, _, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR", "TE", "RB", "WR"])
    await assign_pick(db, season.id, 4, players[0].id, replace=False, actor=actor)

    with pytest.raises(DraftPickError, match="reserved") as err:
        await make_pick(db, season.id, users[0], players[0].id)
    assert err.value.code == "player_reserved"
    with pytest.raises(DraftPickError, match="reserved"):
        await assign_pick(db, season.id, 5, players[0].id, replace=False, actor=actor)

    picked = await auto_pick(db, season.id)
    assert picked.pick.player_id != players[0].id
    ids = {r.player_id for r in (await build_state(db, draft)).reserved_picks}
    assert ids == {players[0].id}


async def test_replacing_a_pick_frees_the_old_player(db: AsyncSession) -> None:
    season, users, teams, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR"])
    await make_pick(db, season.id, users[0], players[0].id)

    with pytest.raises(DraftPickError) as filled:
        await assign_pick(db, season.id, 1, players[1].id, replace=False, actor=actor)
    assert filled.value.code == "slot_filled"

    assert (
        await assign_pick(db, season.id, 1, players[1].id, replace=True, actor=actor)
        is None
    )
    pick = await db.scalar(select(DraftPick).where(DraftPick.draft_id == draft.id))
    assert pick is not None and pick.player_id == players[1].id
    rostered = (
        (
            await db.execute(
                select(TeamPlayer.player_id).where(TeamPlayer.team_id == teams[0].id)
            )
        )
        .scalars()
        .all()
    )
    assert list(rostered) == [players[1].id]
    # The old player can be drafted again.
    await make_pick(db, season.id, users[1], players[0].id)


async def test_replacing_a_slot_that_is_not_made_yet_is_refused(
    db: AsyncSession,
) -> None:
    season, _, _, _, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB"])
    with pytest.raises(DraftPickError) as err:
        await assign_pick(db, season.id, 1, players[0].id, replace=True, actor=actor)
    assert err.value.code == "slot_open"


async def test_a_pick_that_landed_first_is_not_overwritten(db: AsyncSession) -> None:
    """The commissioner tapped the open slot 1; the drafter's pick wins the lock."""
    season, users, _, _, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR"])
    await make_pick(db, season.id, users[0], players[0].id)

    with pytest.raises(DraftPickError) as err:
        await assign_pick(db, season.id, 1, players[1].id, replace=False, actor=actor)
    assert err.value.code == "slot_filled"
    pick = await db.scalar(select(DraftPick).where(DraftPick.number_pick_overall == 1))
    assert pick is not None and pick.player_id == players[0].id


async def test_a_reservation_cannot_overfill_a_position_cap(db: AsyncSession) -> None:
    season, users, _, _, actor = await _setup(db, roster_max_qb=1)
    players = await make_players(db, ["QB", "QB", "RB", "WR", "TE", "RB"])
    # Team A owns slots 1, 4 and 5; it is due a QB at slot 4.
    await assign_pick(db, season.id, 4, players[0].id, replace=False, actor=actor)

    with pytest.raises(DraftPickError, match="QB") as err:
        await make_pick(db, season.id, users[0], players[1].id)
    assert err.value.code == "position_capped"
    with pytest.raises(DraftPickError, match="QB"):
        await assign_pick(db, season.id, 5, players[1].id, replace=False, actor=actor)


async def test_future_slot_validation_uses_the_normal_rules(db: AsyncSession) -> None:
    season, _, _, _, actor = await _setup(db)
    players = await make_players(db, ["QB"])
    with pytest.raises(DraftPickError, match="no such pick"):
        await assign_pick(db, season.id, 7, players[0].id, replace=False, actor=actor)
    with pytest.raises(DraftPickError, match="Player not found"):
        await assign_pick(db, season.id, 3, 424242, replace=False, actor=actor)


async def test_chained_reservations_can_finish_the_draft(db: AsyncSession) -> None:
    season, users, _, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR", "TE", "RB", "WR"])
    for slot, index in ((3, 2), (4, 3), (5, 4), (6, 5)):
        await assign_pick(
            db, season.id, slot, players[index].id, replace=False, actor=actor
        )
    await make_pick(db, season.id, users[0], players[0].id)
    last = await make_pick(db, season.id, users[1], players[1].id)

    assert [c.pick.number_pick_overall for c in last.chained] == [3, 4, 5, 6]
    assert last.draft_complete
    await db.refresh(draft)
    assert draft.status == "completed"


async def test_replacing_in_a_finished_draft_keeps_it_complete(
    db: AsyncSession,
) -> None:
    season, users, _, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB", "WR", "TE", "RB", "WR", "K"])
    for user, index in ((0, 0), (1, 1), (1, 2), (0, 3), (0, 4), (1, 5)):
        await make_pick(db, season.id, users[user], players[index].id)

    await assign_pick(db, season.id, 2, players[6].id, replace=True, actor=actor)
    await db.refresh(draft)
    assert draft.status == "completed"


async def test_clearing_a_reservation_frees_the_player(db: AsyncSession) -> None:
    season, _, _, draft, actor = await _setup(db)
    players = await make_players(db, ["QB", "RB"])
    await assign_pick(db, season.id, 3, players[0].id, replace=False, actor=actor)
    await draft_flow.clear_reservation(db, season.id, 3)
    assert (await build_state(db, draft)).reserved_picks == []
    with pytest.raises(DraftPickError, match="Nothing is reserved"):
        await draft_flow.clear_reservation(db, season.id, 3)
