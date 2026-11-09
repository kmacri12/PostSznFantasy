import json
import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from api.core.rate_limit import SocketThrottle
from api.db.models.draft import Draft
from api.db.models.user import User
from api.db.session import DbSession, get_session_factory
from api.dependencies.league import (
    DraftMember,
    SeasonCommissioner,
    SeasonMember,
)
from api.models.draft_models import (
    DraftOrderUpdate,
    DraftPickResponse,
    DraftSetup,
    DraftStateResponse,
    PickRequest,
    QueueResponse,
    QueueUpdate,
)
from api.services import draft_flow, push
from api.services.activity import Actor
from api.services.draft_events import announce_events, pick_events, state_event
from api.services.draft_picks import DraftPickError, PickResult, make_pick
from api.services.season_recap import ARCHIVED_MESSAGE, season_is_archived
from api.ws.auth import authenticate_socket, receive_guarded
from api.ws.draft_manager import draft_manager
from api.ws.feed_manager import announce_feed_change

logger = logging.getLogger(__name__)

router = APIRouter()

INBOUND_EVENTS = {"PING", "SYNC_REQUEST", "MAKE_PICK"}


def _conflict(exc: DraftPickError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


async def _draft_for(db: DbSession, season_id: int) -> Draft:
    draft = (
        await db.execute(select(Draft).where(Draft.season_id == season_id))
    ).scalar_one_or_none()
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found"
        )
    return draft


@router.get("/draft-info/{season_id}", response_model=DraftStateResponse)
async def get_draft_info(
    season_id: int, _: SeasonMember, db: DbSession
) -> DraftStateResponse:
    """Full draft state including the server clock (deadline + server time)."""
    return await draft_flow.build_state(db, await _draft_for(db, season_id))


@router.get("/draft-picks/{draft_id}", response_model=list[DraftPickResponse])
async def get_draft_picks(
    draft_id: int, _: DraftMember, db: DbSession
) -> list[DraftPickResponse]:
    draft = (await db.execute(select(Draft).where(Draft.id == draft_id))).scalar_one()
    return (await draft_flow.build_state(db, draft)).picks


async def _broadcast_state(
    db: DbSession, draft: Draft, *, feed_event: bool = False
) -> DraftStateResponse:
    """Commit first so clients refetching on the broadcast see the new state."""
    await db.commit()
    event = await state_event(db, draft)
    await announce_events(draft.season_id, [event])
    if feed_event:
        await announce_feed_change(draft.season_id, "event")
    return DraftStateResponse.model_validate(event["data"])


@router.patch("/{season_id}", response_model=DraftStateResponse)
async def update_setup(
    season_id: int, payload: DraftSetup, _: SeasonCommissioner, db: DbSession
) -> DraftStateResponse:
    """Date/time, time per pick, type and timeout behaviour."""
    try:
        draft = await draft_flow.apply_setup(db, season_id, payload)
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    return await _broadcast_state(db, draft)


@router.put("/{season_id}/order", response_model=DraftStateResponse)
async def update_order(
    season_id: int,
    payload: DraftOrderUpdate,
    membership: SeasonCommissioner,
    db: DbSession,
) -> DraftStateResponse:
    try:
        draft = await draft_flow.set_order(
            db, season_id, payload.team_ids, Actor.of(membership.user)
        )
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    return await _broadcast_state(db, draft, feed_event=True)


@router.post("/{season_id}/order/randomize", response_model=DraftStateResponse)
async def randomize_order(
    season_id: int, membership: SeasonCommissioner, db: DbSession
) -> DraftStateResponse:
    try:
        draft = await draft_flow.randomize_order(
            db, season_id, Actor.of(membership.user)
        )
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    return await _broadcast_state(db, draft, feed_event=True)


CONTROLS = {
    "lobby": draft_flow.open_lobby,
    "pause": draft_flow.pause_draft,
    "resume": draft_flow.resume_draft,
    "undo": draft_flow.undo_last_pick,
}


PHASE_PUSHES: dict[str, Literal["lobby", "started"]] = {
    "lobby": "lobby",
    "start": "started",
}


@router.post("/{season_id}/control/{action}", response_model=DraftStateResponse)
async def control(
    season_id: int, action: str, membership: SeasonCommissioner, db: DbSession
) -> DraftStateResponse:
    """Commissioner controls: lobby, start, pause, resume and undo of the last pick."""
    if action != "start" and action not in CONTROLS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unknown draft action"
        )
    try:
        if action == "start":
            draft = await draft_flow.start_draft(
                db, season_id, Actor.of(membership.user)
            )
        else:
            draft = await CONTROLS[action](db, season_id)
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    response = await _broadcast_state(db, draft, feed_event=action == "start")
    if action in PHASE_PUSHES:
        push.spawn(push.notify_draft_phase, season_id, PHASE_PUSHES[action])
    return response


@router.post("/{season_id}/force-pick", response_model=DraftStateResponse)
async def force_pick(
    season_id: int, _: SeasonCommissioner, db: DbSession
) -> DraftStateResponse:
    """Auto-pick now for whoever is on the clock."""
    try:
        result = await draft_flow.auto_pick(db, season_id)
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    return await _commit_and_announce(db, season_id, result)


async def _commit_and_announce(
    db: DbSession, season_id: int, result: PickResult
) -> DraftStateResponse:
    draft = await _draft_for(db, season_id)
    events = await pick_events(db, draft, result)
    await db.commit()
    await announce_events(season_id, events)
    return DraftStateResponse.model_validate(events[1]["data"])


