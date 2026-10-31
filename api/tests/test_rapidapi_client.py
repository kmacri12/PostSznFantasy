from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
import sentry_sdk
import tenacity

from api.core.config import get_settings
from api.core.observability import init_sentry
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


@pytest.mark.asyncio
async def test_remaining_quota_is_tracked(make_client: type[RapidApiClient]) -> None:
    client = make_client(requests_per_second=0)
    with_transport(
        client,
        httpx.MockTransport(
            lambda r: httpx.Response(
                200,
                json={"body": []},
                headers={"x-ratelimit-requests-remaining": "917"},
            )
        ),
    )
    assert client.requests_remaining is None
    await client.get_nfl_teams()
    assert client.requests_remaining == 917


@pytest.mark.asyncio
async def test_rate_limit_429_is_retried(make_client: type[RapidApiClient]) -> None:
    responses = [
        httpx.Response(429, headers={"Retry-After": "0"}),
        httpx.Response(200, json={"body": [{"a": 1}]}),
    ]
    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(lambda r: responses.pop(0)))
    assert await client.get_nfl_teams() == [{"a": 1}]


def _failed_state(response: httpx.Response) -> tenacity.RetryCallState:
    state = tenacity.RetryCallState(retry_object=None, fn=None, args=(), kwargs={})  # type: ignore[arg-type]
    request = httpx.Request("GET", "https://api.example")
    error = httpx.HTTPStatusError("x", request=request, response=response)
    state.set_exception((type(error), error, None))
    return state


def test_retry_after_header_sets_wait() -> None:
    state = _failed_state(httpx.Response(429, headers={"Retry-After": "7"}))
    assert rapidapi._wait(state) == 7.0
    capped = _failed_state(httpx.Response(429, headers={"Retry-After": "9999"}))
    assert rapidapi._wait(capped) == rapidapi.MAX_RETRY_AFTER_SECONDS


@pytest.mark.asyncio
async def test_persistent_429_propagates(make_client: type[RapidApiClient]) -> None:
    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(lambda r: httpx.Response(429)))
    with pytest.raises(httpx.HTTPStatusError):
        await client.get_nfl_teams()


@pytest.mark.asyncio
async def test_disk_cache_replays_without_network(
    make_client: type[RapidApiClient],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from api.core.config import get_settings

    monkeypatch.setenv("RAPIDAPI_CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"body": [{"a": 1}]})

    for _ in range(2):
        client = make_client(requests_per_second=0)
        with_transport(client, httpx.MockTransport(handler))
        assert await client.get_nfl_teams() == [{"a": 1}]
    assert calls == 1


@pytest.mark.asyncio
async def test_calls_beyond_the_daily_budget_are_refused_without_hitting_the_api(
    make_client: type[RapidApiClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "2")
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"body": {}})

    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(handler))
    await client.get_nfl_box_score("a")
    assert not client.budget_exhausted
    await client.get_nfl_box_score("b")
    assert client.budget_exhausted
    with pytest.raises(rapidapi.RapidApiBudgetExceeded):
        await client.get_nfl_box_score("c")
    assert calls == 2


@pytest.mark.asyncio
async def test_box_scores_are_requested_with_play_by_play(
    make_client: type[RapidApiClient],
) -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        return httpx.Response(200, json={"body": {}})

    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(handler))
    await client.get_nfl_box_score("20260125_NE@DEN")

    assert seen == {"gameID": "20260125_NE@DEN", "playByPlay": "true"}


@pytest.mark.asyncio
async def test_the_daily_budget_resets_on_a_new_utc_day(
    make_client: type[RapidApiClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "1")
    day = ["2027-01-10"]
    monkeypatch.setattr(rapidapi, "_utc_day", lambda: day[0])
    client = make_client(requests_per_second=0)
    with_transport(
        client, httpx.MockTransport(lambda r: httpx.Response(200, json={"body": {}}))
    )
    await client.get_nfl_box_score("a")
    assert client.budget_exhausted
    day[0] = "2027-01-11"
    assert not client.budget_exhausted
    await client.get_nfl_box_score("b")


@pytest.mark.asyncio
async def test_spending_the_budget_sends_one_sentry_message_per_utc_day(
    make_client: type[RapidApiClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "2")
    day = ["2027-01-10"]
    monkeypatch.setattr(rapidapi, "_utc_day", lambda: day[0])
    messages: list[tuple[str, str]] = []
    monkeypatch.setattr(
        sentry_sdk,
        "capture_message",
        lambda message, level=None: messages.append((message, str(level))),
    )
    client = make_client(requests_per_second=0)
    with_transport(
        client, httpx.MockTransport(lambda r: httpx.Response(200, json={"body": {}}))
    )
    await client.get_nfl_box_score("a")
    assert messages == []
    await client.get_nfl_box_score("b")
    for game in ("c", "d"):
        with pytest.raises(rapidapi.RapidApiBudgetExceeded):
            await client.get_nfl_box_score(game)
    assert messages == [("Tank01 daily request budget spent", "warning")]

    day[0] = "2027-01-11"
    await client.get_nfl_box_score("e")
    await client.get_nfl_box_score("f")
    with pytest.raises(rapidapi.RapidApiBudgetExceeded):
        await client.get_nfl_box_score("g")
    assert len(messages) == 2


@pytest.mark.asyncio
async def test_spending_the_budget_sends_nothing_without_a_dsn(
    make_client: type[RapidApiClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "1")
    assert not init_sentry(get_settings())
    client = make_client(requests_per_second=0)
    with_transport(
        client, httpx.MockTransport(lambda r: httpx.Response(200, json={"body": {}}))
    )
    await client.get_nfl_box_score("a")
    with pytest.raises(rapidapi.RapidApiBudgetExceeded):
        await client.get_nfl_box_score("b")
    assert not sentry_sdk.get_client().is_active()


@pytest.mark.asyncio
async def test_retries_count_against_the_budget(
    make_client: type[RapidApiClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "2")
    client = make_client(requests_per_second=0)
    with_transport(client, httpx.MockTransport(lambda r: httpx.Response(503)))
    with pytest.raises(rapidapi.RapidApiBudgetExceeded):
        await client.get_nfl_box_score("a")
    assert client.budget_exhausted


@pytest.mark.asyncio
async def test_each_call_logs_how_many_have_been_made_today(
    make_client: type[RapidApiClient],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setenv("RAPIDAPI_DAILY_REQUEST_LIMIT", "5")
    caplog.set_level("INFO")
    client = make_client(requests_per_second=0)
    with_transport(
        client, httpx.MockTransport(lambda r: httpx.Response(200, json={"body": {}}))
    )
    await client.get_nfl_box_score("a")
    await client.get_nfl_box_score("b")
    assert "RapidAPI call 1/5 today: /getNFLBoxScore" in caplog.text
    assert "RapidAPI call 2/5 today: /getNFLBoxScore" in caplog.text
    assert client.requests_today == 2
