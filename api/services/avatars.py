"""Profile, league and team pictures (#316).

The browser crops to a square and uploads a small PNG, JPEG or WebP. The bytes go to a
private object store only this API can read (Supabase Storage in production, a local
directory in dev and e2e); the database row keeps the random key. Pictures are served
by `GET /api/avatars/{key}`: the key is an unguessable capability, so <img> tags need no
token, and a new upload gets a new key, so responses can be cached forever.
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Protocol

import httpx

from api.core.config import Settings, get_settings
from api.db.models.league import League, Team
from api.db.models.user import User
from api.services.support import ImageType, sniff_image

logger = logging.getLogger(__name__)

MAX_AVATAR_BYTES = 1024 * 1024
AVATAR_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
KEY_PATTERN = re.compile(r"^[0-9a-f]{32}$")
REQUEST_TIMEOUT_SECONDS = 15

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


async def set_avatar(owner: AvatarOwner, data: bytes) -> None:
    """Store the picture under a fresh key and drop the previous one."""
    kind = validate_avatar(data)
    store = get_store()
    key = uuid.uuid4().hex
    try:
        await store.put(key, data, kind.mime)
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
