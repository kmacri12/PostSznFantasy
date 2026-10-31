from typing import Any

from api.ws.draft_manager import DraftConnectionManager


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
