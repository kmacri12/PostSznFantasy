"""The e2e auth stub must be impossible to switch on in production.

Three independent guards are exercised: the opt-in flag, startup validation that
refuses a non-test environment, and a runtime re-check in the token path.
"""

from collections.abc import Callable

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from api.core.config import Settings
from api.dependencies.auth import verify_token

STUB_TOKEN = "e2e-user:uid-123"


def make_settings(
    *, environment: str = "development", test_auth_stub: bool = False
) -> Settings:
    return Settings(
        _env_file=None,
        pg_host="localhost",
        supabase_url="https://test.supabase.co",
        environment=environment,
        test_auth_stub=test_auth_stub,
    )


@pytest.fixture
def install_settings(monkeypatch: pytest.MonkeyPatch) -> Callable[[Settings], None]:
    def install(settings: Settings) -> None:
        monkeypatch.setattr("api.dependencies.auth.get_settings", lambda: settings)
        monkeypatch.setattr("api.dependencies.test_auth.get_settings", lambda: settings)

    return install


def test_the_stub_is_off_by_default() -> None:
    assert make_settings().test_auth_stub is False


@pytest.mark.parametrize("environment", ["production", "prod", "staging", "Production"])
def test_startup_refuses_the_stub_outside_a_test_environment(environment: str) -> None:
    with pytest.raises(ValidationError, match="TEST_AUTH_STUB"):
        make_settings(test_auth_stub=True, environment=environment)


@pytest.mark.parametrize("environment", ["development", "test"])
def test_the_stub_can_be_enabled_in_development_and_test(environment: str) -> None:
    assert make_settings(test_auth_stub=True, environment=environment).test_auth_stub


def test_a_stub_token_is_rejected_without_the_opt_in(
    install_settings: Callable[[Settings], None],
) -> None:
    install_settings(make_settings(environment="test"))
    with pytest.raises(HTTPException) as exc:
        verify_token(STUB_TOKEN)
    assert exc.value.status_code == 401


def test_a_stub_token_resolves_to_its_user_when_opted_in(
    install_settings: Callable[[Settings], None],
) -> None:
    install_settings(make_settings(environment="test", test_auth_stub=True))
    assert verify_token(STUB_TOKEN) == "uid-123"


def test_the_token_path_ignores_the_stub_if_settings_were_tampered_with(
    install_settings: Callable[[Settings], None],
) -> None:
    """Even if validation were bypassed, production must never honour a stub token."""
    settings = make_settings(environment="test", test_auth_stub=True)
    object.__setattr__(settings, "environment", "production")
    install_settings(settings)
    with pytest.raises(HTTPException) as exc:
        verify_token(STUB_TOKEN)
    assert exc.value.status_code == 401
