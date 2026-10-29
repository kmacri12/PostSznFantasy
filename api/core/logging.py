import json
import logging
import logging.config
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from api.core.config import get_settings

REQUEST_ID_HEADER = "X-Request-ID"
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

_RESERVED_RECORD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}
_LEVEL_COLORS = {
    "DEBUG": "\033[36m",
    "INFO": "\033[32m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[35m",
}
_RESET = "\033[0m"


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


def _extra_fields(record: logging.LogRecord) -> dict[str, Any]:
    return {
        key: value
        for key, value in vars(record).items()
        if key not in _RESERVED_RECORD_ATTRS and key != "request_id"
    }


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            **_extra_fields(record),
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


class ConsoleFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        color = _LEVEL_COLORS.get(record.levelname, "") if sys.stderr.isatty() else ""
        reset = _RESET if color else ""
        request_id = getattr(record, "request_id", None)
        rid = f" [{request_id[:8]}]" if request_id else ""
        extras = "".join(f" {k}={v}" for k, v in _extra_fields(record).items())
        line = (
            f"{self.formatTime(record, '%H:%M:%S')} "
            f"{color}{record.levelname:<8}{reset} {record.name}{rid}: "
            f"{record.getMessage()}{extras}"
        )
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


def setup_logging() -> None:
    """Configure root logging once; JSON in production, colorized text locally."""
    settings = get_settings()
    use_json = settings.log_format == "json" or (
        settings.log_format == "auto" and settings.environment != "development"
    )
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"request_id": {"()": RequestIdFilter}},
            "formatters": {
                "default": {
                    "()": JsonFormatter if use_json else ConsoleFormatter,
                }
            },
            "handlers": {
                "stderr": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stderr",
                    "formatter": "default",
                    "filters": ["request_id"],
                }
            },
            "root": {"level": settings.log_level.upper(), "handlers": ["stderr"]},
            # Our middleware emits the access log; uvicorn's duplicates it.
            "loggers": {"uvicorn.access": {"level": "WARNING"}},
        }
    )


class RequestLoggingMiddleware:
    """Pure ASGI middleware so it also sees WebSocket scopes without buffering."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = logging.getLogger("api.request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope["headers"])
        request_id = (
            headers.get(REQUEST_ID_HEADER.lower().encode(), b"").decode()
            or uuid.uuid4().hex
        )
        token = request_id_ctx.set(request_id)
        status_code = 500
        start = time.perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message.setdefault("headers", []).append(
                    (REQUEST_ID_HEADER.lower().encode(), request_id.encode())
                )
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            self.logger.exception(
                "Unhandled error",
                extra={"method": scope["method"], "path": scope["path"]},
            )
            raise
        finally:
            self.logger.info(
                "%s %s -> %s",
                scope["method"],
                scope["path"],
                status_code,
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status_code": status_code,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                },
            )
            request_id_ctx.reset(token)
