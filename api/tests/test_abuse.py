"""Abuse resistance: guessing invite codes, dodging limits, and unwired limiters.

The per-route limits themselves are exercised in test_rate_limits.py; this file asks
whether the limits and the invite code space hold against someone trying to get around
them.
"""

import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from api.core import rate_limit
from api.services.invites import CODE_ALPHABET, CODE_LENGTH, new_code

ROUTERS = Path(__file__).resolve().parents[1] / "routers"
PREVIEW_LIMIT_PER_MINUTE = 60
SECONDS_PER_YEAR = 365 * 24 * 3600


def test_invite_code_space_cannot_be_guessed_within_the_preview_limit() -> None:
    space = len(CODE_ALPHABET) ** CODE_LENGTH
    guesses_per_year = PREVIEW_LIMIT_PER_MINUTE * 60 * 24 * 365
    # One IP at the preview limit would need more than 10,000 years to cover half.
    assert space / 2 / guesses_per_year > 10_000


def test_invite_codes_are_unique_and_unambiguous() -> None:
    codes = {new_code() for _ in range(5000)}
    assert len(codes) == 5000
    assert all(len(code) == CODE_LENGTH for code in codes)
    assert not set("".join(codes)) - set(CODE_ALPHABET)
    assert not set("01OIL") & set(CODE_ALPHABET)


async def test_guessing_codes_is_cut_off_after_the_limit(
    async_client: AsyncClient,
) -> None:
    with patch(
        "api.routers.invites.invite_service.find_invite",
        new=AsyncMock(return_value=None),
    ) as lookup:
        codes = [
            (await async_client.get(f"/api/invites/{new_code()}")).status_code
            for _ in range(PREVIEW_LIMIT_PER_MINUTE + 40)
        ]
    assert codes.count(404) == PREVIEW_LIMIT_PER_MINUTE
    assert set(codes[PREVIEW_LIMIT_PER_MINUTE:]) == {429}
    assert lookup.await_count == PREVIEW_LIMIT_PER_MINUTE


async def test_a_forged_forwarded_for_header_does_not_reset_the_preview_limit(
    async_client: AsyncClient,
) -> None:
    with patch(
        "api.routers.invites.invite_service.find_invite",
        new=AsyncMock(return_value=None),
    ):
        for _ in range(PREVIEW_LIMIT_PER_MINUTE):
            await async_client.get("/api/invites/AAAAAAAA")
        forged = await async_client.get(
            "/api/invites/AAAAAAAA", headers={"X-Forwarded-For": "203.0.113.9"}
        )
    assert forged.status_code == 429


async def test_a_new_code_per_attempt_does_not_dodge_the_join_limit(
    async_client: AsyncClient,
) -> None:
    with patch(
        "api.routers.invites.invite_service.find_invite",
        new=AsyncMock(return_value=None),
    ):
        codes = [
            (await async_client.post(f"/api/invites/{new_code()}/join")).status_code
            for _ in range(11)
        ]
    assert codes[:10] == [404] * 10
    assert codes[10] == 429


@pytest.mark.parametrize("limiter", rate_limit._registry, ids=lambda x: x.name)
def test_every_limiter_stops_at_its_first_rule(limiter: rate_limit.RateLimiter) -> None:
    limit, _window = limiter._rules[0]
    results = [limiter.check("someone") for _ in range(limit + 1)]
    assert results[:limit] == [None] * limit
    assert results[limit] is not None
    assert limiter.check("someone else") is None


def test_every_limit_dependency_is_attached_to_a_route() -> None:
    source = "\n".join(path.read_text() for path in ROUTERS.glob("*.py"))
    aliases = re.findall(r"^(\w+Limit) = Annotated", _rate_limit_source(), re.M)
    assert aliases
    unused = [name for name in aliases if not re.search(rf"\b{name}\b", source)]
    assert not unused, f"Defined but on no route: {unused}"


def _rate_limit_source() -> str:
    return Path(rate_limit.__file__).read_text()
