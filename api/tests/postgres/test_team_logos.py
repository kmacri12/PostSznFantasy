from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLTeam
from api.services.ingestion.teams_ingest import ingest_nfl_teams
from api.tests.postgres.conftest import ClientFactory

LOGO = "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/ari.png"


async def test_team_logos_come_from_tank01s_espn_logo_and_are_listed_by_abbreviation(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await ingest_nfl_teams(
        db,
        raw_data=[
            {"teamID": "1", "teamAbv": "ARI", "espnLogo1": LOGO},
            {"teamID": "2", "teamAbv": "ATL"},
        ],
    )
    db.add(NFLTeam(id=3, team_abv="BAL", team_logo_url=None))
    await db.flush()

    async with client_as("uid-1") as client:
        response = await client.get("/api/players/team-logos")

    assert response.status_code == 200
    assert response.json() == {"ARI": LOGO}
