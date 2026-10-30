import re
from typing import Any

import sentry_sdk

from api.core.config import Settings

SENSITIVE_HEADERS = frozenset({"authorization", "cookie", "set-cookie"})
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
JWT = re.compile(r"eyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?")
BEARER = re.compile(r"Bearer\s+[\w.~+/=-]+", re.IGNORECASE)
# Invite codes grant league access, so they never leave the process in a URL.
INVITE_CODE = re.compile(r"/(join|invites)/[^/?#]+")


def scrub_text(text: str) -> str:
    text = JWT.sub("[token]", text)
    text = BEARER.sub("Bearer [token]", text)
    return EMAIL.sub("[email]", text)


def scrub_url(url: str) -> str:
    return INVITE_CODE.sub(r"/\1/[code]", re.split(r"[?#]", url, maxsplit=1)[0])


def scrub_event(event: Any, hint: Any = None) -> Any:
    """Backstop for send_default_pii=False: strip anything identifying or secret."""
    event.pop("user", None)
    if message := event.get("message"):
        event["message"] = scrub_text(message)
    if transaction := event.get("transaction"):
        event["transaction"] = scrub_url(transaction)
    for value in event.get("exception", {}).get("values", []):
        if value.get("value"):
            value["value"] = scrub_text(value["value"])
    if request := event.get("request"):
        request.pop("cookies", None)
        request.pop("query_string", None)
        request.pop("data", None)
        if request.get("url"):
            request["url"] = scrub_url(request["url"])
        request["headers"] = {
            name: value
            for name, value in request.get("headers", {}).items()
            if name.lower() not in SENSITIVE_HEADERS
        }
    for crumb in event.get("breadcrumbs", {}).get("values", []):
        if crumb.get("message"):
            crumb["message"] = scrub_text(crumb["message"])
        if isinstance(crumb.get("data"), dict) and crumb["data"].get("url"):
            crumb["data"]["url"] = scrub_url(crumb["data"]["url"])
    return event


def init_sentry(settings: Settings) -> bool:
    """Start error reporting; a no-op (no SDK client, no network) without a DSN."""
    if not settings.sentry_dsn:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.sentry_release or None,
        send_default_pii=False,
        before_send=scrub_event,
    )
    return True
