"""The Supabase Storage client, with the network stubbed."""

import json

import httpx
import pytest

from api.core.config import Settings
from api.services import avatars


@pytest.fixture
def seen(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    requests: list[httpx.Request] = []
    objects: dict[str, bytes] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        name = request.url.path
        if request.method == "POST":
            objects[name] = request.content
            return httpx.Response(200, json={})
        if request.method == "DELETE":
            objects.pop(name, None)
            return httpx.Response(200, json={})
        if name in objects:
            return httpx.Response(200, content=objects[name])
        return httpx.Response(400, json={"error": "not_found"})

    monkeypatch.setattr(avatars, "_transport", httpx.MockTransport(handler))
    return requests


async def test_the_store_talks_to_a_private_bucket_with_the_service_key(
    seen: list[httpx.Request],
) -> None:
    store = avatars.SupabaseAvatarStore(
        Settings(
            _env_file=None,
            pg_host="localhost",
            supabase_url="https://abc.supabase.co/",
            supabase_service_role_key="service-key",
        )
    )
    await store.put("k" * 32, b"bytes", "image/png")
    assert await store.get("k" * 32) == b"bytes"
    await store.delete("k" * 32)
    assert await store.get("k" * 32) is None

    first = seen[0]
    assert (
        str(first.url)
        == f"https://abc.supabase.co/storage/v1/object/avatars/{'k' * 32}"
    )
    assert first.headers["authorization"] == "Bearer service-key"
    assert first.headers["content-type"] == "image/png"
    assert "/object/public/" not in str(first.url)


async def test_listing_pages_through_the_bucket_with_the_service_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        offset = json.loads(request.content)["offset"]
        count = avatars.LIST_PAGE if offset == 0 else 2
        return httpx.Response(
            200,
            json=[
                {
                    "name": f"{offset + i:032x}",
                    "created_at": "2026-01-01T00:00:00+00:00",
                }
                for i in range(count)
            ],
        )

    monkeypatch.setattr(avatars, "_transport", httpx.MockTransport(handler))
    store = avatars.SupabaseAvatarStore(
        Settings(
            _env_file=None,
            pg_host="localhost",
            supabase_url="https://abc.supabase.co",
            supabase_service_role_key="service-key",
        )
    )
    listed = await store.list_objects()
    assert len(listed) == avatars.LIST_PAGE + 2
    assert (
        str(requests[0].url) == "https://abc.supabase.co/storage/v1/object/list/avatars"
    )
    assert requests[0].headers["authorization"] == "Bearer service-key"
