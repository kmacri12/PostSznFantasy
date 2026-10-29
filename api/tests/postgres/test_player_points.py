from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLPlayerSeasonStats, NFLTeam
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players


async def test_fantasy_points_follow_the_leagues_scoring(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    (qb,) = await make_players(db, ["QB"], nfl_team=kc)
    db.add(
        NFLPlayerSeasonStats(
            season="2025", player_id=qb.id, passing_yards=4000, passing_touchdowns=30,
            passing_interceptions=10,
        )
    )  # fmt: skip
    await db.flush()
    url = f"/api/players/player-season-stats?season=2025&leagueId={league.id}"

    async with client_as("uid-0") as member:
        default = (await member.get(url)).json()[0]
        # 4000 * 0.04 + 30 * 4 - 10 = 270 under the Sleeper defaults.
        assert default["fantasyPoints"] == 270.0
        await member.patch(
            f"/api/leagues/{league.id}/settings", json={"scoringPassingTd": 6}
        )
        bumped = (await member.get(url)).json()[0]
        no_league = (
            await member.get("/api/players/player-season-stats?season=2025")
        ).json()[0]
    assert bumped["fantasyPoints"] == 330.0
    assert no_league["fantasyPoints"] is None

    async with client_as("stranger") as outsider:
        assert (await outsider.get(url)).status_code == 403
