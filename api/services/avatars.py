"""Profile, league and team pictures (#316).

The browser crops to a square and uploads a small PNG, JPEG or WebP. The bytes go to a
private object store only this API can read (Supabase Storage in production, a local
directory in dev and e2e); the database row keeps the random key. Pictures are served
by `GET /api/avatars/{key}`: the key is an unguessable capability, so <img> tags need no
token, and a new upload gets a new key, so responses can be cached forever.
"""

import asyncio
import logging
import re
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Protocol

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import Settings, get_settings
from api.db.models.league import League, Team
from api.db.models.user import User
from api.services.support import ImageType, sniff_image

logger = logging.getLogger(__name__)

MAX_AVATAR_BYTES = 1024 * 1024
# Uploads are decoded and re-saved at this size: the stored copy carries no metadata
# (a direct API client's photo may hold GPS and device tags every member could fetch).
MAX_DIMENSION = 512
# A small file can still decode to a huge image; refuse before allocating it.
MAX_SOURCE_PIXELS = 25_000_000
STORED_TYPE = "image/webp"
# Objects younger than this are left alone by the orphan sweep: an upload is stored
# before its database row commits.
ORPHAN_MIN_AGE_SECONDS = 24 * 3600
AVATAR_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
KEY_PATTERN = re.compile(r"^[0-9a-f]{32}$")
REQUEST_TIMEOUT_SECONDS = 15
LIST_PAGE = 100

type AvatarOwner = User | League | Team


