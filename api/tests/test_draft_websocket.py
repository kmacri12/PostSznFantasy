from collections.abc import Iterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from api.main import app
from api.services.draft_picks import DraftPickError, PickResult

WS_URL = "/api/drafts/ws/7"


@pytest.fixture
def db() -> AsyncMock:
    return AsyncMock()


@pytest.fixture(autouse=True)
def patched_session_factory(db: AsyncMock) -> Iterator[None]:
    @asynccontextmanager
    async def session() -> Any:
        yield db

    with (
        patch("api.routers.drafts.get_session_factory", return_value=session),
        patch("api.ws.auth.get_session_factory", return_value=session),
        patch(
            "api.routers.drafts.season_is_archived", new=AsyncMock(return_value=False)
        ),
    ):
        yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def join(ws: Any) -> None:
    """Authenticate and consume the greeting: a snapshot, then the presence broadcast."""
    ws.send_json(auth_message())
    assert ws.receive_json()["eventType"] == "SNAPSHOT"
    assert ws.receive_json() == {"eventType": "PRESENCE", "data": [1]}


def auth_message(token: str = "valid") -> dict[str, str]:
    return {"eventType": "AUTH", "token": token}


def as_member(uid: str = "uid-1") -> Any:
    membership = SimpleNamespace(
        user=SimpleNamespace(id=1, supabase_uid=uid), team=SimpleNamespace(id=5)
    )
    snapshot = {"eventType": "SNAPSHOT", "data": {"status": "in_progress"}}
    return (
        patch("api.ws.auth.verify_token", return_value=uid),
        patch(
            "api.ws.auth.find_season_membership",
            new=AsyncMock(return_value=membership),
        ),
        patch("api.routers.drafts._snapshot", new=AsyncMock(return_value=snapshot)),
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
        "api.ws.auth.verify_token",
        side_effect=HTTPException(status_code=401, detail="bad"),
    ):
        with client.websocket_connect(WS_URL) as ws:
            ws.send_json(auth_message("forged"))
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_json()
    assert exc.value.code == 1008


def test_non_member_is_rejected(client: TestClient) -> None:
    with (
        patch("api.ws.auth.verify_token", return_value="outsider"),
        patch(
            "api.ws.auth.find_season_membership",
            new=AsyncMock(return_value=None),
        ),
    ):
        with client.websocket_connect(WS_URL) as ws:
            ws.send_json(auth_message())
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_json()
    assert exc.value.code == 1008


def test_member_can_ping_and_unknown_events_are_rejected(client: TestClient) -> None:
    verify, membership, snapshot = as_member()
    with verify, membership, snapshot, client.websocket_connect(WS_URL) as ws:
        join(ws)

        ws.send_json({"eventType": "PING", "timestamp": 5})
        assert ws.receive_json() == {"eventType": "PONG", "timestamp": 5}

        ws.send_json({"eventType": "PICK_MADE", "data": {"playerId": 99}})
        assert ws.receive_json() == {
            "eventType": "ERROR",
            "message": "Unsupported event type",
            "code": None,
        }


def test_client_cannot_spoof_a_broadcast(client: TestClient) -> None:
    verify, membership, snapshot = as_member()
    with verify, membership, snapshot, client.websocket_connect(WS_URL) as ws:
        join(ws)
        ws.send_json({"eventType": "DRAFT_COMPLETE"})
        assert ws.receive_json()["eventType"] == "ERROR"


def test_make_pick_requires_player_id(client: TestClient) -> None:
    verify, membership, snapshot = as_member()
    with verify, membership, snapshot, client.websocket_connect(WS_URL) as ws:
        join(ws)
        ws.send_json({"eventType": "MAKE_PICK", "data": {}})
        assert ws.receive_json()["message"] == "playerId is required"


def test_rejected_pick_returns_error_only_to_sender(
    client: TestClient, db: AsyncMock
) -> None:
    verify, membership, snapshot = as_member()
    with (
        verify,
        membership,
        snapshot,
        patch(
            "api.routers.drafts.make_pick",
            new=AsyncMock(
                side_effect=DraftPickError(
                    "It is not your turn to pick", code="not_your_turn"
                )
            ),
        ),
        client.websocket_connect(WS_URL) as ws,
    ):
        join(ws)
        ws.send_json({"eventType": "MAKE_PICK", "data": {"playerId": 3}})
        assert ws.receive_json() == {
            "eventType": "ERROR",
            "message": "It is not your turn to pick",
            "code": "not_your_turn",
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
    events = [
        {"eventType": "PICK_MADE", "data": {"playerId": 3, "playerName": "Star QB"}},
        {"eventType": "DRAFT_STATE", "data": {"currentPickOverall": 2}},
    ]
    verify, membership, snapshot = as_member()
    with (
        verify,
        membership,
        snapshot,
        patch("api.routers.drafts.make_pick", new=AsyncMock(return_value=result)),
        patch("api.routers.drafts._draft_for_session", new=AsyncMock()),
        patch("api.routers.drafts.pick_events", new=AsyncMock(return_value=events)),
        client.websocket_connect(WS_URL) as ws,
    ):
        join(ws)
        ws.send_json({"eventType": "MAKE_PICK", "data": {"playerId": 3}})
        picked = ws.receive_json()
        state = ws.receive_json()

    assert picked["eventType"] == "PICK_MADE"
    assert picked["data"]["playerName"] == "Star QB"
    assert state["eventType"] == "DRAFT_STATE"
    db.commit.assert_awaited()


def test_picks_on_an_archived_league_are_refused(client: TestClient) -> None:
    verify, membership, snapshot = as_member()
    make = AsyncMock()
    with (
        verify,
        membership,
        snapshot,
        patch(
            "api.routers.drafts.season_is_archived", new=AsyncMock(return_value=True)
        ),
        patch("api.routers.drafts.make_pick", new=make),
        client.websocket_connect(WS_URL) as ws,
    ):
        join(ws)
        ws.send_json({"eventType": "MAKE_PICK", "data": {"playerId": 3}})
        reply = ws.receive_json()
    assert (reply["eventType"], reply["code"]) == ("ERROR", "archived")
    make.assert_not_awaited()
