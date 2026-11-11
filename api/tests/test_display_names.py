from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from api.services.display_names import clean_display_name, disambiguate


@pytest.mark.parametrize(
    "bad", ["", "   ", "\t\n", "x" * 21, "a\x00b", "bell\x07", "a​b"]
)
def test_bad_names_are_refused(bad: str) -> None:
    with pytest.raises(ValueError):
        clean_display_name(bad)


def test_names_are_trimmed_and_counted_in_code_points() -> None:
    assert clean_display_name("  Sam  ") == "Sam"
    assert clean_display_name("🏈" * 20) == "🏈" * 20
    with pytest.raises(ValueError):
        clean_display_name("🏈" * 21)


def test_only_colliding_names_get_a_number() -> None:
    assert disambiguate(["Sam", "Alex", "sam", "Sam"]) == [
        "Sam",
        "Alex",
        "sam (2)",
        "Sam (3)",
    ]
    assert disambiguate(["A", "B"]) == ["A", "B"]


@pytest.mark.parametrize(
    "payload", [{"username": ""}, {"username": "   "}, {"username": "x" * 21}]
)
async def test_rename_validates_the_name(
    async_client: AsyncClient, payload: dict[str, str]
) -> None:
    assert (await async_client.patch("/api/auth/me", json=payload)).status_code == 422


async def test_login_refuses_an_overlong_name_and_treats_blank_as_absent(
    async_client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    assert (
        await async_client.post("/api/auth/login", json={"username": "x" * 21})
    ).status_code == 422
    mock_db_session.execute.return_value = MagicMock(
        one=lambda: (1, None, False, "user_test-sup", None, None)
    )
    blank = await async_client.post("/api/auth/login", json={"username": "   "})
    assert blank.status_code == 200
