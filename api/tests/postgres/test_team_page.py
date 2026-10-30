from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLGame, NFLTeam, TeamPlayer
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players


async def test_roster_shows_alive_status_and_next_game(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, teams, _ = await make_league(db, roster_total=2, roster_num_bench=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=False)
    db.add_all([kc, buf])
    await db.flush()
    alive = (await make_players(db, ["QB"], nfl_team=kc))[0]
    dead = (await make_players(db, ["RB"], nfl_team=buf, first_id=2000))[0]
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=alive.id),
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=dead.id),
            NFLGame(
                id="g1", season=2025, season_type="post", game_status="Scheduled",
                game_time_epoch="1800000000", team_id_home=1, team_id_away=3,
            ),
        ]
    )  # fmt: skip
    db.add(NFLTeam(id=3, team_abv="DEN", is_active=True))
    await db.flush()
    async with client_as("uid-0") as owner:
        roster = (await owner.get(f"/api/teams/{teams[0].id}")).json()["roster"]
    by_pos = {p["position"]: p for p in roster}
    assert by_pos["QB"]["isActive"] is True
    assert by_pos["QB"]["nextGame"]["opponentAbv"] == "DEN"
    assert by_pos["RB"]["isActive"] is False
    assert by_pos["RB"]["nextGame"] is None


async def test_owner_and_commissioner_can_rename_others_cannot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, _, teams, _ = await make_league(db)
    url = f"/api/teams/{teams[1].id}"
    async with client_as("uid-1") as owner:
        assert (await owner.patch(url, json={"name": "Mine"})).status_code == 200
        assert (
            await owner.patch(f"/api/teams/{teams[0].id}", json={"name": "Hack"})
        ).status_code == 403
    async with client_as("uid-0") as commissioner:
        renamed = await commissioner.patch(url, json={"name": "By Commish"})
    assert renamed.json()["name"] == "By Commish"
    assert (await db.get(type(teams[1]), teams[1].id)).name == "By Commish"  # type: ignore[union-attr]
