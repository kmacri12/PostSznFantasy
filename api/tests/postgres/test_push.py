"""Web push (#266): subscriptions, delivery with a faked sender, pruning, triggers."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LeagueMember,
    LeagueMessage,
    LineupReminder,
    NFLGame,
    NFLTeam,
    PushSubscription,
    TeamPlayer,
    User,
)
from api.services import push
from api.services.draft_events import announce_events
from api.services.lineup_reminders import send_lock_reminders
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

CHROME = "https://fcm.googleapis.com/fcm/send/"
BODY = {"endpoint": CHROME + "device-a", "keys": {"p256dh": "k", "auth": "a"}}
NOW = datetime(2027, 1, 9, 12, tzinfo=UTC)


class FakeSender:
    def __init__(self) -> None:
        self.sent: list[tuple[str, push.PushMessage]] = []
        self.status_by_endpoint: dict[str, int] = {}

    def __call__(
        self, subscription: PushSubscription, message: push.PushMessage
    ) -> int:
        self.sent.append((subscription.endpoint, message))
        return self.status_by_endpoint.get(subscription.endpoint, 201)


@pytest.fixture
def sender(monkeypatch: pytest.MonkeyPatch) -> FakeSender:
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_public_key", "public")
    monkeypatch.setattr(settings, "vapid_private_key", "private")
    monkeypatch.setattr(settings, "vapid_subject", "mailto:owner@example.com")
    fake = FakeSender()
    monkeypatch.setattr(push, "_deliver", fake)
    return fake


async def _subscribe(
    db: AsyncSession,
    user: User,
    endpoint: str = BODY["endpoint"],  # type: ignore[assignment]
) -> None:
    db.add(PushSubscription(user_id=user.id, endpoint=endpoint, p256dh="k", auth="a"))
    await db.flush()


async def _rows(db: AsyncSession) -> list[PushSubscription]:
    return list(
        (
            await db.execute(
                select(PushSubscription)
                .order_by(PushSubscription.id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


async def test_vapid_key_is_public_and_null_when_unconfigured(
    db: AsyncSession, client_as: ClientFactory, sender: FakeSender
) -> None:
    async with client_as("nobody") as client:
        assert (await client.get("/api/push/vapid-key")).json() == {
            "publicKey": "public"
        }


async def test_subscribe_is_an_upsert_per_endpoint(
    db: AsyncSession, client_as: ClientFactory, sender: FakeSender
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    async with client_as("uid-0") as client:
        first = await client.post("/api/push/subscriptions", json=BODY)
        again = await client.post(
            "/api/push/subscriptions",
            json={**BODY, "keys": {"p256dh": "k2", "auth": "a2"}},
        )
    assert first.status_code == again.status_code == 204
    rows = await _rows(db)
    assert [(r.user_id, r.p256dh) for r in rows] == [(users[0].id, "k2")]
    async with client_as("uid-1") as other:
        await other.post("/api/push/subscriptions", json=BODY)
    assert [r.user_id for r in await _rows(db)] == [users[1].id]


async def test_subscribe_rejects_unknown_hosts_and_unconfigured_push(
    db: AsyncSession, client_as: ClientFactory, sender: FakeSender
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-0") as client:
        bad = await client.post(
            "/api/push/subscriptions", json={**BODY, "endpoint": "https://evil.test/x"}
        )
        assert bad.status_code == 422
        get_settings().vapid_public_key = ""
        assert (
            await client.post("/api/push/subscriptions", json=BODY)
        ).status_code == 409


async def test_unsubscribe_only_removes_the_callers_own_device(
    db: AsyncSession, client_as: ClientFactory, sender: FakeSender
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0])
    payload = {"endpoint": BODY["endpoint"]}
    async with client_as("uid-1") as stranger:
        assert (
            await stranger.request("DELETE", "/api/push/subscriptions", json=payload)
        ).status_code == 204
    assert len(await _rows(db)) == 1
    async with client_as("uid-0") as owner:
        await owner.request("DELETE", "/api/push/subscriptions", json=payload)
    assert await _rows(db) == []


async def test_dead_subscriptions_are_pruned_and_live_ones_kept(
    db: AsyncSession, sender: FakeSender
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0], CHROME + "dead")
    await _subscribe(db, users[0], CHROME + "alive")
    sender.status_by_endpoint[CHROME + "dead"] = 410
    message = push.PushMessage("t", "b", "/", "tag")
    assert await push.send_to_users(db, [users[0].id], message) == 1
    assert [r.endpoint for r in await _rows(db)] == [CHROME + "alive"]


async def test_nothing_is_sent_without_vapid_keys(
    db: AsyncSession, sender: FakeSender
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0])
    get_settings().vapid_public_key = ""
    assert (
        await push.send_to_users(
            db, [users[0].id], push.PushMessage("t", "b", "/", "x")
        )
        == 0
    )
    assert sender.sent == []


async def test_the_owner_on_the_clock_is_notified(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, teams, _ = await make_season(db, teams=2)
    await _subscribe(db, users[1])
    await push.notify_on_the_clock(db, season.id, teams[1].id)
    [(endpoint, message)] = sender.sent
    assert endpoint == BODY["endpoint"]
    assert message.title == "You're on the clock"
    assert message.url == f"/leagues/{season.league_id}/draft"
    assert message.urgency == "high"
    await push.notify_on_the_clock(db, season.id, teams[0].id)  # owner has no device
    assert len(sender.sent) == 1


async def test_only_a_running_drafts_clock_change_triggers_a_push(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spawned: list[tuple[Any, ...]] = []
    monkeypatch.setattr(push, "spawn", lambda fn, *args: spawned.append(args))

    def state(status: str, team: int | None) -> dict[str, Any]:
        return {
            "eventType": "DRAFT_STATE",
            "data": {"status": status, "onTheClockTeamId": team},
        }

    await announce_events(
        7, [{"eventType": "PICK_MADE", "data": {}}, state("in_progress", 3)]
    )
    await announce_events(7, [state("paused", 3), state("in_progress", None)])
    assert spawned == [(7, 3)]


async def test_a_chat_message_notifies_the_other_members_without_its_text(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    await _subscribe(db, users[0], "https://fcm.googleapis.com/send/author")
    await _subscribe(db, users[1], "https://fcm.googleapis.com/send/other")
    await _subscribe(db, users[2], "https://fcm.googleapis.com/send/gone")
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[2].id)
        .values(left_at=datetime.now(UTC))
    )
    message = LeagueMessage(
        league_id=season.league_id,
        season_id=season.id,
        author_user_id=users[0].id,
        author_name="Ann",
        body="secret trade talk",
    )
    db.add(message)
    await db.flush()

    await push.notify_league_message(db, message.id)

    [(endpoint, sent)] = sender.sent
    assert endpoint.endswith("/other")
    assert sent.url == f"/leagues/{season.league_id}/feed"
    assert "secret" not in sent.title + sent.body
    assert sent.urgency == "normal"

    message.deleted_at = datetime.now(UTC)
    await push.notify_league_message(db, message.id)
    assert len(sender.sent) == 1


async def _lock_setup(
    db: AsyncSession, kickoff: datetime
) -> tuple[list[User], Callable[[], Any]]:
    season, users, teams, _ = await make_season(
        db, teams=2, year=2027, draft_status="completed", roster_total=3,
        roster_num_qb=1, roster_num_rb=1, roster_num_flex_wr_rb_te=1,
        roster_num_wr=0, roster_num_te=0, roster_num_k=0, roster_num_dst=0,
        roster_num_bench=0,
    )  # fmt: skip
    home = await make_players(db, ["QB", "RB"], first_id=1000)
    db.add(NFLTeam(id=2000, team_abv="AWY", is_active=True, in_playoffs=True))
    db.add(
        NFLGame(
            id="g1",
            season=2027,
            season_type="post",
            game_week=19,
            game_status="Scheduled",
            game_time_epoch=str(int(kickoff.timestamp())),
            team_id_home=1000,
            team_id_away=2000,
        )  # fmt: skip
    )
    db.add_all(
        TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=p.id)
        for p in home
    )
    await db.flush()
    for user in users:
        await _subscribe(db, user, CHROME + user.username)
    return users, lambda: None


async def test_lock_reminder_goes_once_to_owners_with_an_open_starter_slot(
    db: AsyncSession, sender: FakeSender
) -> None:
    users, _ = await _lock_setup(db, NOW + timedelta(minutes=45))
    assert await send_lock_reminders(db, 2027, NOW) == 1
    [(endpoint, message)] = sender.sent
    assert endpoint == CHROME + users[0].username  # team 1 has no players to place
    assert "Lineup locks" in message.title
    assert message.urgency == "high"
    assert await send_lock_reminders(db, 2027, NOW + timedelta(minutes=5)) == 0
    assert len(sender.sent) == 1
    assert len((await db.execute(select(LineupReminder))).scalars().all()) == 1


async def test_no_lock_reminder_outside_the_hour_before_kickoff(
    db: AsyncSession, sender: FakeSender
) -> None:
    await _lock_setup(db, NOW + timedelta(hours=3))
    assert await send_lock_reminders(db, 2027, NOW) == 0
    assert await send_lock_reminders(db, 2027, NOW + timedelta(hours=4)) == 0
    assert sender.sent == []
