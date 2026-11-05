"""What `push._deliver` hands to pywebpush, with the sender stubbed (#303)."""

import json
from typing import Any

import pytest

from api.core.config import get_settings
from api.db.models import PushSubscription
from api.services import push


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_private_key", "private")
    monkeypatch.setattr(settings, "vapid_subject", "mailto:owner@example.com")
    calls: list[dict[str, Any]] = []

    class Accepted:
        status_code = 201

    def fake_webpush(**kwargs: Any) -> Accepted:
        calls.append(kwargs)
        return Accepted()

    monkeypatch.setattr(push, "webpush", fake_webpush)
    return calls


def _deliver(message: push.PushMessage) -> int:
    subscription = PushSubscription(
        user_id=1, endpoint="https://push.example/device", p256dh="k", auth="a"
    )
    return push._deliver(subscription, message)


def test_a_time_critical_push_goes_out_at_high_urgency(
    sent: list[dict[str, Any]],
) -> None:
    message = push.PushMessage("You're on the clock", "b", "/", "tag", urgency="high")
    assert _deliver(message) == 201
    [call] = sent
    assert call["headers"] == {"Urgency": "high"}
    assert call["ttl"] == push.TTL_SECONDS == 15 * 60


def test_a_push_is_normal_urgency_unless_it_says_otherwise(
    sent: list[dict[str, Any]],
) -> None:
    _deliver(push.PushMessage("t", "b", "/", "tag"))
    assert sent[0]["headers"] == {"Urgency": "normal"}


def test_the_urgency_is_a_header_and_not_part_of_the_notification(
    sent: list[dict[str, Any]],
) -> None:
    _deliver(push.PushMessage("t", "b", "/path", "tag", urgency="high"))
    assert json.loads(sent[0]["data"]) == {
        "title": "t",
        "body": "b",
        "url": "/path",
        "tag": "tag",
    }
