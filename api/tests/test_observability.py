"""Sentry must be inert without a DSN and must never forward secrets or PII."""

from typing import Any

import pytest
import sentry_sdk

from api.core import observability
from api.core.config import Settings


def make_settings(**overrides: Any) -> Settings:
    return Settings(
        _env_file=None,
        pg_host="localhost",
        supabase_url="https://test.supabase.co",
        **overrides,
    )


def test_sentry_settings_default_to_off() -> None:
    settings = make_settings()

    assert settings.sentry_dsn == ""
    assert settings.sentry_release == ""


def test_init_is_a_no_op_without_a_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: calls.append(kw))

    assert observability.init_sentry(make_settings()) is False
    assert calls == []


def test_capture_without_init_sends_nothing() -> None:
    assert sentry_sdk.get_client().is_active() is False
    assert sentry_sdk.capture_exception(ValueError("boom")) is None


def test_init_with_a_dsn_sets_environment_release_and_no_pii(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: calls.append(kw))
    settings = make_settings(
        sentry_dsn="https://key@o1.ingest.sentry.io/1",
        environment="production",
        sentry_release="abc123",
    )

    assert observability.init_sentry(settings) is True
    (kwargs,) = calls
    assert kwargs["dsn"] == "https://key@o1.ingest.sentry.io/1"
    assert kwargs["environment"] == "production"
    assert kwargs["release"] == "abc123"
    assert kwargs["send_default_pii"] is False
    assert kwargs["before_send"] is observability.scrub_event


def test_scrub_event_removes_secrets_and_pii() -> None:
    event: dict[str, Any] = {
        "user": {"id": "1", "email": "a@b.com", "ip_address": "1.2.3.4"},
        "message": "failed for kyle@example.com",
        "transaction": "/api/invites/SECRET/join",
        "exception": {"values": [{"value": "bad eyJhbGciOi.eyJzdWIiOi.sig here"}]},
        "request": {
            "url": "https://api.example.com/api/invites/SECRET/join?x=1",
            "query_string": "x=1",
            "cookies": {"sb": "1"},
            "data": {"password": "x"},
            "headers": {
                "Authorization": "Bearer abc",
                "Cookie": "sb=1",
                "Accept": "*/*",
            },
        },
        "breadcrumbs": {
            "values": [
                {"message": "Bearer abc.def", "data": {"url": "/join/CODE?x=1"}},
            ]
        },
    }

    out = observability.scrub_event(event)

    assert "user" not in out
    assert out["message"] == "failed for [email]"
    assert out["transaction"] == "/api/invites/[code]/join"
    assert out["exception"]["values"][0]["value"] == "bad [token] here"
    assert out["request"]["url"] == "https://api.example.com/api/invites/[code]/join"
    assert out["request"]["headers"] == {"Accept": "*/*"}
    for gone in ("cookies", "query_string", "data"):
        assert gone not in out["request"]
    crumb = out["breadcrumbs"]["values"][0]
    assert crumb["message"] == "Bearer [token]"
    assert crumb["data"]["url"] == "/join/[code]"


def test_scrub_event_tolerates_a_bare_event() -> None:
    assert observability.scrub_event({}) == {}
