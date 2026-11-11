"""The pinned league announcement (#403): who may post, the feed event, push."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core import rate_limit
from api.core.config import get_settings
from api.db.models import (
    ActivityEvent,
    League,
    LeagueMember,
    Notification,
    PushSubscription,
    User,
)
from api.services import notifications, push
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

CHROME = "https://fcm.googleapis.com/fcm/send/"


def _url(league_id: int) -> str:
    return f"/api/leagues/{league_id}/announcement"


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, push.PushMessage]]:
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_public_key", "public")
    monkeypatch.setattr(settings, "vapid_private_key", "private")
    monkeypatch.setattr(settings, "vapid_subject", "mailto:owner@example.com")
    deliveries: list[tuple[str, push.PushMessage]] = []

    def deliver(subscription: PushSubscription, message: push.PushMessage) -> int:
        deliveries.append((subscription.endpoint, message))
        return 201

    monkeypatch.setattr(push, "_deliver", deliver)
    return deliveries


async def test_a_commissioner_pins_it_and_everyone_sees_it_in_the_overview(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=3)
    async with client_as("uid-0") as commissioner:
        before = (await commissioner.get(f"/api/leagues/{season.league_id}")).json()
        pinned = await commissioner.put(
            _url(season.league_id), json={"body": "  Draft is Saturday  "}
        )
    assert before["announcement"] is None
    assert pinned.status_code == 200
    assert pinned.json()["announcement"]["body"] == "Draft is Saturday"
    assert pinned.json()["announcement"]["authorName"] == "user0"
    async with client_as("uid-2") as member:
        seen = (await member.get(f"/api/leagues/{season.league_id}")).json()
    assert seen["announcement"]["body"] == "Draft is Saturday"
    assert seen["notes"] == ""


async def test_pinning_again_replaces_it_and_unpinning_keeps_the_feed_history(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.put(_url(season.league_id), json={"body": "First"})
        second = await commissioner.put(_url(season.league_id), json={"body": "Second"})
        cleared = await commissioner.delete(_url(season.league_id))
    assert second.json()["announcement"]["body"] == "Second"
    assert cleared.status_code == 200
    assert cleared.json()["announcement"] is None
    events = (
        (
            await db.execute(
                select(ActivityEvent.payload).where(
                    ActivityEvent.kind == "announcement",
                    ActivityEvent.season_id == season.id,
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(e["body"] for e in events) == ["First", "Second"]


async def test_it_shows_in_the_feed_and_lights_the_dot_for_others(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-0") as commissioner:
        await commissioner.put(_url(season.league_id), json={"body": "Bring snacks"})
        own = (await commissioner.get(f"/api/seasons/{season.id}/feed")).json()
    async with client_as("uid-1") as member:
        theirs = (await member.get(f"/api/seasons/{season.id}/feed")).json()
    [event] = [i for i in theirs["items"] if i.get("kind") == "announcement"]
    assert event["payload"] == {"body": "Bring snacks"}
    assert event["actorName"] == "user0"
    assert event["isNew"] is True
    assert theirs["hasNew"] is True
    assert own["hasNew"] is False


async def test_only_a_commissioner_may_pin_or_unpin(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=2)
    former = User(supabase_uid="uid-former", username="former", email="f@x.co")
    stranger = User(supabase_uid="uid-stranger", username="stranger", email="s@x.co")
    db.add_all([former, stranger])
    await db.flush()
    db.add(
        LeagueMember(
            league_id=season.league_id,
            user_id=former.id,
            role="commissioner",
            left_at=datetime.now(UTC),
        )
    )
    await db.flush()
    for uid in ("uid-1", "uid-stranger", "uid-former"):
        async with client_as(uid) as client:
            put = await client.put(_url(season.league_id), json={"body": "Hi"})
            delete = await client.delete(_url(season.league_id))
        assert (put.status_code, delete.status_code) == (403, 403), uid
    league = await db.get(League, season.league_id)
    assert league is not None
    await db.refresh(league)
    assert league.announcement == ""


async def test_a_blank_or_oversized_body_is_refused(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-0") as commissioner:
        blank = await commissioner.put(_url(season.league_id), json={"body": " \n "})
        long = await commissioner.put(_url(season.league_id), json={"body": "x" * 1001})
    assert blank.status_code == 422
    assert long.status_code == 422


async def test_posting_is_rate_limited_per_commissioner(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    statuses = []
    async with client_as("uid-0") as commissioner:
        for i in range(11):
            response = await commissioner.put(
                _url(season.league_id), json={"body": f"n{i}"}
            )
            statuses.append(response.status_code)
    assert statuses == [200] * 10 + [429]
    rate_limit.reset_all()


async def test_push_goes_to_other_members_who_allow_it_and_every_inbox(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    for user in users:
        db.add(
            PushSubscription(
                user_id=user.id, endpoint=f"{CHROME}{user.id}", p256dh="k", auth="a"
            )
        )
    await db.execute(
        update(User).where(User.id == users[2].id).values(push_announcements=False)
    )
    await db.flush()
    await notifications.notify_announcement(
        db, season.league_id, season.id, users[0].id, "Draft moved to 8pm"
    )
    assert [endpoint for endpoint, _ in sent] == [f"{CHROME}{users[1].id}"]
    message = sent[0][1]
    assert message.title == "Announcement from Test League"
    assert message.body == "Draft moved to 8pm"
    entries = (await db.execute(select(Notification))).scalars().all()
    assert sorted((n.user_id, n.kind) for n in entries) == sorted(
        [(users[1].id, "announcement"), (users[2].id, "announcement")]
    )


async def test_the_push_preference_defaults_on_and_can_be_turned_off(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db)
    async with client_as("uid-1") as client:
        first = await client.get("/api/push/preferences")
        off = await client.patch("/api/push/preferences", json={"announcements": False})
    assert first.json()["announcements"] is True
    assert off.json()["announcements"] is False
