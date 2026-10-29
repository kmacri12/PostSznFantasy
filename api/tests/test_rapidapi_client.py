from collections.abc import AsyncIterator

import httpx
import pytest
import tenacity

from api.utils.rapidapi import rapidapi
from api.utils.rapidapi.rapidapi import RapidApiClient


@pytest.fixture
async def make_client(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[type[RapidApiClient]]:
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("RAPIDAPI_BASEURL", "https://api.example")
    from api.core.config import get_settings

    get_settings.cache_clear()
    # Skip real backoff sleeps.
    monkeypatch.setattr(tenacity.nap, "sleep", lambda _: None)
    yield RapidApiClient
    get_settings.cache_clear()


def with_transport(client: RapidApiClient, handler: httpx.MockTransport) -> None:
    client._http = httpx.AsyncClient(transport=handler, base_url="https://api.example")


@pytest.mark.asyncio
async def test_client_error_is_not_retried_and_propagates(
    make_client: type[RapidApiClient],
) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(403)

    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(handler))
    with pytest.raises(httpx.HTTPStatusError):
        await client.get_nfl_teams()
    assert calls == 1


@pytest.mark.asyncio
async def test_server_error_is_retried_then_succeeds(
    make_client: type[RapidApiClient],
) -> None:
    responses = [httpx.Response(503), httpx.Response(200, json={"body": [{"a": 1}]})]

    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(lambda r: responses.pop(0)))
    assert await client.get_nfl_teams() == [{"a": 1}]


@pytest.mark.asyncio
async def test_persistent_server_error_propagates(
    make_client: type[RapidApiClient],
) -> None:
    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(httpx.HTTPStatusError):
        await client.get_nfl_players()


@pytest.mark.asyncio
async def test_cache_is_bounded_and_reused(make_client: type[RapidApiClient]) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"body": []})

    client = make_client(requests_per_second=0, cache_size=2)
    with_transport(client, httpx.MockTransport(handler))
    await client.get_nfl_teams()
    await client.get_nfl_teams()
    assert calls == 1

    for route in ("/a", "/b", "/c"):
        await client._get(route, use_cache=True)
    assert len(client._cache) == 2


def test_legacy_alias_is_gone() -> None:
    assert not hasattr(rapidapi, "RapidApi")
