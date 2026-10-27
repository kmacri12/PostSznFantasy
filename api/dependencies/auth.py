from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

from api.utils.security.firebase import get_firebase_app

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str:
    """Verify a Firebase Bearer token and return the caller's Firebase UID.

    Raises 401 if the token is missing, malformed, expired, or revoked.
    The returned UID is the stable Firebase identity string, not an internal DB id.
    """
    get_firebase_app()
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
    return str(decoded["uid"])


# Convenience alias so route signatures read: user_id: CurrentUser
CurrentUser = Annotated[str, Depends(get_current_user)]