@router.post("/{season_id}/picks", response_model=DraftPickResponse)
async def submit_pick(
    season_id: int, payload: PickRequest, membership: SeasonMember, db: DbSession
) -> DraftPickResponse:
    """REST twin of the WebSocket MAKE_PICK; replaying the same pick is a no-op."""
    try:
        result = await make_pick(db, season_id, membership.user, payload.player_id)
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    if not result.already_recorded:
        await _commit_and_announce(db, season_id, result)
    pick = result.pick
    return DraftPickResponse(
        id=pick.id,
        draft_id=pick.draft_id,
        team_id=pick.team_id,
        player_id=pick.player_id,
        player_name=result.player_name,
        number_round=pick.number_round,
        number_pick_overall=pick.number_pick_overall,
        number_pick_in_round=pick.number_pick_in_round,
        autopick=pick.autopick,
    )


@router.get("/{season_id}/queue", response_model=QueueResponse)
async def get_queue(
    season_id: int, membership: SeasonMember, db: DbSession
) -> QueueResponse:
    if membership.team is None:
        return QueueResponse(player_ids=[])
    draft = await _draft_for(db, season_id)
    return QueueResponse(
        player_ids=await draft_flow.get_queue(db, draft.id, membership.team.id)
    )


@router.put("/{season_id}/queue", response_model=QueueResponse)
async def put_queue(
    season_id: int, payload: QueueUpdate, membership: SeasonMember, db: DbSession
) -> QueueResponse:
    """Pre-rank players; auto-pick consumes this list in order."""
    if membership.team is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have no team in this league",
        )
    draft = await _draft_for(db, season_id)
    try:
        ids = await draft_flow.set_queue(
            db, draft.id, membership.team.id, payload.player_ids
        )
    except DraftPickError as exc:
        raise _conflict(exc) from exc
    return QueueResponse(player_ids=ids)


async def _snapshot(season_id: int, user: User, team_id: int | None) -> dict[str, Any]:
    async with get_session_factory()() as db:
        draft = await _draft_for_session(db, season_id)
        state = await draft_flow.build_state(db, draft)
        queue = await draft_flow.get_queue(db, draft.id, team_id) if team_id else []
    return {
        "eventType": "SNAPSHOT",
        "data": {
            **state.model_dump(mode="json"),
            "queue": queue,
            "presence": draft_manager.present_user_ids(season_id),
            "myTeamId": team_id,
        },
    }


async def _draft_for_session(db: Any, season_id: int) -> Draft:
    draft = (
        await db.execute(select(Draft).where(Draft.season_id == season_id))
    ).scalar_one()
    return draft  # type: ignore[no-any-return]


@router.websocket("/ws/{season_id}")
async def websocket_draft_endpoint(websocket: WebSocket, season_id: int) -> None:
    """Live draft room (ws://localhost:8000/api/drafts/ws/{season_id}).

    The first client message must be `{"eventType": "AUTH", "token": "<jwt>"}`; sending
    the token in a message rather than the URL keeps it out of access logs. Members
    receive a full SNAPSHOT on connect (so reconnects resync) and then live events.
    """
    await websocket.accept()
    membership = await authenticate_socket(websocket, season_id)
    if membership is None:
        return
    user = membership.user
    team_id = membership.team.id if membership.team else None

    await draft_manager.join(season_id, websocket, user.id)
    try:
        await draft_manager.send_personal(
            websocket, await _snapshot(season_id, user, team_id)
        )
        await draft_manager.broadcast(
            season_id,
            {
                "eventType": "PRESENCE",
                "data": draft_manager.present_user_ids(season_id),
            },
        )

        throttle = SocketThrottle()
        while True:
            raw_text = await receive_guarded(websocket, throttle)
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
                    websocket, await _snapshot(season_id, user, team_id)
                )
            elif event_type == "MAKE_PICK":
                await _handle_make_pick(websocket, season_id, user, message)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Error in draft room websocket")
    finally:
        await draft_manager.disconnect(season_id, websocket)
        await draft_manager.broadcast(
            season_id,
            {
                "eventType": "PRESENCE",
                "data": draft_manager.present_user_ids(season_id),
            },
        )


async def _send_error(
    websocket: WebSocket, message: str, code: str | None = None
) -> None:
    await draft_manager.send_personal(
        websocket, {"eventType": "ERROR", "message": message, "code": code}
    )


async def _handle_make_pick(
    websocket: WebSocket, season_id: int, user: User, message: dict[str, Any]
) -> None:
    data = message.get("data")
    player_id = data.get("playerId") if isinstance(data, dict) else None
    if not isinstance(player_id, int) or isinstance(player_id, bool):
        await _send_error(websocket, "playerId is required")
        return

    async with get_session_factory()() as db:
        try:
            if await season_is_archived(db, season_id):
                raise DraftPickError(ARCHIVED_MESSAGE, code="archived")
            result = await make_pick(db, season_id, user, player_id)
            if result.already_recorded:
                return
            draft = await _draft_for_session(db, season_id)
            events = await pick_events(db, draft, result)
            await db.commit()
        except DraftPickError as exc:
            await db.rollback()
            await _send_error(websocket, str(exc), exc.code)
            return

    await announce_events(season_id, events)
