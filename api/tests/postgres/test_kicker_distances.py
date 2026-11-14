from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.models.enums import PlayerPosition
from api.services.ingestion.kicker_distances_ingest import ingest_kicker_distances

KICKER_ID = 4569923
OTHER_KICKER_ID = 4569924


def _field_goal(kicker_id: int, yards: int) -> dict[str, Any]:
    return {
        "score": f"Andy Borregales {yards} Yd Field Goal",
        "scoreType": "FG",
        "playerIDs": [str(kicker_id)],
    }


class FakeClient:
    """Three NE games; the per-player call leaves out the middle one."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def get_nfl_games_list(self, *_: Any) -> list[dict[str, Any]]:
        self.calls.append("games")
        return [
            {"gameID": "20251109_NE@MIA", "gameStatus": "Completed"},
            {"gameID": "20251116_BUF@NE", "gameStatus": "Final"},
            {"gameID": "20251123_NE@NYJ", "gameStatus": "Completed"},
            {"gameID": "20251130_NE@DAL", "gameStatus": "Scheduled"},
        ]

    async def get_nfl_games_for_player(
        self, player_id: int, *_: Any
    ) -> dict[str, dict[str, Any]]:
        self.calls.append(f"player {player_id}")
        return {
            "20250809_NE@GB": {"scoringPlays": [_field_goal(player_id, 55)]},
            "20251109_NE@MIA": {"scoringPlays": [_field_goal(player_id, 23)]},
            "20251123_NE@NYJ": {
                "scoringPlays": [_field_goal(player_id, 41), _field_goal(player_id, 30)]
            },
        }

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        self.calls.append(f"box {game_id}")
        return {"scoringPlays": [_field_goal(KICKER_ID, 47)]}


async def _kicker(
    db: AsyncSession, player_id: int, team: NFLTeam, fg_made: int
) -> NFLPlayerSeasonStats:
    db.add(
        NFLPlayer(id=player_id, name="K", position=PlayerPosition.K, team_id=team.id)
    )
    await db.flush()
    row = NFLPlayerSeasonStats(
        season="2026", player_id=player_id, kicking_fg_made=fg_made
    )
    db.add(row)
    await db.flush()
    return row


async def test_missing_games_are_filled_from_box_scores_for_playoff_kickers_only(
    db: AsyncSession,
) -> None:
    playoff_team = NFLTeam(id=22, team_abv="NE", in_playoffs=True)
    other_team = NFLTeam(id=23, team_abv="NYG", in_playoffs=False)
    db.add_all([playoff_team, other_team])
    await db.flush()
    playoff_kicker = await _kicker(db, KICKER_ID, playoff_team, fg_made=4)
    eliminated_kicker = await _kicker(db, OTHER_KICKER_ID, other_team, fg_made=4)

    client = FakeClient()
    calls = await ingest_kicker_distances(db, "2026", client)  # type: ignore[arg-type]

    # The preseason game is ignored, the missing middle game comes from its box score.
    assert playoff_kicker.kicking_fg_yards_made == [23, 47, 41, 30]
    assert eliminated_kicker.kicking_fg_yards_made == []
    assert client.calls == [
        "games",
        f"player {KICKER_ID}",
        "box 20251116_BUF@NE",
    ]
    assert calls == 3

    # Complete kickers are never read again.
    assert await ingest_kicker_distances(db, "2026", client) == 0  # type: ignore[arg-type]
    assert len(client.calls) == 3


async def test_a_complete_player_response_needs_no_box_scores(
    db: AsyncSession,
) -> None:
    team = NFLTeam(id=22, team_abv="NE", in_playoffs=True)
    db.add(team)
    await db.flush()
    kicker = await _kicker(db, KICKER_ID, team, fg_made=3)

    client = FakeClient()
    await ingest_kicker_distances(db, "2026", client)  # type: ignore[arg-type]

    assert kicker.kicking_fg_yards_made == [23, 41, 30]
    assert client.calls == ["games", f"player {KICKER_ID}"]
