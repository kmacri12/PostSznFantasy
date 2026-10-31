from sqlalchemy.ext.asyncio import AsyncSession

from api.services.season_recap import build_recap
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league


async def test_the_champion_is_crowned_once_the_super_bowl_is_final(
    db: AsyncSession,
) -> None:
    league, teams, _ = await finished_league(db)

    recap = await build_recap(db, league)

    assert recap.finished is True
    assert [c.team_id for c in recap.champions] == [teams[0].id]
    assert recap.champions[0].total == 30
    assert [t.rank for t in recap.standings.teams] == [1, 2]


async def test_no_champion_while_the_super_bowl_is_unfinished(
    db: AsyncSession,
) -> None:
    league, _, _ = await finished_league(db, finished_through=3)

    recap = await build_recap(db, league)

    assert recap.finished is False
    assert recap.champions == []


async def test_the_recap_route_is_for_members(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, teams, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        response = await member.get(f"/api/leagues/{league.id}/recap")
        assert response.status_code == 200
        body = response.json()
        assert body["finished"] is True
        assert body["champions"][0]["teamId"] == teams[0].id
    async with client_as("stranger") as stranger:
        assert (
            await stranger.get(f"/api/leagues/{league.id}/recap")
        ).status_code == 403


async def test_awards_are_computed_on_read_with_their_owner_teams(
    db: AsyncSession,
) -> None:
    league, teams, players = await finished_league(db)

    recap = await build_recap(db, league)

    by_key = {a.key: a for a in recap.awards}
    assert by_key["playoff_mvp"].player_id == players[0].id
    assert by_key["playoff_mvp"].team_id == teams[0].id
    assert by_key["playoff_mvp"].value == 30
    assert by_key["best_game"].round == 1
    assert by_key["best_game"].value == 20
    assert by_key["top_qb"].owner == "user0"
    assert by_key["champions_mvp"].team_id == teams[0].id


async def test_no_awards_before_the_season_ends(db: AsyncSession) -> None:
    league, _, _ = await finished_league(db, finished_through=3)
    assert (await build_recap(db, league)).awards == []
