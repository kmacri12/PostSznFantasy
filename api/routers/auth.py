from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from api.db.models.user import User
from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession
from api.models.auth_models import LoginResponse

router = APIRouter()


class LoginPayload(BaseModel):
    email: str | None = None
    username: str | None = None


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.post("/login", response_model=LoginResponse)
async def login_or_register(
    payload: LoginPayload,
    firebase_uid: CurrentUser,
    db: DbSession,
) -> LoginResponse:
    """Verify Firebase auth bearer token and upsert the relational User row."""
    stmt = select(User).where(User.firebase_uid == firebase_uid)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        email = payload.email or f"{firebase_uid}@postszn.local"
        username = payload.username or f"user_{firebase_uid[:8]}"
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            username=username,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = user.id or 1
        return LoginResponse(message="User created successfully", user_id=user_id)

    # Update email/username if provided and changed
    if payload.email and user.email != payload.email:
        user.email = payload.email
    if payload.username and user.username != payload.username:
        user.username = payload.username

    await db.commit()
    await db.refresh(user)
    return LoginResponse(message="Login successful", user_id=user.id)
