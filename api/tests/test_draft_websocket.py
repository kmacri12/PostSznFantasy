from collections.abc import Iterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from api.main import app
from api.services.draft_picks import DraftPickError, PickResult
from fastapi import HTTPException
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

WS_URL = "/api/drafts/ws/7"


@pytest.fixture
def db() -> AsyncMock:
    return AsyncMock()


@pytest.fixture(autouse=True)
def patched_session_factory(db: AsyncMock) -> Iterator[None]:
    @asynccontextmanager
    async def session() -> Any:
        yield db

    with patch("api.routers.drafts.get_session_factory", return_value=session):
        yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def auth_message(token: str = "valid") -> dict[str, str]:
    return {"eventType": "AUTH", "token": token}


def as_member(uid: str = "uid-1") -> Any:
    membership = SimpleNamespace(user=SimpleNamespace(id=1, supabase_uid=uid))
    return (
        patch("api.routers.drafts.verify_token", return_value=uid),
        patch(
            "api.routers.drafts.find_membership",
            new=AsyncMock(return_value=membership),
        ),
    )


def test_unauthenticated_socket_is_closed_on_bad_first_message(
    client: TestClient,
) -> None:
    with client.websocket_connect(WS_URL) as ws:
        ws.send_json({"eventType": "PING"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 1008


def test_forged_token_is_rejected(client: TestClient) -> None:
    with patch(
        "api.routers.drafts.verify_token",
        side_effect=HTTPException(status_code=401, detail="bad"),
    ):
        with client.websocket_connect(WS_URL) as ws:
            ws.send_json(auth_message("forged"))
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_json()
    assert exc.value.code == 1008


def test_non_member_is_rejected(client: TestClient) -> None:
    with (
        patch("api.routers.drafts.verify_token", return_value="outsider"),
        patch("api.routers.drafts.find_membership", new=AsyncMock(return_value=None)),
    ):
        with client.websocket_connect(WS_URL) as ws:
            ws.send_json(auth_message())
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_json()
    assert exc.value.code == 1008


def test_member_can_ping_and_unknown_events_are_rejected(client: TestClient) -> None:
    verify, membership = as_member()
    with verify, membership, client.websocket_connect(WS_URL) as ws:
        ws.send_json(auth_message())
        assert ws.receive_json()["eventType"] == "CONNECTED"

        ws.send_json({"eventType": "PING", "timestamp": 5})
        assert ws.receive_json() == {"eventType": "PONG", "timestamp": 5}

        ws.send_json({"eventType": "PICK_MADE", "data": {"playerId": 99}})
        assert ws.receive_json() == {
            "eventType": "ERROR",
            "message": "Unsupported event type",
        }


def test_client_cannot_spoof_a_broadcast(client: TestClient) -> None:
    verify, membership = as_member()
    with verify, membership, client.websocket_connect(WS_URL) as ws:
        ws.send_json(auth_message())
        ws.receive_json()
        ws.send_json({"eventType": "DRAFT_COMPLETE"})
        assert ws.receive_json()["eventType"] == "ERROR"


def test_make_pick_requires_player_id(client: TestClient) -> None:
    verify, membership = as_member()
    with verify, membership, client.websocket_connect(WS_URL) as ws:
        ws.send_json(auth_message())
        ws.receive_json()
        ws.send_json({"eventType": "MAKE_PICK", "data": {}})
        assert ws.receive_json()["message"] == "playerId is required"


def test_rejected_pick_returns_error_only_to_sender(
    client: TestClient, db: AsyncMock
) -> None:
    verify, membership = as_member()
    with (
        verify,
        membership,
        patch(
            "api.routers.drafts.make_pick",
            new=AsyncMock(side_effect=DraftPickError("It is not your turn to pick")),
        ),
        client.websocket_connect(WS_URL) as ws,
    ):
        ws.send_json(auth_message())
        ws.receive_json()
        ws.send_json({"eventType": "MAKE_PICK", "data": {"playerId": 3}})
        assert ws.receive_json() == {
            "eventType": "ERROR",
            "message": "It is not your turn to pick",
        }
    db.rollback.assert_awaited()


def test_valid_pick_is_committed_and_broadcast(
    client: TestClient, db: AsyncMock
) -> None:
    pick = MagicMock(
        id=11,
        draft_id=2,
        team_id=5,
        player_id=3,
        number_round=1,
        number_pick_overall=1,
        number_pick_in_round=1,
    )
    result = PickResult(
        pick=pick, player_name="Star QB", next_pick_overall=2, draft_complete=False
    )
    verify, membership = as_member()
    with (
        verify,
        membership,
        patch("api.routers.drafts.make_pick", new=AsyncMock(return_value=result)),
        client.websocket_connect(WS_URL) as ws,
    ):
        ws.send_json(auth_message())
        ws.receive_json()
        ws.send_json({"eventType": "MAKE_PICK", "data": {"playerId": 3}})
        event = ws.receive_json()

    assert event["eventType"] == "PICK_MADE"
    assert event["data"]["playerId"] == 3
    assert event["data"]["playerName"] == "Star QB"
    assert event["data"]["currentPickIndex"] == 2
    db.commit.assert_awaited()
