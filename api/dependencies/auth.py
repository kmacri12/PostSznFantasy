from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError

from api.core.config import get_settings

_bearer = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=300)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str:
    """Verify a Supabase JWT Bearer token using modern asymmetric keys (JWKS).

    Retrieves public signing keys dynamically from Supabase's JWKS endpoint
    (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`).
    Falls back to unverified decode only if SUPABASE_URL is unset (for local testing/dev).

    Raises 401 if the token is missing, malformed, expired, or signature is invalid.
    """
    token = credentials.credentials
    settings = get_settings()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed token header: {exc}",
        ) from exc

    alg = unverified_header.get("alg", "ES256")

    try:
        if settings.supabase_jwks_url:
            jwks_client = _get_jwk_client(settings.supabase_jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
                options={"verify_aud": True},
            )
        else:
            # Fallback for offline local dev/tests without SUPABASE_URL configured
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
    except (PyJWTError, PyJWKClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc


# Convenience alias so route signatures read: user_id: CurrentUser
CurrentUser = Annotated[str, Depends(get_current_user)]
