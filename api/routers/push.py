from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from api.core.config import get_settings
from api.db.models.push import PushSubscription
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.models.push_models import (
    ChatMuteUpdate,
    PushPreferences,
    PushPreferencesUpdate,
    PushSubscriptionCreate,
    PushSubscriptionDelete,
    VapidKeyResponse,
)
from api.services import push

router = APIRouter()

USER_AGENT_MAX = 255


async def _user_id(db: DbSession, supabase_uid: str) -> int:
    user_id = await db.scalar(select(User.id).where(User.supabase_uid == supabase_uid))
    if user_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user_id


@router.get("/vapid-key", response_model=VapidKeyResponse)
async def vapid_key() -> VapidKeyResponse:
    """The public key `pushManager.subscribe` needs; public, so no sign-in."""
    return VapidKeyResponse(public_key=get_settings().vapid_public_key or None)


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    payload: PushSubscriptionCreate,
    request: Request,
    supabase_uid: CurrentUser,
    db: DbSession,
) -> Response:
    """Store this device's subscription. Repeating it, or signing in as someone else
    on the same device, moves the one row for the endpoint to the caller."""
    if not get_settings().push_enabled:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Push notifications are not set up"
        )
    user_id = await _user_id(db, supabase_uid)
    agent = (request.headers.get("user-agent") or "")[:USER_AGENT_MAX] or None
    insert_stmt = insert(PushSubscription).values(
        user_id=user_id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        user_agent=agent,
    )
    await db.execute(
        insert_stmt.on_conflict_do_update(
            index_elements=[PushSubscription.endpoint],
            set_={
                "user_id": user_id,
                "p256dh": payload.keys.p256dh,
                "auth": payload.keys.auth,
                "user_agent": agent,
                "last_seen": insert_stmt.excluded.last_seen,
            },
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    payload: PushSubscriptionDelete, supabase_uid: CurrentUser, db: DbSession
) -> Response:
    """Forget one of the caller's own devices; an unknown endpoint is not an error."""
    user_id = await _user_id(db, supabase_uid)
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == payload.endpoint,
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _preferences(db: DbSession, user: User) -> PushPreferences:
    return PushPreferences(
        draft_alerts=user.push_draft_alerts,
        lineup_reminders=user.push_lineup_reminders,
        chat=user.push_chat,
        muted_league_ids=await push.muted_league_ids(db, user.id),
    )


async def _user(db: DbSession, supabase_uid: str) -> User:
    user = await db.scalar(select(User).where(User.supabase_uid == supabase_uid))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("/preferences", response_model=PushPreferences)
async def get_preferences(supabase_uid: CurrentUser, db: DbSession) -> PushPreferences:
    return await _preferences(db, await _user(db, supabase_uid))


@router.patch("/preferences", response_model=PushPreferences)
async def update_preferences(
    payload: PushPreferencesUpdate, supabase_uid: CurrentUser, db: DbSession
) -> PushPreferences:
    """Choose which pushes to get; fields left out stay as they are."""
    user = await _user(db, supabase_uid)
    if payload.draft_alerts is not None:
        user.push_draft_alerts = payload.draft_alerts
    if payload.lineup_reminders is not None:
        user.push_lineup_reminders = payload.lineup_reminders
    if payload.chat is not None:
        user.push_chat = payload.chat
    await db.flush()
    return await _preferences(db, user)


@router.put("/chat-mute/{league_id}", status_code=status.HTTP_204_NO_CONTENT)
async def mute_league_chat(
    league_id: int,
    payload: ChatMuteUpdate,
    supabase_uid: CurrentUser,
    db: DbSession,
) -> Response:
    """Mute or unmute chat pushes from one of the caller's leagues."""
    user = await _user(db, supabase_uid)
    if not await push.set_chat_muted(db, user.id, league_id, payload.muted):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "League not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
