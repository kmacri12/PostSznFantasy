import asyncio
from typing import Any
from uuid import uuid4

from api.tests.postgres.conftest import TEST_DATABASE_URL
from api.ws.broadcast_relay import PostgresRelay
from api.ws.draft_manager import DraftConnectionManager


class FakeSocket:
    def __init__(self) -> None:
        self.received: asyncio.Queue[str] = asyncio.Queue()

    async def send_text(self, payload: str) -> None:
        await self.received.put(payload)


async def _instance(channel: str) -> tuple[DraftConnectionManager, PostgresRelay]:
    """One API process: its own manager, wired to a relay on the shared channel."""
    manager = DraftConnectionManager()
    relay = PostgresRelay(TEST_DATABASE_URL, manager.deliver_local, channel=channel)
    await relay.start()
    manager.use_relay(relay)
    return manager, relay


async def test_a_broadcast_on_one_instance_reaches_sockets_on_another() -> None:
    channel = f"test_{uuid4().hex[:8]}"
    a, relay_a = await _instance(channel)
    b, relay_b = await _instance(channel)
    try:
        on_a, on_b, other_league = FakeSocket(), FakeSocket(), FakeSocket()
        await a.join(1, on_a)  # type: ignore[arg-type]
        await b.join(1, on_b)  # type: ignore[arg-type]
        await b.join(2, other_league)  # type: ignore[arg-type]

        await a.broadcast(1, {"eventType": "PICK_MADE", "data": {"id": 9}})

        for socket in (on_a, on_b):
            payload = await asyncio.wait_for(socket.received.get(), 5)
            assert payload == '{"eventType": "PICK_MADE", "data": {"id": 9}}'
        assert other_league.received.empty()
    finally:
        await relay_a.stop()
        await relay_b.stop()


async def test_large_state_event_and_order_survive_the_hop() -> None:
    channel = f"test_{uuid4().hex[:8]}"
    a, relay_a = await _instance(channel)
    b, relay_b = await _instance(channel)
    try:
        socket = FakeSocket()
        await b.join(1, socket)  # type: ignore[arg-type]
        big: dict[str, Any] = {"eventType": "DRAFT_STATE", "data": "z" * 40_000}

        await a.broadcast(1, {"eventType": "FIRST"})
        await a.broadcast(1, big)
        await a.broadcast(1, {"eventType": "LAST"})

        received = [await asyncio.wait_for(socket.received.get(), 5) for _ in range(3)]
        assert received[0] == '{"eventType": "FIRST"}'
        assert received[1].count("z") == 40_000
        assert received[2] == '{"eventType": "LAST"}'
    finally:
        await relay_a.stop()
        await relay_b.stop()
