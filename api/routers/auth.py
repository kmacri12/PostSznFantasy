import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import Field
from sqlalchemy import Boolean, literal_column, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from api.core.rate_limit import LoginLimit
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser, TokenEmail
from api.models.auth_models import LoginResponse
from api.models.base import BaseSchema
from api.services import account_deletion
from api.services.avatars import avatar_url

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginPayload(BaseSchema):
    username: str | None = Field(default=None, max_length=20)


@router.post("/login", response_model=LoginResponse)
async def login_or_register(
    payload: LoginPayload,
    current_user_id: CurrentUser,
    token_email: TokenEmail,
    db: DbSession,
    _: LoginLimit,
) -> LoginResponse:
    """Verify Supabase auth bearer token and upsert the relational User row.

    A single INSERT ... ON CONFLICT keeps concurrent first logins from racing. The
    email comes only from the verified token; if another account already holds it
    (the same address on two Supabase identities) this one keeps no email.
    """
    try:
        # A savepoint, so a unique-email conflict leaves the session usable.
        async with db.begin_nested():
            row = await _upsert(db, current_user_id, token_email, payload.username)
    except IntegrityError:
        logger.warning(
            "Login email already held by another account; signing in without it",
            extra={"supabase_uid": current_user_id},
        )
        row = await _upsert(db, current_user_id, None, payload.username)
    user_id, avatar_key, created = row

    return LoginResponse(
        message="User created successfully" if created else "Login successful",
        user_id=user_id,
        avatar_url=avatar_url(avatar_key),
    )


async def _upsert(
    db: DbSession, supabase_uid: str, email: str | None, username: str | None
) -> Any:
    email = email.lower() if email else None
    insert_stmt = insert(User).values(
        supabase_uid=supabase_uid,
        email=email,
        username=username or f"user_{supabase_uid[:8]}",
    )
    # Only values actually supplied overwrite stored ones.
    updates: dict[str, Any] = {
        key: value
        for key, value in (("email", email), ("username", username))
        if value is not None
    } or {"supabase_uid": insert_stmt.excluded.supabase_uid}
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[User.supabase_uid], set_=updates
    ).returning(
        User.id, User.avatar_key, literal_column("(xmax = 0)", Boolean).label("created")
    )
    return (await db.execute(upsert_stmt)).one()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(current_user_id: CurrentUser, db: DbSession) -> Response:
    """Delete the caller's account (#330): sign-in identity, push subscriptions and
    picture go, the name and email are wiped, and the leagues keep "Former member"."""
    user = await db.scalar(select(User).where(User.supabase_uid == current_user_id))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        await account_deletion.delete_account(db, user)
    except account_deletion.AccountDeletionError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
