import asyncio
import contextlib
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

import asyncpg

logger = logging.getLogger(__name__)

# NOTIFY payloads are capped at 8000 bytes. A chunk is JSON-escaped a second time when
# wrapped in its envelope, so this leaves room for the worst case (2x) plus the envelope.
MAX_NOTIFY_CHUNK = 3000
RECONNECT_SECONDS = 2

Deliver = Callable[[int, dict[str, Any]], Awaitable[None]]


def encode_chunks(league_id: int, message: dict[str, Any]) -> list[str]:
    text = json.dumps(message)
    parts = [
        text[start : start + MAX_NOTIFY_CHUNK]
        for start in range(0, len(text), MAX_NOTIFY_CHUNK)
    ]
    message_id = uuid4().hex
    # One-letter keys: the envelope counts against the 8000-byte NOTIFY budget.
    return [
        json.dumps(
            {"m": message_id, "i": i, "n": len(parts), "l": league_id, "p": part}
        )
        for i, part in enumerate(parts)
    ]


class Reassembler:
    """Joins the chunks of messages that were too big for one NOTIFY."""

    def __init__(self) -> None:
        self._partial: dict[str, list[str]] = {}

    def feed(self, payload: str) -> tuple[int, dict[str, Any]] | None:
        chunk = json.loads(payload)
        parts = self._partial.setdefault(chunk["m"], [""] * chunk["n"])
        parts[chunk["i"]] = chunk["p"]
        if chunk["i"] != chunk["n"] - 1:
            return None
        del self._partial[chunk["m"]]
        return chunk["l"], json.loads("".join(parts))


class PostgresRelay:
    """Fans draft broadcasts out to every API instance through LISTEN/NOTIFY.

    `publish` NOTIFYs the channel; every instance, the publisher included, hands what it
    hears to `deliver`, which writes to that instance's own sockets. One dedicated
    connection both listens and publishes, so it must not go through a transaction-mode
    pooler.
    """

    def __init__(self, dsn: str, deliver: Deliver, channel: str = "draft_events"):
        self._dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
        self._deliver = deliver
        self._channel = channel
        self._connection: asyncpg.Connection | None = None
        self._publish_lock = asyncio.Lock()
        self._received: asyncio.Queue[str] = asyncio.Queue()
        self._reassembler = Reassembler()
        self._tasks: list[asyncio.Task[None]] = []
        self._lost = asyncio.Event()

    async def start(self) -> None:
        await self._connect()
        self._tasks = [
            asyncio.create_task(self._reconnect_when_lost()),
            asyncio.create_task(self._deliver_received()),
        ]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks = []
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

    async def publish(self, league_id: int, message: dict[str, Any]) -> None:
        """Raises when the connection is gone, so the caller can fall back to local."""
        chunks = encode_chunks(league_id, message)
        async with self._publish_lock:
            if self._connection is None or self._connection.is_closed():
                raise ConnectionError("broadcast relay is not connected")
            async with self._connection.transaction():
                for chunk in chunks:
                    await self._connection.execute(
                        "SELECT pg_notify($1, $2)", self._channel, chunk
                    )

    async def _connect(self) -> None:
        # Cleared before connecting so a drop right after connecting is not lost.
        self._lost.clear()
        connection = await asyncpg.connect(self._dsn)
        await connection.add_listener(
            self._channel,
            lambda _conn, _pid, _channel, payload: self._received.put_nowait(payload),
        )
        connection.add_termination_listener(lambda _conn: self._lost.set())
        self._connection = connection

    async def _reconnect_when_lost(self) -> None:
        while True:
            await self._lost.wait()
            self._connection = None
            logger.warning("Broadcast relay connection lost; reconnecting")
            while self._connection is None:
                try:
                    await self._connect()
                    logger.info("Broadcast relay reconnected")
                except Exception:
                    logger.warning("Broadcast relay reconnect failed", exc_info=True)
                    await asyncio.sleep(RECONNECT_SECONDS)

    async def _deliver_received(self) -> None:
        while True:
            payload = await self._received.get()
            try:
                delivered = self._reassembler.feed(payload)
                if delivered is not None:
                    await self._deliver(*delivered)
            except Exception:
                logger.exception("Dropped an undeliverable broadcast")
