"""Delete my account (#330): identity and personal data go, league history stays."""

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LeagueMember,
    LeagueMessage,
    Notification,
    PushSubscription,
    Team,
)
from api.services import account_deletion
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


@pytest.fixture
def supabase(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    monkeypatch.setattr(get_settings(), "supabase_service_role_key", "service-key")
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={})

    monkeypatch.setattr(account_deletion, "_transport", httpx.MockTransport(handler))
    return calls


CONFIRM = {"confirm": "DELETE"}


async def test_deleting_wipes_the_person_and_keeps_the_leagues_history(
    db: AsyncSession, client_as: ClientFactory, supabase: list[httpx.Request]
) -> None:
    season, users, teams, _ = await make_season(db, teams=3, draft_status="completed")
    member = users[1]
    db.add(
        PushSubscription(
            user_id=member.id,
            endpoint="https://fcm.googleapis.com/x",
            p256dh="k",
            auth="a",
        )
    )
    db.add(
        LeagueMessage(
            league_id=season.league_id,
            season_id=season.id,
            author_user_id=member.id,
            author_name="user1",
            body="hello",
        )
    )
    db.add(
        Notification(
            user_id=member.id,
            kind="draft_turn",
            league_id=season.league_id,
            payload={"seasonId": season.id},
        )
    )
    await db.flush()

    async with client_as("uid-1") as client:
        response = await client.request("DELETE", "/api/auth/me", json=CONFIRM)
    assert response.status_code == 204

    assert [r.method for r in supabase] == ["DELETE"]
    assert supabase[0].url.path.endswith("/auth/v1/admin/users/uid-1")
    await db.refresh(member)
    assert (member.username, member.email) == ("Former member", None)
    assert member.supabase_uid != "uid-1"
    assert (await db.scalars(select(PushSubscription))).all() == []
    assert (await db.scalars(select(Notification))).all() == []
    message = await db.scalar(select(LeagueMessage))
    assert message is not None
    assert message.author_name == "Former member"
    assert message.body == "hello"
    membership = await db.scalar(
        select(LeagueMember).where(LeagueMember.user_id == member.id)
    )
    assert membership is not None and membership.left_at is not None
    team = await db.get(Team, teams[1].id)
    assert team is not None and team.owner_id is None


async def test_the_only_commissioner_must_hand_over_first(
    db: AsyncSession, client_as: ClientFactory, supabase: list[httpx.Request]
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-0") as client:
        response = await client.request("DELETE", "/api/auth/me", json=CONFIRM)
    assert response.status_code == 409
    assert "Test League" in response.json()["detail"]
    assert supabase == []


async def test_a_commissioner_may_leave_once_another_commissioner_exists(
    db: AsyncSession, client_as: ClientFactory, supabase: list[httpx.Request]
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    other = await db.scalar(
        select(LeagueMember).where(
            LeagueMember.league_id == season.league_id,
            LeagueMember.user_id == users[1].id,
        )
    )
    assert other is not None
    other.role = "commissioner"
    await db.flush()
    async with client_as("uid-0") as client:
        assert (
            await client.request("DELETE", "/api/auth/me", json=CONFIRM)
        ).status_code == 204


async def test_nothing_changes_when_the_sign_in_identity_cannot_be_deleted(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    monkeypatch.setattr(get_settings(), "supabase_service_role_key", "service-key")
    monkeypatch.setattr(
        account_deletion,
        "_transport",
        httpx.MockTransport(lambda request: httpx.Response(500)),
    )
    async with client_as("uid-1") as client:
        assert (
            await client.request("DELETE", "/api/auth/me", json=CONFIRM)
        ).status_code == 502
    await db.refresh(users[1])
    assert users[1].email == "u1@x.co"


async def test_deleting_is_unavailable_without_the_service_key(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    await make_season(db, teams=2)
    monkeypatch.setattr(get_settings(), "supabase_service_role_key", "")
    async with client_as("uid-1") as client:
        assert (
            await client.request("DELETE", "/api/auth/me", json=CONFIRM)
        ).status_code == 503


async def test_deleting_needs_the_confirmation_phrase_in_the_body(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    monkeypatch.setattr(get_settings(), "supabase_service_role_key", "service-key")
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)

    monkeypatch.setattr(account_deletion, "_transport", httpx.MockTransport(handler))
    async with client_as("uid-1") as client:
        bodies: list[dict[str, str] | None] = [
            None,
            {},
            {"confirm": ""},
            {"confirm": "delete"},
            {"confirm": " DELETE"},
            {"confirm": "yes"},
        ]
        for body in bodies:
            response = await client.request("DELETE", "/api/auth/me", json=body)
            assert response.status_code == 422, body
        no_body = await client.delete("/api/auth/me")
    assert no_body.status_code == 422
    assert calls == []
    await db.refresh(users[1])
    assert users[1].email == "u1@x.co"
