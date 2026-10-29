import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class DraftConnectionManager:
    """Thread-safe and async-safe connection manager for live draft rooms.

    Manages active WebSockets grouped by league_id, allowing broadcast
    of draft picks, clock ticks, state synchronizations, and error notifications.
    """

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self._users: dict[WebSocket, int] = {}
        self._lock = asyncio.Lock()

    async def join(
        self, league_id: int, websocket: WebSocket, user_id: int | None = None
    ) -> None:
        """Register an already-accepted, authenticated socket in the league room."""
        async with self._lock:
            self._rooms[league_id].add(websocket)
            if user_id is not None:
                self._users[websocket] = user_id
        logger.info(
            "WebSocket connected to league %s. Total connections: %s",
            league_id,
            len(self._rooms[league_id]),
        )

    async def disconnect(self, league_id: int, websocket: WebSocket) -> None:
        """Unregister a WebSocket from the league room."""
        async with self._lock:
            self._users.pop(websocket, None)
            if league_id in self._rooms:
                self._rooms[league_id].discard(websocket)
                if not self._rooms[league_id]:
                    del self._rooms[league_id]
        logger.info("WebSocket disconnected from league %s", league_id)

    async def broadcast(self, league_id: int, message: dict[str, Any]) -> None:
        """Broadcast a JSON message to all active clients in the specified league room.

        Automatically cleans up any broken or abruptly disconnected sockets.
        """
        async with self._lock:
            sockets = list(self._rooms.get(league_id, []))

        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        payload = json.dumps(message)

        for socket in sockets:
            try:
                await socket.send_text(payload)
            except Exception as e:
                logger.warning(
                    "Failed to send to client in league %s: %s", league_id, e
                )
                dead_sockets.append(socket)

        if dead_sockets:
            async with self._lock:
                if league_id in self._rooms:
                    for dead in dead_sockets:
                        self._rooms[league_id].discard(dead)
                    if not self._rooms[league_id]:
                        del self._rooms[league_id]

    async def send_personal(
        self, websocket: WebSocket, message: dict[str, Any]
    ) -> None:
        """Send a direct JSON message to a single connected client."""
        await websocket.send_text(json.dumps(message))

    def present_user_ids(self, league_id: int) -> list[int]:
        """Distinct users with at least one open socket in the room."""
        return sorted(
            {self._users[s] for s in self._rooms.get(league_id, ()) if s in self._users}
        )

    def get_room_size(self, league_id: int) -> int:
        """Return the count of active connections for a given league room."""
        return len(self._rooms.get(league_id, []))


# Global singleton instance for draft room connections
draft_manager = DraftConnectionManager()
