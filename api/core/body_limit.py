from fastapi import HTTPException, status
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from api.services import avatars, support

DEFAULT_MAX_BYTES = 256 * 1024
# Longest prefix wins. An avatar rides as the raw body; a support report is multipart.
ROUTE_MAX_BYTES = (
    ("/api/avatars/", avatars.MAX_AVATAR_BYTES + 4096),
    ("/api/support", support.MAX_REQUEST_BYTES),
)


def limit_for(path: str) -> int:
    if path.endswith("/avatar"):
        return avatars.MAX_AVATAR_BYTES + 4096
    for prefix, limit in ROUTE_MAX_BYTES:
        if path.startswith(prefix):
            return limit
    return DEFAULT_MAX_BYTES


class BodyLimitMiddleware:
    """Counts the bytes a handler actually reads, so a chunked body (no Content-Length)
    is cut off at the cap just like a declared oversize one. The 413 is raised from
    `receive`, i.e. inside the handler, where FastAPI turns it into a response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = limit_for(scope["path"])
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE, "That request is too large."
                    )
            return message

        await self.app(scope, limited_receive, send)
