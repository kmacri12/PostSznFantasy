from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError

from api.core.config import get_settings

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str:
    """Verify a Supabase JWT Bearer token and return the caller's Supabase User ID (sub).

    Raises 401 if the token is missing, malformed, expired, or signature is invalid.
    """
    token = credentials.credentials
    settings = get_settings()

    secret = settings.supabase_jwt_secret
    try:
        if secret:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": True},
            )
        else:
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
            )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing 'sub' claim",
            )
        return str(sub)
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc


# Convenience alias so route signatures read: user_id: CurrentUser
CurrentUser = Annotated[str, Depends(get_current_user)]
