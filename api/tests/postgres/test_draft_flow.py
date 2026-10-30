import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import DraftPick, League, LeagueSettings, TeamPlayer
from api.services.draft_picks import DraftPickError, make_pick
from api.tests.postgres.factories import make_league, make_players


async def test_snake_draft_runs_to_completion(db: AsyncSession) -> None:
    _, users, teams, draft = await make_league(db, teams=2, roster_total=2)
    players = await make_players(db, ["QB", "RB", "WR", "TE"])

    # Snake order over two teams: A, B, B, A
    order = [(users[0], 0), (users[1], 1), (users[1], 2), (users[0], 3)]
    results = []
    for user, idx in order:
        results.append(await make_pick(db, draft.league_id, user, players[idx].id))

    assert [r.pick.team_id for r in results] == [
        teams[0].id,
        teams[1].id,
        teams[1].id,
        teams[0].id,
    ]
    assert [r.pick.number_pick_overall for r in results] == [1, 2, 3, 4]
    assert results[-1].draft_complete
    await db.refresh(draft)
    assert draft.status == "completed"

    rostered = (
        (
            await db.execute(
                select(TeamPlayer.player_id).where(TeamPlayer.team_id == teams[0].id)
            )
        )
        .scalars()
        .all()
    )
    assert sorted(rostered) == [players[0].id, players[3].id]


async def test_out_of_turn_and_duplicate_picks_are_rejected(db: AsyncSession) -> None:
    _, users, _, draft = await make_league(db)
    players = await make_players(db, ["QB", "RB", "WR"])

    with pytest.raises(DraftPickError, match="not your turn") as not_turn:
        await make_pick(db, draft.league_id, users[1], players[0].id)
    assert not_turn.value.code == "not_your_turn"

    await make_pick(db, draft.league_id, users[0], players[0].id)
    with pytest.raises(DraftPickError, match="already been drafted") as taken:
        await make_pick(db, draft.league_id, users[1], players[0].id)
    assert taken.value.code == "player_taken"


async def test_position_limit_is_enforced(db: AsyncSession) -> None:
    _, users, _, draft = await make_league(db, roster_total=4, roster_max_qb=1)
    players = await make_players(db, ["QB", "QB", "QB", "RB"])

    await make_pick(db, draft.league_id, users[0], players[0].id)
    await make_pick(db, draft.league_id, users[1], players[1].id)
    # users[1] picks again (snake), users[0] then tries a second QB
    await make_pick(db, draft.league_id, users[1], players[3].id)
    with pytest.raises(DraftPickError, match="QB"):
        await make_pick(db, draft.league_id, users[0], players[2].id)


async def test_database_blocks_duplicate_player_in_one_draft(db: AsyncSession) -> None:
    _, _, teams, draft = await make_league(db)
    players = await make_players(db, ["QB"])
    for number in (1, 2):
        db.add(
            DraftPick(
                draft_id=draft.id,
                team_id=teams[0].id,
                player_id=players[0].id,
                number_round=1,
                number_pick_overall=number,
                number_pick_in_round=number,
            )
        )
    with pytest.raises(IntegrityError):
        await db.flush()


async def test_deleting_a_league_cascades(db: AsyncSession) -> None:
    league, users, teams, draft = await make_league(db)
    players = await make_players(db, ["QB"])
    await make_pick(db, league.id, users[0], players[0].id)

    await db.delete(await db.get(League, league.id))
    await db.flush()

    assert (
        await db.scalar(select(DraftPick.id).where(DraftPick.draft_id == draft.id))
        is None
    )
    assert (
        await db.scalar(
            select(TeamPlayer.team_id).where(TeamPlayer.team_id == teams[0].id)
        )
        is None
    )
    assert (
        await db.scalar(
            select(LeagueSettings.id).where(LeagueSettings.league_id == league.id)
        )
        is None
    )
