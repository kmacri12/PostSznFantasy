import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from api.core.config import get_settings

logger = logging.getLogger(__name__)

CACHE_MAX_ENTRIES = 64
LOW_QUOTA_THRESHOLD = 50
MAX_RETRY_AFTER_SECONDS = 60.0

_backoff = wait_exponential(multiplier=1, min=1, max=30)


class RapidApiBudgetExceeded(Exception):
    """The daily request cap is spent; no call was made."""


def _utc_day() -> str:
    return datetime.now(UTC).date().isoformat()


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code == 429 or exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError)


def _wait(retry_state: RetryCallState) -> float:
    """Honour Retry-After on 429s; otherwise exponential backoff."""
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
        try:
            return min(
                float(exc.response.headers["Retry-After"]), MAX_RETRY_AFTER_SECONDS
            )
        except (KeyError, ValueError):
            pass
    return float(_backoff(retry_state))


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
        self.requests_remaining: int | None = None
        self._daily_limit = settings.rapidapi_daily_request_limit
        self._budget_day = _utc_day()
        self._requests_today = 0
        # Dev-only: replay saved responses so re-seeding doesn't burn the monthly quota.
        self._disk_cache_dir = (
            Path(settings.rapidapi_cache_dir) if settings.rapidapi_cache_dir else None
        )

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

    def _disk_path(self, cache_key: str) -> Path | None:
        if self._disk_cache_dir is None:
            return None
        return (
            self._disk_cache_dir
            / f"{hashlib.sha256(cache_key.encode()).hexdigest()}.json"
        )

    def _roll_budget_day(self) -> None:
        today = _utc_day()
        if today != self._budget_day:
            self._budget_day = today
            self._requests_today = 0

    @property
    def budget_exhausted(self) -> bool:
        self._roll_budget_day()
        return self._daily_limit > 0 and self._requests_today >= self._daily_limit

    def _spend_budget(self) -> None:
        if self.budget_exhausted:
            raise RapidApiBudgetExceeded(
                f"Daily RapidAPI budget of {self._daily_limit} requests is spent"
            )
        self._requests_today += 1

    def _record_quota(self, response: httpx.Response) -> None:
        try:
            remaining = int(response.headers["x-ratelimit-requests-remaining"])
        except (KeyError, ValueError):
            return
        self.requests_remaining = remaining
        if remaining <= LOW_QUOTA_THRESHOLD:
            logger.warning("RapidAPI quota low: %d requests remaining", remaining)
        else:
            logger.info("RapidAPI requests remaining: %d", remaining)

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

        disk_path = self._disk_path(f"{self._base_url}{cache_key}")
        if disk_path is not None and disk_path.exists():
            return json.loads(disk_path.read_text())

        await self._throttle()
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_is_retryable),
            wait=_wait,
            stop=stop_after_attempt(3),
            reraise=True,
        ):
            with attempt:
                self._spend_budget()
                response = await self._client().get(
                    self._base_url + route, params=params
                )
                self._record_quota(response)
                response.raise_for_status()
                data = response.json()
        if disk_path is not None:
            disk_path.parent.mkdir(parents=True, exist_ok=True)
            disk_path.write_text(json.dumps(data))
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
