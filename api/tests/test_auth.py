from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt.exceptions import PyJWKClientError
from pydantic import ValidationError

from api.core.config import Settings
from api.dependencies.auth import get_current_user


@pytest.fixture
def ec_key_pair() -> tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


def test_settings_reject_missing_supabase_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """Without SUPABASE_URL tokens cannot be verified, so startup must fail."""
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.delenv("SUPABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.asyncio
async def test_get_current_user_rejects_unsigned_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A forged HS256 token must not be accepted even though it decodes cleanly."""
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    from api.core.config import get_settings

    get_settings.cache_clear()
    forged = jwt.encode(
        {"sub": "victim", "aud": "authenticated"},
        "dummy-secret-key-of-at-least-32-chars",
        algorithm="HS256",
    )

    with patch("api.dependencies.auth._get_jwk_client") as mock_get_client:
        mock_get_client.return_value.get_signing_key_from_jwt.side_effect = (
            PyJWKClientError("no matching key")
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
    assert exc_info.value.status_code == 401
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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token", ["not-a-jwt", "a.b.c"], ids=["malformed", "garbage-segments"]
)
async def test_auth_errors_do_not_leak_exception_details(
    monkeypatch: pytest.MonkeyPatch, token: str
) -> None:
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    from api.core.config import get_settings

    get_settings.cache_clear()
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(creds)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or expired credentials"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_invalid_signature_detail_is_generic(
    monkeypatch: pytest.MonkeyPatch,
    ec_key_pair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, _ = ec_key_pair
    other_key = ec.generate_private_key(ec.SECP256R1()).public_key()
    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    from api.core.config import get_settings

    get_settings.cache_clear()
    token = jwt.encode(
        {"sub": "u", "aud": "authenticated"},
        private_key,
        algorithm="ES256",
        headers={"kid": "k"},
    )

    with patch("api.dependencies.auth._get_jwk_client") as mock_get_client:
        mock_get_client.return_value.get_signing_key_from_jwt.return_value = MagicMock(
            key=other_key
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)

    assert exc_info.value.detail == "Invalid or expired credentials"
    assert "ignature" not in str(exc_info.value.detail)
    get_settings.cache_clear()


def test_settings_parse_csv_lists_and_env_file_is_cwd_independent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.core.config import ENV_FILE

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["https://a.example", "https://b.example"]
    assert ENV_FILE.is_absolute()
    assert ENV_FILE.name == ".env"
    assert ENV_FILE.parent.name == "api"
