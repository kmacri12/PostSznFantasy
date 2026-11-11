from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from api.core.config import get_settings

APP_VERSION_HEADER = b"x-app-version"
OUTDATED_BODY = {
    "detail": "PostSzn has been updated. Please refresh the page to keep going.",
    "code": "app_outdated",
}


class AppVersionMiddleware:
    """Refuses (426) an SPA build older than `MIN_APP_VERSION`.

    The SPA sends its build time (epoch seconds) as `X-App-Version`. A caller with no header
    (curl, tests, old bundles) is never refused; the owner raises the minimum only for an API
    change an already-open tab cannot survive (docs/deploy/frontend-hosting.md).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] != "OPTIONS":
            minimum = get_settings().min_app_version
            sent = dict(scope["headers"]).get(APP_VERSION_HEADER, b"")
            if minimum > 0 and sent.isdigit() and int(sent) < minimum:
                await JSONResponse(OUTDATED_BODY, status_code=426)(scope, receive, send)
                return
        await self.app(scope, receive, send)
