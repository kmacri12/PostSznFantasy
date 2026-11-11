from collections.abc import Iterator

import pytest
from httpx import AsyncClient

from api.core.config import get_settings


@pytest.fixture
def min_version(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("MIN_APP_VERSION", "1700000000")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def test_no_minimum_never_refuses(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/config", headers={"X-App-Version": "1"})
    assert response.status_code == 200


@pytest.mark.usefixtures("min_version")
async def test_older_build_gets_426_with_a_code(async_client: AsyncClient) -> None:
    response = await async_client.get(
        "/api/config", headers={"X-App-Version": "1600000000"}
    )
    assert response.status_code == 426
    assert response.json()["code"] == "app_outdated"
    assert "refresh" in response.json()["detail"]


@pytest.mark.usefixtures("min_version")
async def test_current_build_and_callers_without_the_header_pass(
    async_client: AsyncClient,
) -> None:
    current = await async_client.get(
        "/api/config", headers={"X-App-Version": "1700000000"}
    )
    assert current.status_code == 200
    assert (await async_client.get("/api/config")).status_code == 200
    garbage = await async_client.get("/api/config", headers={"X-App-Version": "abc"})
    assert garbage.status_code == 200
