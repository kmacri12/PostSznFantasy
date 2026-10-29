from unittest.mock import MagicMock, patch

import jwt
import pytest
from api.dependencies.auth import get_current_user
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


@pytest.fixture
def ec_key_pair() -> tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.mark.asyncio
async def test_get_current_user_local_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """When SUPABASE_URL is empty, decode payload without verification for offline tests."""
    monkeypatch.setenv("SUPABASE_URL", "")
    from api.core.config import get_settings

    get_settings.cache_clear()

    payload = {"sub": "user-supabase-fallback-123"}
    token = jwt.encode(
        payload, "dummy-secret-key-of-at-least-32-chars", algorithm="HS256"
    )

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user_id = await get_current_user(creds)
    assert user_id == "user-supabase-fallback-123"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_current_user_asymmetric_jwks(
    monkeypatch: pytest.MonkeyPatch,
    ec_key_pair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """Verify modern asymmetric token (ES256) via JWKS."""
    private_key, public_key = ec_key_pair

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")

    from api.core.config import get_settings

    get_settings.cache_clear()

    payload = {"sub": "user-supabase-es256", "aud": "authenticated"}
    token = jwt.encode(
        payload,
        private_key,
        algorithm="ES256",
        headers={"kid": "test-kid-1"},
    )

    # Mock PyJWKClient signing key resolution
    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key

    with patch("api.dependencies.auth._get_jwk_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_client.return_value = mock_client

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user_id = await get_current_user(creds)
        assert user_id == "user-supabase-es256"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_current_user_invalid_signature(
    monkeypatch: pytest.MonkeyPatch,
    ec_key_pair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """Verify 401 on signature mismatch."""
    private_key, _ = ec_key_pair
    # Generate a second key pair to simulate wrong public key
    other_key = ec.generate_private_key(ec.SECP256R1()).public_key()

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")

    from api.core.config import get_settings

    get_settings.cache_clear()

    payload = {"sub": "user-supabase-es256", "aud": "authenticated"}
    token = jwt.encode(
        payload,
        private_key,
        algorithm="ES256",
        headers={"kid": "test-kid-1"},
    )

    mock_signing_key = MagicMock()
    mock_signing_key.key = other_key

    with patch("api.dependencies.auth._get_jwk_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_client.return_value = mock_client

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
        assert exc_info.value.status_code == 401

    get_settings.cache_clear()
