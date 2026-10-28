import logging

import httpx
from api.core.config import get_settings
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class RapidApiClient:
    """Async HTTP client for the RapidAPI NFL endpoints.

    Uses httpx.AsyncClient with tenacity retry on transient HTTP errors (429, 5xx).
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.rapidapi_baseurl
        self._headers = {
            "X-RapidAPI-Key": settings.rapidapi_apikey,
            "X-RapidAPI-Host": settings.rapidapi_apihost,
        }

    async def _get(self, route: str, params: dict[str, str] | None = None) -> object:
        """Execute a GET request with exponential-backoff retry on 429/5xx."""
        url = self._base_url + route
        async for attempt in AsyncRetrying(
            retry=retry_if_exception_type(httpx.HTTPStatusError),
            wait=wait_exponential(multiplier=1, min=1, max=30),
            stop=stop_after_attempt(3),
            reraise=True,
        ):
            with attempt:
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.get(
                        url, headers=self._headers, params=params
                    )
                    response.raise_for_status()
                    return response.json()
        return {}  # unreachable, satisfies mypy

    async def get_nfl_teams(self) -> list[dict[str, object]]:
        try:
            data = await self._get("/getNFLTeams")
            return list(data["body"])  # type: ignore[index]
        except Exception:
            logger.exception("Failed to fetch NFL teams")
            return []

    async def get_nfl_players(self) -> list[dict[str, object]]:
        try:
            data = await self._get("/getNFLPlayerList")
            return list(data["body"])  # type: ignore[index]
        except Exception:
            logger.exception("Failed to fetch NFL player list")
            return []

    async def get_nfl_games_list(
        self, season: str, season_type: str, week: str = "all"
    ) -> list[dict[str, object]]:
        try:
            params = {"week": week, "seasonType": season_type, "season": season}
            data = await self._get("/getNFLGamesForWeek", params=params)
            return list(data["body"])  # type: ignore[index]
        except Exception:
            logger.exception("Failed to fetch NFL games list")
            return []

    async def get_nfl_box_score(self, game_id: str) -> dict[str, object]:
        try:
            data = await self._get("/getNFLBoxScore", params={"gameID": game_id})
            return dict(data["body"])  # type: ignore[index]
        except Exception:
            logger.exception("Failed to fetch box score for game %s", game_id)
            return {}

    async def get_stats_for_team(
        self, team_id: str, team_abv: str
    ) -> list[dict[str, object]]:
        try:
            params = {"teamID": team_id, "teamAbv": team_abv, "getStats": "true"}
            data = await self._get("/getNFLTeamRoster", params=params)
            roster = data["body"]["roster"]  # type: ignore[index]
            return list(roster)
        except Exception:
            logger.exception("Failed to fetch roster/stats for team %s", team_abv)
            return []


# Backward-compatibility alias
RapidApi = RapidApiClient
