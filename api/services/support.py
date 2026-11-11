"""Support reports (#296): validate a member's message and screenshots, email them.

Nothing is stored. The email goes out through Resend's HTTP API; failures are logged
without the message, the address or the diagnostics.
"""

import base64
import json
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

import httpx

from api.core.config import Settings
from api.core.observability import scrub_text

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 20

MAX_IMAGES = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024
MAX_MESSAGE_CHARS = 5000
MAX_FEEDBACK_CHARS = 2000
MAX_DIAGNOSTICS_BYTES = 100 * 1024
# Multipart framing and the text fields ride along with the images.
REQUEST_OVERHEAD_BYTES = 512 * 1024
MAX_REQUEST_BYTES = MAX_TOTAL_IMAGE_BYTES + REQUEST_OVERHEAD_BYTES

REPORTS_PER_HOUR = 5
RATE_WINDOW_SECONDS = 60 * 60

# Keys that could carry a credential, whatever the client sent.
SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "cookies",
        "set-cookie",
        "token",
        "accesstoken",
        "access_token",
        "refreshtoken",
        "refresh_token",
        "apikey",
        "api_key",
        "password",
        "secret",
    }
)
MAX_TEXT_CHARS = 2000
MAX_LIST_ITEMS = 100

# Image types are recognised by their first bytes, never by the filename or the
# content type the browser claims.
_HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"}


class SupportError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class ImageType:
    mime: str
    extension: str


def sniff_image(data: bytes) -> ImageType | None:
    if data.startswith(b"\xff\xd8\xff"):
        return ImageType("image/jpeg", "jpg")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ImageType("image/png", "png")
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ImageType("image/gif", "gif")
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ImageType("image/webp", "webp")
    if data[4:8] == b"ftyp" and data[8:12] in _HEIC_BRANDS:
        return ImageType("image/heic", "heic")
    return None


@dataclass(frozen=True)
class Attachment:
    filename: str
    content: bytes


def megabytes(size: int) -> str:
    return f"{size / (1024 * 1024):.1f} MB"


def validate_images(uploads: list[bytes]) -> list[Attachment]:
    """Check count, sizes and content; the messages mirror the ones the modal shows."""
    if len(uploads) > MAX_IMAGES:
        raise SupportError(422, f"Attach at most {MAX_IMAGES} images.")
    attachments: list[Attachment] = []
    for number, data in enumerate(uploads, start=1):
        if len(data) > MAX_IMAGE_BYTES:
            raise SupportError(
                413,
                f"Image {number} is {megabytes(len(data))}. "
                f"The limit is {megabytes(MAX_IMAGE_BYTES)} per image.",
            )
        kind = sniff_image(data)
        if kind is None:
            raise SupportError(422, f"Attachment {number} is not an image.")
        attachments.append(Attachment(f"screenshot-{number}.{kind.extension}", data))
    total = sum(len(item.content) for item in attachments)
    if total > MAX_TOTAL_IMAGE_BYTES:
        raise SupportError(
            413,
            f"The images add up to {megabytes(total)}. "
            f"The limit is {megabytes(MAX_TOTAL_IMAGE_BYTES)} in total.",
        )
    return attachments


