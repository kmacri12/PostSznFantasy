import json
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.models.enums import PlayerPosition
from api.services.ingestion.kicker_distances_ingest import ingest_kicker_distances

BOX: dict[str, Any] = json.loads(
    (Path(__file__).parents[1] / "fixtures/box_score_ne_den_kicks.json").read_text()
)["body"]
GAME_ID = BOX["gameID"]
KICKER_ID = 4569923  # Borregales: one made 23-yard FG, two misses


class FakeClient:
    def __init__(self) -> None:
        self.box_score_calls = 0

    async def get_nfl_games_list(self, *_: Any) -> list[dict[str, Any]]:
        return [
            {"gameID": GAME_ID, "gameStatus": "Completed"},
            {"gameID": "20260126_X@Y", "gameStatus": "Scheduled"},
        ]

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        self.box_score_calls += 1
        assert game_id == GAME_ID
        return BOX


async def test_season_row_gets_the_distance_of_every_field_goal(
    db: AsyncSession,
) -> None:
    db.add_all([NFLTeam(id=10, team_abv="DEN"), NFLTeam(id=22, team_abv="NE")])
    await db.flush()
    db.add(NFLPlayer(id=KICKER_ID, name="K", position=PlayerPosition.K, team_id=22))
    await db.flush()
    db.add(NFLPlayerSeasonStats(season="2026", player_id=KICKER_ID, kicking_fg_made=1))
    await db.flush()

    client = FakeClient()
    assert await ingest_kicker_distances(db, "2026", client) == 1  # type: ignore[arg-type]
    # Finished games are never fetched twice; unfinished ones never.
    assert await ingest_kicker_distances(db, "2026", client) == 0  # type: ignore[arg-type]
    assert client.box_score_calls == 1

    row = await db.get(NFLPlayerSeasonStats, ("2026", KICKER_ID))
    assert row is not None
    await db.refresh(row)
    assert row.kicking_fg_yards_made == [23]
