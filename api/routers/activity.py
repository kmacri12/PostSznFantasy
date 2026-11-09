import json
import logging
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from api.core.rate_limit import ChatLimit, SocketThrottle
from api.db.session import DbSession
from api.dependencies.league import SeasonMember, TeamMember
from api.models.activity_models import ActivityFeed, ActivityViewed
from api.models.feed_models import Feed, FeedMessageItem, FeedViewed, MessageCreate
from api.services import activity, feed, push
from api.services.season_recap import ARCHIVED_MESSAGE
from api.ws.auth import authenticate_socket, receive_guarded
from api.ws.feed_manager import announce_feed_change, feed_manager

logger = logging.getLogger(__name__)

router = APIRouter()

PageSize = Annotated[int, Query(ge=1, le=activity.MAX_PAGE_SIZE)]
Before = Annotated[int | None, Query(description="Return events older than this id")]
FeedBefore = Annotated[
    str | None, Query(description="`nextBefore` of the previous page")
]


@router.get("/seasons/{season_id}/activity", response_model=ActivityFeed)
async def league_feed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    limit: PageSize = activity.DEFAULT_PAGE_SIZE,
    before: Before = None,
) -> ActivityFeed:
    """Everything that happened in the season, newest first; members only."""
    return await activity.feed(
        db, membership.user.id, season_id, limit=limit, before=before
    )


@router.get("/teams/{team_id}/activity", response_model=ActivityFeed)
async def team_feed(
    team_id: int,
    membership: TeamMember,
    db: DbSession,
    limit: PageSize = activity.DEFAULT_PAGE_SIZE,
    before: Before = None,
) -> ActivityFeed:
    """What happened to one fantasy team, newest first; league members only."""
    return await activity.feed(
        db,
        membership.user.id,
        membership.season.id,
        team_id=team_id,
        limit=limit,
        before=before,
    )


@router.post(
    "/seasons/{season_id}/activity/viewed", status_code=status.HTTP_204_NO_CONTENT
)
async def league_feed_viewed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    body: ActivityViewed | None = None,
) -> Response:
    """The member expanded the season feed: clear its new-activity dot."""
    await activity.mark_viewed(
        db,
        membership.user.id,
        season_id,
        up_to=body.up_to_event_id if body else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/teams/{team_id}/activity/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def team_feed_viewed(
    team_id: int,
    membership: TeamMember,
    db: DbSession,
    body: ActivityViewed | None = None,
) -> Response:
    """The member expanded a team's feed: clear its new-activity dot."""
    await activity.mark_viewed(
        db,
        membership.user.id,
        membership.season.id,
        team_id=team_id,
        up_to=body.up_to_event_id if body else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/seasons/{season_id}/feed", response_model=Feed)
async def season_feed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    limit: PageSize = activity.DEFAULT_PAGE_SIZE,
    before: FeedBefore = None,
) -> Feed:
    """Events and chat messages merged, newest first, lineup moves left out."""
    try:
        return await feed.feed(db, membership, limit=limit, before=before)
    except feed.FeedError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc


@router.post(
    "/seasons/{season_id}/messages",
    response_model=FeedMessageItem,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    season_id: int,
    payload: MessageCreate,
    membership: SeasonMember,
    db: DbSession,
    _: ChatLimit,
) -> FeedMessageItem:
    """Chat in the league's current season; former members and archives get 403/409."""
    try:
        message = await feed.post_message(db, membership, payload.body, payload.gif_url)
    except feed.FeedError as exc:
        status_code = (
            status.HTTP_409_CONFLICT
            if str(exc) == ARCHIVED_MESSAGE
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        raise HTTPException(status_code, str(exc)) from exc
    await db.commit()
    await announce_feed_change(season_id, "message", message.id)
    push.spawn(push.notify_league_message, message.id)
    return FeedMessageItem(
        id=message.id,
        created_at=message.created_at,
        author_user_id=message.author_user_id,
        author_name=message.author_name,
        body=message.body,
        gif_url=message.gif_url,
        can_delete=True,
        is_new=False,
    )


@router.delete(
    "/seasons/{season_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_message(
    season_id: int, message_id: int, membership: SeasonMember, db: DbSession
) -> Response:
    """The author or any commissioner removes a message; deleting twice is harmless."""
    try:
        deleted = await feed.delete_message(db, membership, message_id)
    except feed.MessageNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found") from exc
    except feed.NotYourMessage as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the author or a commissioner can delete a message",
        ) from exc
    await db.commit()
    if deleted:
        await announce_feed_change(season_id, "message", message_id, deleted=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/seasons/{season_id}/feed/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def feed_viewed(
    season_id: int,
    membership: SeasonMember,
    db: DbSession,
    body: FeedViewed | None = None,
) -> Response:
    """The member opened the Feed: clear its dot (events and messages together)."""
    await activity.mark_viewed(
        db,
        membership.user.id,
        season_id,
        up_to=body.up_to_event_id if body else None,
        up_to_message=body.up_to_message_id if body else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.websocket("/seasons/{season_id}/feed/ws")
async def feed_socket(websocket: WebSocket, season_id: int) -> None:
    """Live nudges for the Feed (ws://localhost:8000/api/seasons/{season_id}/feed/ws).

    Authenticates like the draft room (first message `{"eventType": "AUTH", "token"}`).
    Members then receive `{"eventType": "FEED_CHANGED", "data": {itemType, id,
    deleted}}` when chat or a draft event lands; the client refetches the newest page
    of `GET /seasons/{id}/feed`. Other events written elsewhere (overrides, settings
    changes...) show up on the next fetch.
    """
    await websocket.accept()
    membership = await authenticate_socket(websocket, season_id)
    if membership is None:
        return
    await feed_manager.join(season_id, websocket, membership.user.id)
    throttle = SocketThrottle()
    try:
        while True:
            try:
                message: Any = json.loads(await receive_guarded(websocket, throttle))
            except json.JSONDecodeError:
                message = None
            event_type = message.get("eventType") if isinstance(message, dict) else None
            if event_type == "PING":
                await feed_manager.send_personal(
                    websocket,
                    {"eventType": "PONG", "timestamp": message.get("timestamp")},
                )
            else:
                await feed_manager.send_personal(
                    websocket,
                    {"eventType": "ERROR", "message": "Unsupported event type"},
                )
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Error in feed websocket")
    finally:
        await feed_manager.disconnect(season_id, websocket)
