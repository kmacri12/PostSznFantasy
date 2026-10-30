import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from api.services.ingestion.box_scores_ingest import GAME_COMPLETED
from api.services.ingestion.schemas import safe_int

# Real games run about this long; replayed scores ramp up linearly across it.
GAME_LENGTH_SECONDS = 3.5 * 3600
LIVE_STATUS = "Live - In Progress"


def load_replay(path: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Games-list entries and box scores saved from real responses (see
    `api.scripts.export_replay`). The file is only read, never written, so a
    rehearsal can be restarted from the same starting point."""
    data = json.loads(path.read_text())
    return data["games"], data["boxes"]


def virtual_clock(start: float, speed: float) -> Callable[[], float]:
    """Virtual epoch seconds that start at `start` and run `speed` times real time."""
    began = time.monotonic()
    return lambda: start + (time.monotonic() - began) * speed


class ReplayClient:
    """Stands in for `RapidApiClient`: serves stored responses as if the games were
    unfolding now, so the real poll, scoring and elimination code runs with no API
    calls. Only the scores ramp up; player stats are served in their final form."""

    requests_remaining: int | None = None
    budget_exhausted = False

    def __init__(
        self,
        games: list[dict[str, Any]],
        boxes: dict[str, dict[str, Any]],
        clock: Callable[[], float],
    ) -> None:
        self._games = games
        self._boxes = boxes
        self._clock = clock

    def _progress(self, game_id: str) -> float:
        kickoff = next(
            (
                float(g["gameTime_epoch"])
                for g in self._games
                if g.get("gameID") == game_id and g.get("gameTime_epoch")
            ),
            None,
        )
        if kickoff is None:
            return 1.0
        return min(max((self._clock() - kickoff) / GAME_LENGTH_SECONDS, 0.0), 1.0)

    @staticmethod
    def _status(progress: float, finished: str) -> str:
        if progress >= 1.0:
            return finished
        return LIVE_STATUS if progress > 0 else "Scheduled"

    async def get_nfl_games_list(
        self, season: str, season_type: str, week: str = "all"
    ) -> list[dict[str, Any]]:
        return [
            {
                **g,
                # The games list says "Final", box scores say "Completed".
                "gameStatus": self._status(self._progress(str(g["gameID"])), "Final"),
            }
            for g in self._games
        ]

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        box = self._boxes.get(game_id)
        if box is None:
            return {}
        progress = self._progress(game_id)
        scaled = {
            key: str(int((safe_int(box.get(key)) or 0) * progress))
            for key in ("homePts", "awayPts")
        }
        return {**box, **scaled, "gameStatus": self._status(progress, GAME_COMPLETED)}
