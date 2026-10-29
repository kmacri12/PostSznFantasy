import asyncio
import contextlib
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from api.db.models.draft import Draft, DraftPick
from api.db.models.user import User
from api.db.session import get_session_factory
from api.dependencies.auth import verify_token
from api.dependencies.db import DbSession
from api.dependencies.league import DraftMember, LeagueMember, find_membership
from api.models.draft_models import DraftInfoResponse, DraftPickResponse
from api.services.draft_picks import DraftPickError, make_pick
from api.ws.draft_manager import draft_manager

logger = logging.getLogger(__name__)

router = APIRouter()

AUTH_TIMEOUT_SECONDS = 10
INBOUND_EVENTS = {"PING", "SYNC_REQUEST", "MAKE_PICK"}


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.get("/draft-info/{league_id}", response_model=DraftInfoResponse)
async def get_draft_info(
    league_id: int,
    _: LeagueMember,
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
    _: DraftMember,
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
    """Live draft room (ws://localhost:8000/api/drafts/ws/{league_id}).

    The first client message must be `{"eventType": "AUTH", "token": "<jwt>"}`; sending
    the token in a message rather than the URL keeps it out of access logs. Only league
    members are admitted, and only whitelisted events are processed.
    """
    await websocket.accept()
    user = await _authenticate(websocket, league_id)
    if user is None:
        return

    await draft_manager.join(league_id, websocket)
    try:
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
                await _send_error(websocket, "Invalid JSON format")
                continue
            if not isinstance(message, dict):
                await _send_error(websocket, "Invalid message format")
                continue

            event_type = message.get("eventType") or message.get("type")
            if event_type not in INBOUND_EVENTS:
                await _send_error(websocket, "Unsupported event type")
            elif event_type == "PING":
                await draft_manager.send_personal(
                    websocket,
                    {"eventType": "PONG", "timestamp": message.get("timestamp")},
                )
            elif event_type == "SYNC_REQUEST":
                await draft_manager.send_personal(
                    websocket, {"eventType": "SYNC_RESPONSE", "leagueId": league_id}
                )
            elif event_type == "MAKE_PICK":
                await _handle_make_pick(websocket, league_id, user, message)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Error in draft room websocket")
    finally:
        await draft_manager.disconnect(league_id, websocket)
        await draft_manager.broadcast(
            league_id,
            {
                "eventType": "CLIENT_DISCONNECTED",
                "message": "A participant has left the draft room",
                "activeConnections": draft_manager.get_room_size(league_id),
            },
        )


async def _send_error(websocket: WebSocket, message: str) -> None:
    await draft_manager.send_personal(
        websocket, {"eventType": "ERROR", "message": message}
    )


async def _authenticate(websocket: WebSocket, league_id: int) -> User | None:
    """Return the authenticated league member, or close the socket and return None."""
    try:
        raw_text = await asyncio.wait_for(
            websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS
        )
        message = json.loads(raw_text)
        token = message["token"] if message.get("eventType") == "AUTH" else None
        supabase_uid = await asyncio.to_thread(verify_token, token) if token else None
    except (TimeoutError, WebSocketDisconnect):
        await _close_quietly(websocket, "Authentication required")
        return None
    except (HTTPException, ValueError, KeyError, AttributeError, TypeError):
        supabase_uid = None

    if supabase_uid is None:
        await _close_quietly(websocket, "Authentication failed")
        return None

    async with get_session_factory()() as db:
        membership = await find_membership(db, league_id, supabase_uid)
    if membership is None:
        await _close_quietly(websocket, "Not a member of this league")
        return None
    return membership.user


async def _close_quietly(websocket: WebSocket, reason: str) -> None:
    logger.warning("Draft websocket rejected: %s", reason)
    with contextlib.suppress(RuntimeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=reason)


async def _handle_make_pick(
    websocket: WebSocket, league_id: int, user: User, message: dict[str, Any]
) -> None:
    data = message.get("data")
    player_id = data.get("playerId") if isinstance(data, dict) else None
    if not isinstance(player_id, int) or isinstance(player_id, bool):
        await _send_error(websocket, "playerId is required")
        return

    async with get_session_factory()() as db:
        try:
            result = await make_pick(db, league_id, user, player_id)
            await db.commit()
        except DraftPickError as exc:
            await db.rollback()
            await _send_error(websocket, str(exc))
            return

    pick = DraftPickResponse(
        id=result.pick.id,
        draft_id=result.pick.draft_id,
        team_id=result.pick.team_id,
        player_id=result.pick.player_id,
        player_name=result.player_name,
        number_round=result.pick.number_round or 0,
        number_pick_overall=result.pick.number_pick_overall or 0,
        number_pick_in_round=result.pick.number_pick_in_round or 0,
        autopick=False,
    )
    await draft_manager.broadcast(
        league_id,
        {
            "eventType": "PICK_MADE",
            "data": {
                **pick.model_dump(by_alias=True, mode="json"),
                "currentPickIndex": result.next_pick_overall,
            },
        },
    )
    if result.draft_complete:
        await draft_manager.broadcast(league_id, {"eventType": "DRAFT_COMPLETE"})
