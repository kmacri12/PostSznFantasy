import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from api.db.models.draft import Draft, DraftPick
from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession
from api.models.draft_models import DraftInfoResponse, DraftPickResponse
from api.ws.draft_manager import draft_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.get("/draft-info/{league_id}", response_model=DraftInfoResponse)
async def get_draft_info(
    league_id: int,
    user_id: CurrentUser,
    db: DbSession,
) -> Any:
    """Retrieve draft details and configuration for a league."""
    stmt = select(Draft).where(Draft.league_id == league_id)
    res = await db.execute(stmt)
    draft = res.scalars().first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )
    return draft


@router.get("/draft-picks/{draft_id}", response_model=list[DraftPickResponse])
async def get_draft_picks(
    draft_id: int,
    user_id: CurrentUser,
    db: DbSession,
) -> Any:
    """Retrieve all draft picks made for a draft."""
    stmt = (
        select(DraftPick)
        .where(DraftPick.draft_id == draft_id)
        .order_by(DraftPick.number_pick_overall)
    )
    res = await db.execute(stmt)
    picks = res.scalars().all()
    return picks


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
                logger.warning(
                    "Invalid JSON from draft client", extra={"league_id": league_id}
                )
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
                logger.info("Draft pick broadcast", extra={"league_id": league_id})
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
