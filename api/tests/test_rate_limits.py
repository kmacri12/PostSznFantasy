import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from api.core import rate_limit
from api.core.body_limit import limit_for
from api.dependencies.league import get_season_member
from api.main import app
from api.models.feed_models import FeedMessageItem
from api.services import avatars


def test_window_refuses_past_the_limit_and_reports_the_wait() -> None:
    limiter = rate_limit.RateLimiter("t", "slow down", (2, 60), (3, 3600))
    assert limiter.check("a") is None
    assert limiter.check("a") is None
    wait = limiter.check("a")
    assert wait is not None and 1 <= wait <= 61
    assert limiter.check("b") is None


def test_refused_calls_are_not_recorded() -> None:
    limiter = rate_limit.RateLimiter("t", "slow down", (1, 60))
    limiter.check("a")
    first = limiter.check("a")
    for _ in range(50):
        limiter.check("a")
    assert limiter.check("a") == first


def test_idle_keys_are_swept() -> None:
    limiter = rate_limit.RateLimiter("t", "slow down", (1, 60))
    for i in range(rate_limit._SWEEP_EVERY):
        limiter.check(f"ip-{i}")
    limiter._sweep(time.monotonic() + 10_000)
    assert not limiter._hits


async def test_chat_is_refused_after_the_limit_with_retry_after(
    async_client: AsyncClient,
) -> None:
    body = {"body": "hi"}
    app.dependency_overrides[get_season_member] = lambda: MagicMock()
    item = FeedMessageItem(
        id=1, created_at=datetime(2026, 1, 1, tzinfo=UTC), author_user_id=1,
        author_name="a", body="hi", gif_url=None, can_delete=True, can_edit=True,
        edited_at=None, is_new=False, reply_to=None, mentions=[], reactions=[],
    )  # fmt: skip
    with patch("api.routers.activity.feed.post_message", new=AsyncMock()) as post:
        post.return_value = MagicMock(id=1, mentioned_user_ids=[])
        with (
            patch("api.routers.activity.push.spawn") as spawn,
            patch("api.routers.activity.announce_feed_change", new=AsyncMock()),
            patch(
                "api.routers.activity.feed.message_items",
                new=AsyncMock(return_value=[item]),
            ),
        ):
            codes = [
                (
                    await async_client.post("/api/seasons/1/messages", json=body)
                ).status_code
                for _ in range(21)
            ]
            last = await async_client.post("/api/seasons/1/messages", json=body)
    assert codes[:20] == [201] * 20
    assert codes[20] == 429
    assert last.headers["Retry-After"].isdigit()
    assert "too fast" in last.json()["detail"]
    assert spawn.call_count == 20


async def test_invite_preview_is_throttled_per_ip(async_client: AsyncClient) -> None:
    with patch(
        "api.routers.invites.invite_service.find_invite",
        new=AsyncMock(return_value=None),
    ):
        codes = [
            (await async_client.get("/api/invites/abc")).status_code for _ in range(61)
        ]
    assert codes[:60] == [404] * 60
    assert codes[60] == 429


@pytest.mark.parametrize(
    ("method", "path", "limit"),
    [
        ("post", "/api/invites/abc/join", 10),
        ("put", "/api/avatars/me", 10),
    ],
)
async def test_per_user_routes_stop_after_their_limit(
    async_client: AsyncClient, method: str, path: str, limit: int
) -> None:
    with (
        patch(
            "api.routers.invites.invite_service.find_invite",
            new=AsyncMock(return_value=None),
        ),
        patch("api.routers.avatars._me", new=AsyncMock(return_value=MagicMock())),
        patch(
            "api.routers.avatars._store",
            new=AsyncMock(return_value={"avatarUrl": None}),
        ),
    ):
        codes = [
            (await async_client.request(method, path, content=b"x")).status_code
            for _ in range(limit + 1)
        ]
    assert codes[-1] == 429
    assert 429 not in codes[:-1]


async def test_create_league_is_limited_to_five_a_day(
    async_client: AsyncClient,
) -> None:
    codes = [
        (await async_client.post("/api/leagues/create-league", json={})).status_code
        for _ in range(6)
    ]
    assert codes[5] == 429
    assert 429 not in codes[:5]


async def test_a_chunked_body_past_the_cap_is_cut_off(
    async_client: AsyncClient,
) -> None:
    async def chunks() -> AsyncIterator[bytes]:  # no Content-Length: the body streams
        for _ in range(8):
            yield b"x" * (avatars.MAX_AVATAR_BYTES // 4)

    with patch("api.routers.avatars._me", new=AsyncMock(return_value=MagicMock())):
        response = await async_client.put("/api/avatars/me", content=chunks())
    assert response.status_code == 413


def test_route_caps() -> None:
    assert limit_for("/api/teams/3/avatar") > avatars.MAX_AVATAR_BYTES
    assert limit_for("/api/seasons/1/messages") < avatars.MAX_AVATAR_BYTES
