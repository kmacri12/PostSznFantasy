"""Profile, league and team pictures (#316): who may set them, limits, serving."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.services import avatars
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 32
GIF = b"GIF89a" + b"\x00" * 32


class MemoryStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    async def get(self, key: str) -> bytes | None:
        return self.objects.get(key)

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch) -> MemoryStore:
    fake = MemoryStore()
    monkeypatch.setattr(avatars, "_store_override", fake)
    return fake


def _put(client, path: str, body: bytes):  # type: ignore[no-untyped-def]
    return client.put(path, content=body, headers={"content-type": "image/png"})


async def test_a_member_sets_and_replaces_their_picture(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        first = await _put(client, "/api/avatars/me", PNG)
        assert first.status_code == 200
        url = first.json()["avatarUrl"]
        assert url.startswith("/api/avatars/")
        served = await client.get(url)
        assert served.status_code == 200
        assert served.content == PNG
        assert served.headers["content-type"] == "image/png"
        assert "immutable" in served.headers["cache-control"]

        second = await _put(client, "/api/avatars/me", JPEG)
        assert second.json()["avatarUrl"] != url
        assert len(store.objects) == 1
        assert (await client.get(url)).status_code == 404


async def test_login_and_members_carry_the_picture(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    season, _, _, _ = await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        url = (await _put(client, "/api/avatars/me", WEBP)).json()["avatarUrl"]
        login = await client.post("/api/auth/login", json={})
        assert login.json()["avatarUrl"] == url
        overview = await client.get(f"/api/leagues/{season.league_id}")
        by_name = {m["username"]: m for m in overview.json()["members"]}
        assert by_name["user1"]["avatarUrl"] == url
        assert by_name["user0"]["avatarUrl"] is None


async def test_clearing_removes_the_picture_and_its_object(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        await _put(client, "/api/avatars/me", PNG)
        assert (await client.delete("/api/avatars/me")).status_code == 204
        assert store.objects == {}
        assert (await client.post("/api/auth/login", json={})).json()[
            "avatarUrl"
        ] is None


@pytest.mark.parametrize("body", [b"%PDF-1.7 nope", b"<svg/>", GIF, b""])
async def test_only_png_jpeg_and_webp_content_is_accepted(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore, body: bytes
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        response = await _put(client, "/api/avatars/me", body)
    assert response.status_code == 422
    assert store.objects == {}


async def test_a_picture_over_one_megabyte_is_refused(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        response = await _put(client, "/api/avatars/me", PNG + b"\x00" * (1024 * 1024))
    assert response.status_code == 413
    assert "1 MB" in response.json()["detail"]


async def test_only_commissioners_set_the_league_picture(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    season, _, _, _ = await make_season(db, teams=2)
    path = f"/api/leagues/{season.league_id}/avatar"
    async with client_as("uid-1") as member:
        assert (await _put(member, path, PNG)).status_code == 403
        assert (await member.delete(path)).status_code == 403
    async with client_as("uid-0") as commissioner:
        url = (await _put(commissioner, path, PNG)).json()["avatarUrl"]
        overview = await commissioner.get(f"/api/leagues/{season.league_id}")
        assert overview.json()["avatarUrl"] == url
        listed = (await commissioner.get("/api/leagues/user-leagues")).json()
        assert listed[0]["avatarUrl"] == url


async def test_the_owner_or_a_commissioner_sets_a_team_picture(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    season, _, teams, _ = await make_season(db, teams=3)
    path = f"/api/teams/{teams[1].id}/avatar"
    async with client_as("uid-2") as stranger:
        assert (await _put(stranger, path, PNG)).status_code == 403
    async with client_as("uid-1") as owner:
        url = (await _put(owner, path, PNG)).json()["avatarUrl"]
        assert (await owner.get(f"/api/teams/{teams[1].id}")).json()["avatarUrl"] == url
    async with client_as("uid-0") as commissioner:
        assert (await _put(commissioner, path, JPEG)).status_code == 200
        standings = (
            await commissioner.get(f"/api/seasons/{season.id}/standings")
        ).json()
        row = next(t for t in standings["teams"] if t["teamId"] == teams[1].id)
        assert row["teamAvatarUrl"] is not None
        overview = (await commissioner.get(f"/api/seasons/{season.id}")).json()
        brief = next(t for t in overview["teams"] if t["id"] == teams[1].id)
        assert brief["avatarUrl"] == row["teamAvatarUrl"]


async def test_the_served_key_must_be_well_formed_and_known(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        assert (await client.get("/api/avatars/not-a-key")).status_code == 404
        assert (await client.get("/api/avatars/" + "0" * 32)).status_code == 404


async def test_without_storage_uploads_say_it_is_not_set_up(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(avatars, "_store_override", None)
    monkeypatch.setattr(get_settings(), "supabase_service_role_key", "")
    monkeypatch.setattr(get_settings(), "avatar_local_dir", "")
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        response = await _put(client, "/api/avatars/me", PNG)
    assert response.status_code == 503
    assert "not set up" in response.json()["detail"]


def test_production_refuses_the_local_store() -> None:
    from pydantic import ValidationError

    from api.core.config import Settings

    def build(environment: str) -> Settings:
        return Settings(
            _env_file=None,
            pg_host="localhost",
            supabase_url="https://test.supabase.co",
            environment=environment,
            avatar_local_dir="/tmp/avatars",
        )

    assert build("test").avatars_enabled
    with pytest.raises(ValidationError, match="AVATAR_LOCAL_DIR"):
        build("production")
