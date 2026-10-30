from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLPlayerGameStats
from api.services.ingestion import ingest_nfl_teams
from api.services.ingestion.box_scores_ingest import poll_game_box_score
from api.services.ingestion.dst_stats import dst_player_id

TEAMS = [
    {
        "teamID": "17",
        "teamAbv": "NE",
        "teamCity": "New England",
        "teamName": "Patriots",
    },
    {"teamID": "29", "teamAbv": "SEA", "teamCity": "Seattle", "teamName": "Seahawks"},
]


def _team_stats(team_id: int, total_yards: int, tds: int) -> dict[str, str]:
    return {
        "teamID": str(team_id),
        "totalYards": str(total_yards),
        "fumblesLost": "0",
        "defensiveOrSpecialTeamsTds": str(tds),
    }


class _Client:
    async def get_nfl_box_score(self, game_id: str) -> dict[str, object]:
        return {
            "gameID": game_id,
            "gameStatus": "Completed",
            "teamIDHome": "17",
            "teamIDAway": "29",
            "homePts": "13",
            "awayPts": "29",
            "DST": {
                "home": {"teamID": "17", "sacks": "1", "defensiveInterceptions": "0"},
                "away": {"teamID": "29", "sacks": "4", "defensiveInterceptions": "2"},
            },
            "teamStats": {
                "home": _team_stats(17, 250, 0),
                "away": _team_stats(29, 330, 1),
            },
            "scoringPlays": [],
            "playerStats": {},
        }


async def test_every_team_gets_a_dst_player_and_each_game_writes_both_dst_rows(
    db: AsyncSession,
) -> None:
    await ingest_nfl_teams(db, raw_data=TEAMS)
    await ingest_nfl_teams(db, raw_data=TEAMS)  # reseeding is idempotent

    dsts = (
        (await db.execute(select(NFLPlayer).where(NFLPlayer.position == "DST")))
        .scalars()
        .all()
    )
    assert {(p.id, p.team_id, p.name) for p in dsts} == {
        (-17, 17, "New England Patriots"),
        (-29, 29, "Seattle Seahawks"),
    }

    await poll_game_box_score(db, "20260208_SEA@NE", "2025", client=_Client())  # type: ignore[arg-type]

    rows = {
        r.player_id: r
        for r in (await db.execute(select(NFLPlayerGameStats))).scalars().all()
    }
    ne, sea = rows[dst_player_id(17)], rows[dst_player_id(29)]
    # SEA's pick-six is not charged to NE's defense: 29 - 6 = 23 points allowed.
    assert (ne.dst_points_allowed, ne.dst_yards_allowed) == (23, 330)
    assert (sea.dst_points_allowed, sea.dst_yards_allowed) == (13, 250)
    assert (sea.dst_sacks, sea.dst_interceptions, sea.dst_def_td) == (4, 2, 1)
