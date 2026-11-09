import asyncio
import contextlib
import json
import logging

from fastapi import HTTPException, WebSocket, WebSocketDisconnect, status

from api.core.rate_limit import SocketThrottle
from api.db.session import get_session_factory
from api.dependencies.auth import verify_token
from api.dependencies.league import SeasonMembership, find_season_membership

logger = logging.getLogger(__name__)

AUTH_TIMEOUT_SECONDS = 10
MAX_SOCKET_MESSAGE_CHARS = 4096


async def receive_guarded(websocket: WebSocket, throttle: SocketThrottle) -> str:
    """The next text message, or close the socket with 1008 (and raise
    WebSocketDisconnect) when the client floods or sends an oversize one."""
    raw_text = await websocket.receive_text()
    if len(raw_text) > MAX_SOCKET_MESSAGE_CHARS or not throttle.allow():
        await close_quietly(websocket, "Too many or too large messages")
        raise WebSocketDisconnect(status.WS_1008_POLICY_VIOLATION)
    return raw_text


async def authenticate_socket(
    websocket: WebSocket, season_id: int
) -> SeasonMembership | None:
    """The member behind the first message `{"eventType": "AUTH", "token": "<jwt>"}`
    (kept out of the URL so it stays out of access logs), or close the socket and
    return None."""
    try:
        raw_text = await asyncio.wait_for(
            websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS
        )
        message = json.loads(raw_text)
        token = message["token"] if message.get("eventType") == "AUTH" else None
        supabase_uid = await asyncio.to_thread(verify_token, token) if token else None
    except (TimeoutError, WebSocketDisconnect):
        await close_quietly(websocket, "Authentication required")
        return None
    except (HTTPException, ValueError, KeyError, AttributeError, TypeError):
        supabase_uid = None

    if supabase_uid is None:
        await close_quietly(websocket, "Authentication failed")
        return None

    async with get_session_factory()() as db:
        try:
            membership = await find_season_membership(db, season_id, supabase_uid)
        except HTTPException:  # the league was deleted
            membership = None
    if membership is None:
        await close_quietly(websocket, "Not a member of this league")
        return None
    return membership


async def close_quietly(websocket: WebSocket, reason: str) -> None:
    logger.warning("Websocket rejected: %s", reason)
    with contextlib.suppress(RuntimeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=reason)
