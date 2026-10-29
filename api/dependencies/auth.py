import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError

from api.core.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=300)


def verify_token(token: str) -> str:
    """Verify a Supabase JWT using modern asymmetric keys (JWKS) and return its `sub`.

    Retrieves public signing keys dynamically from Supabase's JWKS endpoint
    (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`).

    Raises 401 if the token is malformed, expired, or its signature is invalid.
    """
    settings = get_settings()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        logger.warning("Auth failure: malformed token header: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed token header: {exc}",
        ) from exc

    alg = unverified_header.get("alg", "ES256")

    try:
        jwks_client = _get_jwk_client(settings.supabase_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience="authenticated",
            options={"verify_aud": True},
        )

        sub = payload.get("sub")
        if not sub:
            logger.warning("Auth failure: token missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing 'sub' claim",
            )
        return str(sub)
    except (PyJWTError, PyJWKClientError) as exc:
        logger.warning("Auth failure: invalid or expired token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str:
    """Resolve the Supabase user id (`sub`) from the Bearer token."""
    return verify_token(credentials.credentials)


# Convenience alias so route signatures read: user_id: CurrentUser
CurrentUser = Annotated[str, Depends(get_current_user)]


async def require_admin(supabase_uid: CurrentUser) -> str:
    """Allow only users listed in ADMIN_SUPABASE_UIDS (ingestion is paid and global)."""
    if supabase_uid not in get_settings().admin_supabase_uids:
        logger.warning("Admin access denied", extra={"supabase_uid": supabase_uid})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return supabase_uid
