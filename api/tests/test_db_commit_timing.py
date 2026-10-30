from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from api.db import session as session_module
from api.db.session import DbSession


class RecordingSession:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    async def __aenter__(self) -> "RecordingSession":
        return self

    async def __aexit__(self, *_: object) -> None:
        self.events.append("close")

    async def commit(self) -> None:
        self.events.append("commit")

    async def rollback(self) -> None:
        self.events.append("rollback")


@pytest.mark.asyncio
async def test_the_request_is_committed_before_the_response_is_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A client that reads right after a write must see it, so the commit can't lag."""
    events: list[str] = []
    monkeypatch.setattr(
        session_module, "AsyncSessionLocal", lambda: RecordingSession(events)
    )
    app = FastAPI()

    @app.post("/write")
    async def write(db: DbSession) -> dict[str, bool]:
        return {"ok": True}

    async def recording_asgi(scope: Any, receive: Any, send: Any) -> None:
        async def recording_send(message: Any) -> None:
            if message["type"] == "http.response.start":
                events.append("response sent")
            await send(message)

        await app(scope, receive, recording_send)

    transport = httpx.ASGITransport(app=recording_asgi)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.post("/write")).status_code == 200

    assert events.index("commit") < events.index("response sent")