def scrub_diagnostics(value: Any) -> Any:
    """Server-side backstop for the client's scrubbing: drop credential keys, mask
    tokens and addresses in every string, bound sizes."""
    if isinstance(value, dict):
        return {
            str(key)[:100]: scrub_diagnostics(item)
            for key, item in value.items()
            if str(key).lower() not in SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [scrub_diagnostics(item) for item in value[-MAX_LIST_ITEMS:]]
    if isinstance(value, str):
        return scrub_text(value)[:MAX_TEXT_CHARS]
    return value


def parse_diagnostics(raw: str) -> dict[str, Any] | None:
    """The scrubbed diagnostics object, or None when the member sent none."""
    if not raw.strip():
        return None
    if len(raw.encode()) > MAX_DIAGNOSTICS_BYTES:
        raise SupportError(413, "The diagnostic info is too large.")
    try:
        parsed = json.loads(raw)
    except ValueError as exc:
        raise SupportError(422, "The diagnostic info is not valid.") from exc
    if not isinstance(parsed, dict):
        raise SupportError(422, "The diagnostic info is not valid.")
    scrubbed = scrub_diagnostics(parsed)
    assert isinstance(scrubbed, dict)
    return scrubbed


class RateLimiter:
    """Sliding window per user, in memory: the API is one process (docs/deploy/fly.md),
    and a restart forgetting the window only loosens it for an hour."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self._limit = limit
        self._window = window_seconds
        self._sent: defaultdict[int, deque[float]] = defaultdict(deque)

    def retry_after(self, user_id: int) -> int | None:
        """Seconds until another report is allowed, or None when one is."""
        recent = self._sent[user_id]
        cutoff = time.monotonic() - self._window
        while recent and recent[0] <= cutoff:
            recent.popleft()
        if len(recent) < self._limit:
            return None
        return int(recent[0] + self._window - time.monotonic()) + 1

    def record(self, user_id: int) -> None:
        self._sent[user_id].append(time.monotonic())

    def reset(self) -> None:
        self._sent.clear()


rate_limiter = RateLimiter(REPORTS_PER_HOUR, RATE_WINDOW_SECONDS)

FEEDBACK_PER_HOUR = 5
feedback_rate_limiter = RateLimiter(FEEDBACK_PER_HOUR, RATE_WINDOW_SECONDS)

# Tests install httpx.MockTransport here so the real Resend is never called.
_transport: httpx.AsyncBaseTransport | None = None


def subject_for(username: str, message: str) -> str:
    first_line = " ".join(message.split())[:70]
    return f"[PostSzn support] {username}: {first_line}"


def feedback_subject(rating: int | None) -> str:
    return (
        f"[PostSzn feedback] {rating}/5" if rating else "[PostSzn feedback] no rating"
    )


def feedback_body(*, rating: int | None, good: str, bad: str) -> str:
    """Anonymous on purpose: no name, email or ids, so it is safe to read in a group."""
    return "\n".join(
        [
            f"Rating: {rating}/5" if rating else "Rating: none",
            "",
            "What was good:",
            good or "(nothing written)",
            "",
            "What was bad:",
            bad or "(nothing written)",
        ]
    )


def body_for(
    *,
    user_id: int,
    username: str,
    email: str | None,
    message: str,
    diagnostics: dict[str, Any] | None,
    request_id: str | None,
) -> str:
    lines = [
        f"From: {username} (user {user_id}, {email or 'no email on file'})",
        f"Request ID of this report: {request_id or 'none'}",
        "",
        "Message:",
        message,
        "",
    ]
    if diagnostics is None:
        lines.append("Diagnostic info: the member left it out.")
    else:
        lines += [
            "Diagnostic info (scrubbed, ids only):",
            json.dumps(diagnostics, indent=2, sort_keys=True, default=str),
        ]
    return "\n".join(lines)


async def send_report(
    settings: Settings,
    *,
    reply_to: str | None,
    subject: str,
    text: str,
    attachments: list[Attachment],
) -> None:
    if not settings.support_enabled:
        raise SupportError(503, "Problem reports are not set up yet.")
    payload: dict[str, Any] = {
        "from": settings.support_from_email,
        "to": [settings.support_email],
        "subject": subject,
        "text": text,
        "attachments": [
            {
                "filename": item.filename,
                "content": base64.b64encode(item.content).decode(),
            }
            for item in attachments
        ],
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        async with httpx.AsyncClient(
            transport=_transport, timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(
                settings.resend_api_url,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
    except httpx.HTTPError as exc:
        logger.error("Support email not sent: %s", type(exc).__name__)
        raise SupportError(
            502, "We couldn't send your report. Try again in a few minutes."
        ) from exc
    if response.status_code >= 400:
        logger.error("Support email rejected by Resend: HTTP %s", response.status_code)
        raise SupportError(
            502, "We couldn't send your report. Try again in a few minutes."
        )
