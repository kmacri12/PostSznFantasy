"""Profile, league and team pictures (#316): who may set them, limits, serving."""

from datetime import UTC, datetime
from io import BytesIO
from typing import Any

import pytest
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.services import avatars
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


def _image(kind: str, size: tuple[int, int] = (64, 64), **save: Any) -> bytes:
    out = BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(out, kind, **save)
    return out.getvalue()


PNG = _image("PNG")
JPEG = _image("JPEG")
WEBP = _image("WEBP")
GIF = b"GIF89a" + b"\x00" * 32


class MemoryStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.created: dict[str, datetime] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    async def list_objects(self) -> list[tuple[str, datetime]]:
        return [(key, self.created.get(key, datetime.now(UTC))) for key in self.objects]

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
        assert served.content == next(iter(store.objects.values()))
        assert served.headers["content-type"] == "image/webp"
        assert served.headers["cache-control"].startswith("private")

        second = await _put(client, "/api/avatars/me", JPEG)
        assert second.json()["avatarUrl"] != url
        assert len(store.objects) == 1
        assert (await client.get(url)).status_code == 404


async def test_the_stored_copy_is_a_small_webp_without_location_metadata(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    exif = Image.Exif()
    exif[0x010F] = "SecretPhone"
    exif[0x8825] = {1: "N", 2: (40.0, 26.0, 46.0), 3: "W", 4: (79.0, 58.0, 56.0)}
    photo = _image("JPEG", (2000, 1000), exif=exif)
    assert b"SecretPhone" in photo
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        response = await _put(client, "/api/avatars/me", photo)
    assert response.status_code == 200
    [stored] = store.objects.values()
    assert b"SecretPhone" not in stored
    with Image.open(BytesIO(stored)) as image:
        assert image.format == "WEBP"
        assert max(image.size) == 512
        assert not image.getexif()


async def test_bytes_that_only_look_like_an_image_are_refused(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        response = await _put(
            client, "/api/avatars/me", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
        )
    assert response.status_code == 422
    assert store.objects == {}


async def test_orphaned_objects_are_swept_but_referenced_and_new_ones_stay(
    db: AsyncSession, client_as: ClientFactory, store: MemoryStore
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        kept = (await _put(client, "/api/avatars/me", PNG)).json()["avatarUrl"]
    kept_key = kept.rsplit("/", 1)[1]
    store.objects["a" * 32] = b"orphan"
    store.objects["b" * 32] = b"orphan too"
    store.created["a" * 32] = datetime(2020, 1, 1, tzinfo=UTC)
    # b was just uploaded and its row may not have committed yet.
    assert await avatars.prune_orphans(db) == 1
    assert set(store.objects) == {kept_key, "b" * 32}


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
