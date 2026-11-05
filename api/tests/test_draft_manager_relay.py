from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.core.config import get_settings
from api.ws.draft_manager import DraftConnectionManager, draft_manager


class FakeSocket:
    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send_text(self, payload: str) -> None:
        self.sent.append(payload)


class RecordingRelay:
    def __init__(self, *, fail: bool = False) -> None:
        self.published: list[tuple[int, dict[str, Any]]] = []
        self.fail = fail

    async def publish(self, league_id: int, message: dict[str, Any]) -> None:
        if self.fail:
            raise ConnectionError("listener down")
        self.published.append((league_id, message))


async def test_without_relay_broadcast_delivers_locally() -> None:
    manager = DraftConnectionManager()
    socket = FakeSocket()
    await manager.join(1, socket)  # type: ignore[arg-type]

    await manager.broadcast(1, {"eventType": "E"})

    assert socket.sent == ['{"eventType": "E"}']


async def test_with_relay_broadcast_only_publishes_until_it_comes_back() -> None:
    manager = DraftConnectionManager()
    relay = RecordingRelay()
    manager.use_relay(relay)
    socket = FakeSocket()
    await manager.join(1, socket)  # type: ignore[arg-type]

    await manager.broadcast(1, {"eventType": "E"})
    assert relay.published == [(1, {"eventType": "E"})]
    assert socket.sent == []

    await manager.deliver_local(1, {"eventType": "E"})
    assert socket.sent == ['{"eventType": "E"}']


async def test_failed_publish_still_reaches_local_sockets() -> None:
    manager = DraftConnectionManager()
    manager.use_relay(RecordingRelay(fail=True))
    socket = FakeSocket()
    await manager.join(1, socket)  # type: ignore[arg-type]

    await manager.broadcast(1, {"eventType": "E"})

    assert socket.sent == ['{"eventType": "E"}']


async def test_lifespan_wires_the_relay_only_while_running(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api import main

    relay = RecordingRelay()
    relay.start = AsyncMock()  # type: ignore[attr-defined]
    relay.stop = AsyncMock()  # type: ignore[attr-defined]
    settings = get_settings().model_copy(update={"draft_broadcast": "postgres"})
    monkeypatch.setattr("api.main.get_settings", lambda: settings)
    monkeypatch.setattr(main, "PostgresRelay", lambda *_args: relay)
    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main, "run_draft_clock", AsyncMock())
    monkeypatch.setattr(main, "close_db", AsyncMock())
    monkeypatch.setattr(main, "close_rapidapi_client", AsyncMock())
    socket = FakeSocket()
    await draft_manager.join(99, socket)  # type: ignore[arg-type]
    try:
        async with main.lifespan(main.app):
            # One relay for the draft room, one for the feed.
            assert relay.start.await_count == 2  # type: ignore[attr-defined]
            await draft_manager.broadcast(99, {"eventType": "DURING"})
            assert relay.published == [(99, {"eventType": "DURING"})]

        assert relay.stop.await_count == 2  # type: ignore[attr-defined]
        await draft_manager.broadcast(99, {"eventType": "AFTER"})
        assert socket.sent == ['{"eventType": "AFTER"}']
    finally:
        draft_manager.use_relay(None)
        await draft_manager.disconnect(99, socket)  # type: ignore[arg-type]
