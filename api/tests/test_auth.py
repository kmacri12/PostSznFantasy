import jwt
import pytest
from api.dependencies.auth import get_current_user
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


@pytest.mark.asyncio
async def test_get_current_user_valid_token(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "super-secret-test-jwt-secret-key-12345"
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)

    from api.core.config import get_settings

    get_settings.cache_clear()

    payload = {"sub": "user-supabase-123", "aud": "authenticated"}
    token = jwt.encode(payload, secret, algorithm="HS256")

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user_id = await get_current_user(creds)
    assert user_id == "user-supabase-123"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "super-secret-test-jwt-secret-key-12345"
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)

    from api.core.config import get_settings

    get_settings.cache_clear()

    token = jwt.encode(
        {"sub": "user-supabase-123"},
        "wrong-secret-key-with-at-least-32-bytes-length",
        algorithm="HS256",
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(creds)
    assert exc_info.value.status_code == 401
    get_settings.cache_clear()
