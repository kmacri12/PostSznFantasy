from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import Field
from sqlalchemy import Boolean, literal_column
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from api.core.rate_limit import LoginLimit
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.models.auth_models import LoginResponse
from api.models.base import BaseSchema
from api.services.avatars import avatar_url

router = APIRouter()


class LoginPayload(BaseSchema):
    email: str | None = Field(default=None, max_length=120)
    username: str | None = Field(default=None, max_length=20)


@router.post("/login", response_model=LoginResponse)
async def login_or_register(
    payload: LoginPayload,
    current_user_id: CurrentUser,
    db: DbSession,
    _: LoginLimit,
) -> LoginResponse:
    """Verify Supabase auth bearer token and upsert the relational User row.

    A single INSERT ... ON CONFLICT keeps concurrent first logins from racing.
    """
    insert_stmt = insert(User).values(
        supabase_uid=current_user_id,
        email=payload.email,
        username=payload.username or f"user_{current_user_id[:8]}",
    )
    # Only fields the client actually sent overwrite stored values.
    updates: dict[str, Any] = payload.model_dump(exclude_none=True) or {
        "supabase_uid": insert_stmt.excluded.supabase_uid
    }
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[User.supabase_uid], set_=updates
    ).returning(
        User.id, User.avatar_key, literal_column("(xmax = 0)", Boolean).label("created")
    )

    try:
        user_id, avatar_key, created = (await db.execute(upsert_stmt)).one()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email is already registered to another account",
        ) from exc

    return LoginResponse(
        message="User created successfully" if created else "Login successful",
        user_id=user_id,
        avatar_url=avatar_url(avatar_key),
    )
