import asyncio
import time
from collections import OrderedDict
from functools import lru_cache
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from api.core.config import get_settings

CACHE_MAX_ENTRIES = 64


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError)


class RapidApiClient:
    """Async HTTP client for RapidAPI NFL endpoints with rate-limiting & exponential retries.

    Failures propagate to the caller so a failed sync is never mistaken for an empty one.
    """

    def __init__(
        self, requests_per_second: float = 4.0, cache_size: int = CACHE_MAX_ENTRIES
    ) -> None:
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
        self._cache: OrderedDict[str, Any] = OrderedDict()
        self._cache_size = cache_size
        self._http: httpx.AsyncClient | None = None

    async def aclose(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=60.0, headers=self._headers)
        return self._http

    async def _throttle(self) -> None:
        async with self._lock:
            elapsed = time.monotonic() - self._last_request_time
            if elapsed < self._min_interval:
                await asyncio.sleep(self._min_interval - elapsed)
            self._last_request_time = time.monotonic()

    def _remember(self, key: str, data: Any) -> None:
        self._cache[key] = data
        self._cache.move_to_end(key)
        while len(self._cache) > self._cache_size:
            self._cache.popitem(last=False)

    async def _get(
        self,
        route: str,
        params: dict[str, str] | None = None,
        use_cache: bool = False,
    ) -> Any:
        cache_key = f"{route}:{sorted(params.items()) if params else ''}"
        if use_cache and cache_key in self._cache:
            self._cache.move_to_end(cache_key)
            return self._cache[cache_key]

        await self._throttle()
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_is_retryable),
            wait=wait_exponential(multiplier=1, min=1, max=30),
            stop=stop_after_attempt(3),
            reraise=True,
        ):
            with attempt:
                response = await self._client().get(
                    self._base_url + route, params=params
                )
                response.raise_for_status()
                data = response.json()
        if use_cache:
            self._remember(cache_key, data)
        return data

    async def get_nfl_teams(self) -> list[dict[str, Any]]:
        data = await self._get("/getNFLTeams", use_cache=True)
        return list(data.get("body", []))

    async def get_nfl_players(self) -> list[dict[str, Any]]:
        data = await self._get("/getNFLPlayerList", use_cache=True)
        return list(data.get("body", []))

    async def get_nfl_games_list(
        self, season: str, season_type: str, week: str = "all"
    ) -> list[dict[str, Any]]:
        params = {"week": week, "seasonType": season_type, "season": season}
        data = await self._get("/getNFLGamesForWeek", params=params)
        return list(data.get("body", []))

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        data = await self._get("/getNFLBoxScore", params={"gameID": game_id})
        return dict(data.get("body", {}))

    async def get_stats_for_team(
        self, team_id: str, team_abv: str
    ) -> list[dict[str, Any]]:
        params = {"teamID": team_id, "teamAbv": team_abv, "getStats": "true"}
        data = await self._get("/getNFLTeamRoster", params=params)
        return list(data.get("body", {}).get("roster", []))


@lru_cache(maxsize=1)
def get_rapidapi_client() -> RapidApiClient:
    """Process-wide client so the connection pool, throttle and cache are shared."""
    return RapidApiClient()


async def close_rapidapi_client() -> None:
    if get_rapidapi_client.cache_info().currsize:
        await get_rapidapi_client().aclose()
        get_rapidapi_client.cache_clear()
