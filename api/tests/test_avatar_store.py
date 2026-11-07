"""The Supabase Storage client, with the network stubbed."""

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
