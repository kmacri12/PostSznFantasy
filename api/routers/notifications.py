from fastapi import APIRouter, Response, status
from sqlalchemy import select

from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.models.notification_models import Inbox, InboxItem, InboxRead
from api.services import notifications

router = APIRouter()


async def _user_id(db: DbSession, supabase_uid: str) -> int | None:
    return await db.scalar(select(User.id).where(User.supabase_uid == supabase_uid))


@router.get("", response_model=Inbox)
async def get_inbox(supabase_uid: CurrentUser, db: DbSession) -> Inbox:
    """The caller's notifications of the last 30 days, newest first."""
    user_id = await _user_id(db, supabase_uid)
    # The bell asks as soon as the app loads, possibly before the first login call
    # has created the user: nothing has been addressed to them yet.
    if user_id is None:
        return Inbox(items=[], unread_count=0)
    rows, unread = await notifications.inbox(db, user_id)
    return Inbox(
        items=[
            InboxItem(
                id=entry.id,
                kind=entry.kind,
                league_id=entry.league_id,
                league_name=league_name,
                payload=entry.payload,
                created_at=entry.created_at,
                read=entry.read_at is not None,
            )
            for entry, league_name in rows
        ],
        unread_count=unread,
    )


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    payload: InboxRead, supabase_uid: CurrentUser, db: DbSession
) -> Response:
    """Mark some of the caller's notifications read, or all of them."""
    user_id = await _user_id(db, supabase_uid)
    if user_id is not None:
        await notifications.mark_read(db, user_id, payload.ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
