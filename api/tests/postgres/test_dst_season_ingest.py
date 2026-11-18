from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.models.enums import PlayerPosition
from api.services.ingestion.dst_season_ingest import (
    ingest_dst_season_stats,
    refresh_dst_season_stats,
)

NE, MIA, NYG = 22, 14, 23


def _box(
    home: int, away: int, home_pts: int, away_pts: int, sacks: int
) -> dict[str, Any]:
    def side(team_id: int) -> dict[str, str]:
        return {
            "teamID": str(team_id),
            "totalYards": "300",
            "fumblesLost": "1",
            "defensiveOrSpecialTeamsTds": "0",
            "safeties": "0",
        }

    return {
        "teamIDHome": str(home),
        "teamIDAway": str(away),
        "homePts": str(home_pts),
        "awayPts": str(away_pts),
        "DST": {
            "home": {"teamID": str(home), "sacks": str(sacks)},
            "away": {"teamID": str(away), "sacks": "1"},
        },
        "teamStats": {"home": side(home), "away": side(away)},
    }


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def get_nfl_games_list(self, *_: Any) -> list[dict[str, Any]]:
        self.calls.append("games")
        return [
            {"gameID": "20251109_MIA@NE", "gameStatus": "Completed"},
            {"gameID": "20251116_NE@MIA", "gameStatus": "Completed"},
            {"gameID": "20251123_NYG@MIA", "gameStatus": "Completed"},
            {"gameID": "20251130_NE@DAL", "gameStatus": "Scheduled"},
        ]

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        self.calls.append(f"box {game_id}")
        if game_id == "20251109_MIA@NE":
            return _box(NE, MIA, 20, 10, sacks=3)
        return _box(MIA, NE, 17, 24, sacks=2)


async def _defense(db: AsyncSession, team_id: int, in_playoffs: bool) -> None:
    db.add(NFLTeam(id=team_id, team_abv=str(team_id), in_playoffs=in_playoffs))
    await db.flush()
    db.add(
        NFLPlayer(id=-team_id, name="DST", position=PlayerPosition.DST, team_id=team_id)
    )
    await db.flush()


async def test_a_playoff_defense_gets_its_regular_season_summed_from_box_scores(
    db: AsyncSession,
) -> None:
    await _defense(db, NE, True)
    await _defense(db, NYG, False)
    client = FakeClient()

    calls = await ingest_dst_season_stats(db, "2026", client)  # type: ignore[arg-type]

    row = await db.get(NFLPlayerSeasonStats, ("2026", -NE))
    assert row is not None
    assert (row.dst_sacks, row.dst_points_allowed, row.dst_fumbles_recovered) == (
        4,
        27,
        2,
    )
    assert await db.get(NFLPlayerSeasonStats, ("2026", -NYG)) is None
    # The NYG game and the unplayed one are never read.
    assert client.calls == ["games", "box 20251109_MIA@NE", "box 20251116_NE@MIA"]
    assert calls == 3

    assert await ingest_dst_season_stats(db, "2026", client) == 0  # type: ignore[arg-type]
    assert len(client.calls) == 3


class BrokenClient(FakeClient):
    async def get_nfl_games_list(self, *_: Any) -> list[dict[str, Any]]:
        raise RuntimeError("Tank01 is down")


async def test_a_failed_refresh_changes_nothing(db: AsyncSession) -> None:
    await _defense(db, NE, True)

    assert await refresh_dst_season_stats(db, "2026", BrokenClient()) == 0  # type: ignore[arg-type]

    assert await db.get(NFLPlayerSeasonStats, ("2026", -NE)) is None
