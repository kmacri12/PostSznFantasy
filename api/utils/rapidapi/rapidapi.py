import asyncio
import logging
import time
from typing import Any

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
    """Async HTTP client for RapidAPI NFL endpoints with rate-limiting & exponential retries."""

    def __init__(self, requests_per_second: float = 4.0) -> None:
        settings = get_settings()
        self._base_url = settings.rapidapi_baseurl.rstrip("/")
        self._headers = {
            "X-RapidAPI-Key": settings.rapidapi_apikey,
            "X-RapidAPI-Host": settings.rapidapi_apihost,
        }
        self._min_interval = (
            1.0 / requests_per_second if requests_per_second > 0 else 0.0
        )
        self._last_request_time = 0.0
        self._lock = asyncio.Lock()
        self._cache: dict[str, Any] = {}

    async def _throttle(self) -> None:
        async with self._lock:
            elapsed = time.monotonic() - self._last_request_time
            if elapsed < self._min_interval:
                await asyncio.sleep(self._min_interval - elapsed)
            self._last_request_time = time.monotonic()

    async def _get(
        self,
        route: str,
        params: dict[str, str] | None = None,
        use_cache: bool = False,
    ) -> Any:
        cache_key = f"{route}:{sorted(params.items()) if params else ''}"
        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        await self._throttle()
        url = self._base_url + route
        async for attempt in AsyncRetrying(
            retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.RequestError)),
            wait=wait_exponential(multiplier=1, min=1, max=30),
            stop=stop_after_attempt(3),
            reraise=True,
        ):
            with attempt:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(
                        url, headers=self._headers, params=params
                    )
                    response.raise_for_status()
                    data = response.json()
                    if use_cache:
                        self._cache[cache_key] = data
                    return data
        return {}

    async def get_nfl_teams(self) -> list[dict[str, Any]]:
        try:
            data = await self._get("/getNFLTeams", use_cache=True)
            return list(data.get("body", []))
        except Exception:
            logger.exception("Failed to fetch NFL teams")
            return []

    async def get_nfl_players(self) -> list[dict[str, Any]]:
        try:
            data = await self._get("/getNFLPlayerList", use_cache=True)
            return list(data.get("body", []))
        except Exception:
            logger.exception("Failed to fetch NFL player list")
            return []

    async def get_nfl_games_list(
        self, season: str, season_type: str, week: str = "all"
    ) -> list[dict[str, Any]]:
        try:
            params = {"week": week, "seasonType": season_type, "season": season}
            data = await self._get("/getNFLGamesForWeek", params=params)
            return list(data.get("body", []))
        except Exception:
            logger.exception(
                "Failed to fetch NFL games list for season=%s, type=%s",
                season,
                season_type,
            )
            return []

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        try:
            data = await self._get("/getNFLBoxScore", params={"gameID": game_id})
            return dict(data.get("body", {}))
        except Exception:
            logger.exception("Failed to fetch box score for game %s", game_id)
            return {}

    async def get_stats_for_team(
        self, team_id: str, team_abv: str
    ) -> list[dict[str, Any]]:
        try:
            params = {"teamID": team_id, "teamAbv": team_abv, "getStats": "true"}
            data = await self._get("/getNFLTeamRoster", params=params)
            roster = data.get("body", {}).get("roster", [])
            return list(roster)
        except Exception:
            logger.exception("Failed to fetch roster/stats for team %s", team_abv)
            return []


# Backward-compatibility alias
RapidApi = RapidApiClient
