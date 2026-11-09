import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError

from api.core.config import get_settings
from api.dependencies.test_auth import stub_user_id

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()

ALLOWED_ALGORITHMS = ("ES256", "RS256")

# Deliberately vague: the specific JWT failure is logged, never returned to the caller.
INVALID_CREDENTIALS_DETAIL = "Invalid or expired credentials"


@lru_cache(maxsize=1)
def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=300)


@dataclass(frozen=True)
class AuthUser:
    sub: str
    email: str | None = None


def verify_claims(token: str) -> AuthUser:
    """Verify a Supabase JWT using modern asymmetric keys (JWKS); return `sub` + email.

    Retrieves public signing keys dynamically from Supabase's JWKS endpoint
    (`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`).

    Raises 401 if the token is malformed, expired, or its signature is invalid.
    """
    if (stub_uid := stub_user_id(token)) is not None:
        return AuthUser(sub=stub_uid)

    settings = get_settings()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        logger.warning("Auth failure: malformed token header: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_DETAIL,
        ) from exc

    # The header is attacker-controlled: only the algorithms Supabase signs with count.
    alg = unverified_header.get("alg")
    if alg not in ALLOWED_ALGORITHMS:
        logger.warning("Auth failure: unexpected token algorithm: %s", alg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_DETAIL,
        )

    try:
        jwks_client = _get_jwk_client(settings.supabase_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=list(ALLOWED_ALGORITHMS),
            audience="authenticated",
            options={"verify_aud": True},
        )

        sub = payload.get("sub")
        if not sub:
            logger.warning("Auth failure: token missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=INVALID_CREDENTIALS_DETAIL,
            )
        email = payload.get("email")
        return AuthUser(
            sub=str(sub),
            email=email.strip().lower() if isinstance(email, str) and email else None,
        )
    except (PyJWTError, PyJWKClientError) as exc:
        logger.warning("Auth failure: invalid or expired token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_DETAIL,
        ) from exc


def verify_token(token: str) -> str:
    """The verified `sub` of a Supabase JWT (see `verify_claims`)."""
    return verify_claims(token).sub


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str:
    """Resolve the Supabase user id (`sub`) from the Bearer token."""
    return verify_token(credentials.credentials)


async def get_token_email(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> str | None:
    """The lowercased email claim of the verified token; the only trusted email source.

    None for stub tokens and for tokens without one."""
    return verify_claims(credentials.credentials).email


# Convenience alias so route signatures read: user_id: CurrentUser
CurrentUser = Annotated[str, Depends(get_current_user)]
TokenEmail = Annotated[str | None, Depends(get_token_email)]


async def require_admin(supabase_uid: CurrentUser) -> str:
    """Allow only users listed in ADMIN_SUPABASE_UIDS (ingestion is paid and global)."""
    if supabase_uid not in get_settings().admin_supabase_uids:
        logger.warning("Admin access denied", extra={"supabase_uid": supabase_uid})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return supabase_uid
