"""Problem reports (#296): limits, image sniffing, scrubbing, the Resend request."""

import base64
import json
from collections.abc import AsyncGenerator, Callable
from typing import Any

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from api.core.config import Settings, get_settings
from api.db.models import User
from api.db.session import get_db
from api.dependencies.auth import get_current_user, get_token_email
from api.main import app
from api.services import support

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 32
HEIC = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 32
MB = 1024 * 1024
TOKEN = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"


class FakeSession:
    """Stands in for the database: one user row."""

    def __init__(self, user: User | None) -> None:
        self.user = user

    async def scalar(self, _statement: object) -> User | None:
        return self.user


class Resend:
    """The provider stub: records requests and answers with a canned status."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.status_code = 200

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(self.status_code, json={"id": "email-1"})

    @property
    def sent(self) -> dict[str, Any]:
        assert len(self.requests) == 1
        body: dict[str, Any] = json.loads(self.requests[0].content)
        return body


@pytest.fixture
def resend(monkeypatch: pytest.MonkeyPatch) -> Resend:
    settings = get_settings()
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "support_email", "support@example.com")
    fake = Resend()
    monkeypatch.setattr(support, "_transport", httpx.MockTransport(fake.handler))
    support.rate_limiter.reset()
    support.feedback_rate_limiter.reset()
    return fake


@pytest.fixture
async def post() -> AsyncGenerator[Callable[..., Any]]:
    user = User(id=7, supabase_uid="uid-7", username="kyle", email="kyle@example.org")

    async def override_db() -> AsyncGenerator[FakeSession]:
        yield FakeSession(user)

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: "uid-7"
    app.dependency_overrides[get_token_email] = lambda: "kyle@example.org"

    async def send(
        message: str = "The board is blank",
        images: list[bytes] | None = None,
        diagnostics: object = None,
        content_types: list[str] | None = None,
    ) -> httpx.Response:
        data = {"message": message}
        if diagnostics is not None:
            data["diagnostics"] = (
                diagnostics if isinstance(diagnostics, str) else json.dumps(diagnostics)
            )
        types = content_types or []
        files = [
            ("images", (f"a{i}.png", blob, types[i] if i < len(types) else "image/png"))
            for i, blob in enumerate(images or [])
        ]
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post("/api/support", data=data, files=files or None)

    yield send
    app.dependency_overrides.clear()


async def test_the_report_is_emailed_with_reply_to_and_images(
    resend: Resend, post: Callable[..., Any]
) -> None:
    response = await post(images=[PNG, JPEG], diagnostics={"route": "/leagues/3/feed"})

    assert response.status_code == 204
    sent = resend.sent
    assert resend.requests[0].headers["authorization"] == "Bearer re_test_key"
    assert sent["to"] == ["support@example.com"]
    assert sent["reply_to"] == "kyle@example.org"
    assert "The board is blank" in sent["text"]
    assert "kyle (user 7, kyle@example.org)" in sent["text"]
    assert "/leagues/3/feed" in sent["text"]
    names = [item["filename"] for item in sent["attachments"]]
    assert names == ["screenshot-1.png", "screenshot-2.jpg"]
    assert base64.b64decode(sent["attachments"][0]["content"]) == PNG


async def test_a_report_without_diagnostics_says_so(
    resend: Resend, post: Callable[..., Any]
) -> None:
    assert (await post()).status_code == 204
    assert "left it out" in resend.sent["text"]
    assert resend.sent["attachments"] == []


async def test_credentials_never_reach_the_email(
    resend: Resend, post: Callable[..., Any]
) -> None:
    diagnostics = {
        "route": "/leagues/1",
        "headers": {"Authorization": f"Bearer {TOKEN}", "Cookie": "sb=secret-cookie"},
        "accessToken": TOKEN,
        "logs": [f"refresh failed for {TOKEN}", "mail other@example.net rejected"],
        "failedRequests": [{"path": "/api/x", "note": f"Bearer {TOKEN}"}],
    }
    assert (await post(diagnostics=diagnostics)).status_code == 204
    text = resend.sent["text"]
    assert TOKEN not in text
    assert "secret-cookie" not in text
    assert "other@example.net" not in text
    assert "Authorization" not in text
    assert "[token]" in text


@pytest.mark.parametrize("blob", [b"%PDF-1.7 not an image", b"<svg></svg>", b""])
async def test_non_images_are_refused_by_content(
    resend: Resend, post: Callable[..., Any], blob: bytes
) -> None:
    response = await post(images=[blob])
    assert response.status_code == 422
    assert "not an image" in response.json()["detail"]
    assert resend.requests == []


async def test_a_png_named_like_a_pdf_is_still_accepted(
    resend: Resend, post: Callable[..., Any]
) -> None:
    assert (
        await post(images=[PNG], content_types=["application/pdf"])
    ).status_code == 204


async def test_webp_and_heic_are_images(
    resend: Resend, post: Callable[..., Any]
) -> None:
    assert (await post(images=[WEBP, HEIC])).status_code == 204
    names = [item["filename"] for item in resend.sent["attachments"]]
    assert names == ["screenshot-1.webp", "screenshot-2.heic"]


async def test_one_image_over_five_megabytes_is_refused(
    resend: Resend, post: Callable[..., Any]
) -> None:
    big = PNG + b"\x00" * (5 * MB)
    response = await post(images=[big])
    assert response.status_code == 413
    assert "5.0 MB per image" in response.json()["detail"]
    assert resend.requests == []


async def test_images_over_fifteen_megabytes_in_total_are_refused(
    resend: Resend, post: Callable[..., Any]
) -> None:
    four_mb = PNG + b"\x00" * (4 * MB)
    response = await post(images=[four_mb] * 4)
    assert response.status_code == 413
    assert "15.0 MB in total" in response.json()["detail"]


async def test_more_than_five_images_are_refused(
    resend: Resend, post: Callable[..., Any]
) -> None:
    response = await post(images=[PNG] * 6)
    assert response.status_code == 422
    assert "at most 5" in response.json()["detail"]


async def test_a_declared_body_over_the_limit_is_refused_unread(
    resend: Resend, post: Callable[..., Any]
) -> None:
    response = await post(images=[PNG + b"\x00" * (support.MAX_REQUEST_BYTES)])
    assert response.status_code == 413


@pytest.mark.parametrize("message", ["", "   \n"])
async def test_a_message_is_required(
    resend: Resend, post: Callable[..., Any], message: str
) -> None:
    response = await post(message=message)
    assert response.status_code == 422
    assert resend.requests == []


async def test_a_message_over_the_limit_is_refused(
    resend: Resend, post: Callable[..., Any]
) -> None:
    response = await post(message="x" * (support.MAX_MESSAGE_CHARS + 1))
    assert response.status_code == 422


@pytest.mark.parametrize("raw", ["not json", "[1, 2]"])
async def test_malformed_diagnostics_are_refused(
    resend: Resend, post: Callable[..., Any], raw: str
) -> None:
    assert (await post(diagnostics=raw)).status_code == 422


async def test_the_sixth_report_in_an_hour_is_rate_limited(
    resend: Resend, post: Callable[..., Any]
) -> None:
    for _ in range(support.REPORTS_PER_HOUR):
        assert (await post()).status_code == 204
    response = await post()
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
    assert len(resend.requests) == support.REPORTS_PER_HOUR


async def test_failures_do_not_use_up_the_rate_limit(
    resend: Resend, post: Callable[..., Any]
) -> None:
    resend.status_code = 500
    for _ in range(support.REPORTS_PER_HOUR + 1):
        assert (await post()).status_code == 502
    resend.status_code = 200
    assert (await post()).status_code == 204


async def test_a_provider_failure_is_a_readable_error_without_leaks(
    resend: Resend, post: Callable[..., Any], caplog: pytest.LogCaptureFixture
) -> None:
    resend.status_code = 422
    response = await post(message="my secret problem")
    assert response.status_code == 502
    assert "try again" in response.json()["detail"].lower()
    assert "secret problem" not in caplog.text
    assert "kyle@example.org" not in caplog.text


async def test_without_the_key_the_route_says_it_is_not_set_up(
    monkeypatch: pytest.MonkeyPatch, post: Callable[..., Any]
) -> None:
    monkeypatch.setattr(get_settings(), "resend_api_key", "")
    monkeypatch.setattr(get_settings(), "support_email", "support@example.com")
    response = await post()
    assert response.status_code == 503
    assert "not set up" in response.json()["detail"]


def test_sniffing_ignores_the_claimed_type() -> None:
    assert support.sniff_image(PNG) is not None
    assert support.sniff_image(b"GIF89a....") is not None
    assert support.sniff_image(b"MZ\x90\x00 an executable") is None


def test_production_refuses_a_redirected_provider_url() -> None:
    def settings(environment: str) -> Settings:
        return Settings(
            _env_file=None,
            pg_host="localhost",
            supabase_url="https://test.supabase.co",
            environment=environment,
            resend_api_url="http://localhost:8102/emails",
        )

    assert settings("test").resend_api_url.startswith("http://localhost")
    with pytest.raises(ValidationError, match="RESEND_API_URL"):
        settings("production")


async def _feedback(payload: dict[str, Any]) -> httpx.Response:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.post("/api/support/feedback", json=payload)


async def test_feedback_is_emailed_anonymously(
    resend: Resend, post: Callable[..., Any]
) -> None:
    response = await _feedback({"rating": 4, "good": "Draft was fun", "bad": "Slow"})

    assert response.status_code == 204
    sent = resend.sent
    assert sent["subject"] == "[PostSzn feedback] 4/5"
    assert "Draft was fun" in sent["text"] and "Slow" in sent["text"]
    assert "reply_to" not in sent
    for private in ("kyle", "kyle@example.org", "user 7"):
        assert private not in sent["text"] + sent["subject"]


async def test_feedback_needs_something_and_a_valid_rating(
    resend: Resend, post: Callable[..., Any]
) -> None:
    assert (await _feedback({})).status_code == 422
    assert (await _feedback({"good": "   "})).status_code == 422
    assert (await _feedback({"rating": 6})).status_code == 422
    assert (await _feedback({"rating": 0, "good": "x"})).status_code == 422
    assert (await _feedback({"good": "x" * 2001})).status_code == 422
    assert resend.requests == []
    assert (await _feedback({"rating": 5})).status_code == 204


async def test_feedback_is_rate_limited(
    resend: Resend, post: Callable[..., Any]
) -> None:
    for _ in range(support.FEEDBACK_PER_HOUR):
        assert (await _feedback({"rating": 3})).status_code == 204
    limited = await _feedback({"rating": 3})
    assert limited.status_code == 429
    assert "Retry-After" in limited.headers