class AvatarError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class AvatarStore(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    async def get(self, key: str) -> bytes | None: ...

    async def delete(self, key: str) -> None: ...

    async def list_objects(self) -> list[tuple[str, datetime]]: ...


class LocalAvatarStore:
    def __init__(self, directory: str) -> None:
        self._directory = Path(directory)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self._directory.mkdir(parents=True, exist_ok=True)
        (self._directory / key).write_bytes(data)

    async def get(self, key: str) -> bytes | None:
        path = self._directory / key
        return path.read_bytes() if path.is_file() else None

    async def delete(self, key: str) -> None:
        (self._directory / key).unlink(missing_ok=True)

    async def list_objects(self) -> list[tuple[str, datetime]]:
        if not self._directory.is_dir():
            return []
        return [
            (path.name, datetime.fromtimestamp(path.stat().st_mtime, UTC))
            for path in self._directory.iterdir()
            if path.is_file()
        ]


class SupabaseAvatarStore:
    """Supabase Storage REST API; the bucket must be private."""

    def __init__(self, settings: Settings) -> None:
        base = settings.supabase_url.rstrip("/")
        self._object_url = f"{base}/storage/v1/object/{settings.avatar_bucket}"
        self._headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }

    async def _request(
        self, method: str, key: str, data: bytes | None = None, content_type: str = ""
    ) -> httpx.Response:
        headers = dict(self._headers)
        if content_type:
            headers["Content-Type"] = content_type
        async with httpx.AsyncClient(
            transport=_transport, timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:
            return await client.request(
                method, f"{self._object_url}/{key}", headers=headers, content=data
            )

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        (await self._request("POST", key, data, content_type)).raise_for_status()

    async def get(self, key: str) -> bytes | None:
        response = await self._request("GET", key)
        if response.status_code in (400, 404):
            return None
        response.raise_for_status()
        return response.content

    async def delete(self, key: str) -> None:
        (await self._request("DELETE", key)).raise_for_status()

    async def list_objects(self) -> list[tuple[str, datetime]]:
        listed: list[tuple[str, datetime]] = []
        offset = 0
        list_url = self._object_url.replace("/object/", "/object/list/", 1)
        while True:
            async with httpx.AsyncClient(
                transport=_transport, timeout=REQUEST_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    list_url,
                    headers=self._headers,
                    json={"prefix": "", "limit": LIST_PAGE, "offset": offset},
                )
            response.raise_for_status()
            page = response.json()
            listed += [
                (item["name"], datetime.fromisoformat(item["created_at"]))
                for item in page
                if item.get("created_at")
            ]
            if len(page) < LIST_PAGE:
                return listed
            offset += LIST_PAGE


# Tests install httpx.MockTransport here so Supabase is never called.
_transport: httpx.AsyncBaseTransport | None = None
# Tests replace the store outright.
_store_override: AvatarStore | None = None


def get_store() -> AvatarStore:
    if _store_override is not None:
        return _store_override
    settings = get_settings()
    if not settings.avatars_enabled:
        raise AvatarError(503, "Pictures are not set up yet.")
    if settings.avatar_local_dir:
        return LocalAvatarStore(settings.avatar_local_dir)
    return SupabaseAvatarStore(settings)


def avatar_url(key: str | None) -> str | None:
    return f"/api/avatars/{key}" if key else None


def validate_avatar(data: bytes) -> ImageType:
    if not data:
        raise AvatarError(422, "Choose a picture to upload.")
    if len(data) > MAX_AVATAR_BYTES:
        raise AvatarError(413, "That picture is too large. The limit is 1 MB.")
    kind = sniff_image(data)
    if kind is None or kind.mime not in AVATAR_TYPES:
        raise AvatarError(422, "Pictures must be PNG, JPEG or WebP images.")
    return kind


def reencode(data: bytes) -> bytes:
    """Decode the upload and save a fresh WebP of at most 512 px, dropping every tag."""
    try:
        with Image.open(BytesIO(data)) as source:
            width, height = source.size
            if width * height > MAX_SOURCE_PIXELS:
                raise AvatarError(422, "That picture is too large. Use a smaller one.")
            image = ImageOps.exif_transpose(source)
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise AvatarError(422, "We couldn't read that picture. Try another.") from exc
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    out = BytesIO()
    image.save(out, "WEBP", quality=85)
    return out.getvalue()


async def set_avatar(owner: AvatarOwner, data: bytes) -> None:
    """Store a re-encoded copy under a fresh key and drop the previous one."""
    validate_avatar(data)
    data = await asyncio.to_thread(reencode, data)
    store = get_store()
    key = uuid.uuid4().hex
    try:
        await store.put(key, data, STORED_TYPE)
    except httpx.HTTPError as exc:
        logger.error("Avatar not stored: %s", type(exc).__name__)
        raise AvatarError(502, "We couldn't save that picture. Try again.") from exc
    previous, owner.avatar_key = owner.avatar_key, key
    await _forget(store, previous)


async def clear_avatar(owner: AvatarOwner) -> None:
    previous, owner.avatar_key = owner.avatar_key, None
    if previous:
        await _forget(get_store(), previous)


async def _forget(store: AvatarStore, key: str | None) -> None:
    """Best effort: an orphaned object costs a little space, a failed delete must not
    undo the change the member just made."""
    if not key:
        return
    try:
        await store.delete(key)
    except httpx.HTTPError as exc:
        logger.warning("Old avatar not deleted: %s", type(exc).__name__)


async def read_avatar(key: str) -> tuple[bytes, str] | None:
    if not KEY_PATTERN.match(key):
        return None
    try:
        data = await get_store().get(key)
    except httpx.HTTPError as exc:
        logger.error("Avatar not read: %s", type(exc).__name__)
        raise AvatarError(502, "Picture unavailable.") from exc
    if data is None:
        return None
    kind = sniff_image(data)
    return (data, kind.mime) if kind else None


async def prune_orphans(db: AsyncSession, now: datetime | None = None) -> int:
    """Delete stored objects no profile, team or league points at (a failed delete of a
    replaced picture leaves one); returns how many."""
    if not get_settings().avatars_enabled and _store_override is None:
        return 0
    now = now or datetime.now(UTC)
    referenced: set[str] = set()
    for owner in (User, Team, League):
        referenced.update(
            key
            for key in await db.scalars(
                select(owner.avatar_key).where(owner.avatar_key.is_not(None))
            )
            if key
        )
    store = get_store()
    removed = 0
    for key, created_at in await store.list_objects():
        age = (now - created_at).total_seconds()
        if (
            KEY_PATTERN.match(key)
            and key not in referenced
            and age > ORPHAN_MIN_AGE_SECONDS
        ):
            await _forget(store, key)
            removed += 1
    return removed
