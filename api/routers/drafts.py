import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.ws.draft_manager import draft_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.websocket("/ws/{league_id}")
async def websocket_draft_endpoint(websocket: WebSocket, league_id: int) -> None:
    """Native WebSocket endpoint for live draft rooms.

    Clients connect here (e.g. ws://localhost:8000/api/drafts/ws/{league_id}).
    Handles client messages (such as picks, ping/pong, heartbeats) and
    broadcasts updates to all connected league participants.
    """
    await draft_manager.connect(league_id, websocket)
    try:
        # Send initial confirmation event to connecting client
        await draft_manager.send_personal(
            websocket,
            {
                "eventType": "CONNECTED",
                "leagueId": league_id,
                "message": f"Successfully joined draft room for league {league_id}",
            },
        )

        while True:
            raw_text = await websocket.receive_text()
            try:
                message: dict[str, Any] = json.loads(raw_text)
            except json.JSONDecodeError:
                await draft_manager.send_personal(
                    websocket,
                    {"eventType": "ERROR", "message": "Invalid JSON format"},
                )
                continue

            event_type = message.get("eventType") or message.get("type")

            if event_type == "PING":
                await draft_manager.send_personal(
                    websocket,
                    {"eventType": "PONG", "timestamp": message.get("timestamp")},
                )
            elif event_type == "PICK_MADE":
                # Broadcast the pick to all participants in this draft room
                await draft_manager.broadcast(
                    league_id,
                    {
                        "eventType": "PICK_MADE",
                        "data": message.get("data", {}),
                    },
                )
            elif event_type == "SYNC_REQUEST":
                # Client requesting sync
                await draft_manager.send_personal(
                    websocket,
                    {
                        "eventType": "SYNC_RESPONSE",
                        "leagueId": league_id,
                    },
                )
            else:
                # Default broadcast for other registered room events
                await draft_manager.broadcast(
                    league_id,
                    {
                        "eventType": event_type or "MESSAGE",
                        "data": message.get("data", message),
                    },
                )

    except WebSocketDisconnect:
        await draft_manager.disconnect(league_id, websocket)
        await draft_manager.broadcast(
            league_id,
            {
                "eventType": "CLIENT_DISCONNECTED",
                "message": "A participant has left the draft room",
                "activeConnections": draft_manager.get_room_size(league_id),
            },
        )
    except Exception as e:
        logger.exception("Error in draft room websocket: %s", e)
        await draft_manager.disconnect(league_id, websocket)
