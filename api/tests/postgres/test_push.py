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
from api.services import draft_reminders, notifications, push
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
    assert await push.send_to_users(db, [users[0].id], message, "draft") == 1
    assert [r.endpoint for r in await _rows(db)] == [CHROME + "alive"]


async def test_subscriptions_not_refreshed_for_60_days_are_pruned(
    db: AsyncSession,
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0], CHROME + "stale")
    await _subscribe(db, users[0], CHROME + "fresh")
    await db.execute(
        update(PushSubscription)
        .where(PushSubscription.endpoint == CHROME + "stale")
        .values(last_seen=datetime.now(UTC) - timedelta(days=61))
    )
    assert await push.prune_stale_subscriptions(db) == 1
    assert [r.endpoint for r in await _rows(db)] == [CHROME + "fresh"]


async def test_nothing_is_sent_without_vapid_keys(
    db: AsyncSession, sender: FakeSender
) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0])
    get_settings().vapid_public_key = ""
    assert (
        await push.send_to_users(
            db, [users[0].id], push.PushMessage("t", "b", "/", "x"), "draft"
        )
        == 0
    )
    assert sender.sent == []


async def test_the_owner_on_the_clock_is_notified(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, teams, _ = await make_season(db, teams=2)
    await _subscribe(db, users[1])
    await notifications.notify_on_the_clock(db, season.id, teams[1].id)
    [(endpoint, message)] = sender.sent
    assert endpoint == BODY["endpoint"]
    assert message.title == "You're on the clock"
    assert message.url == f"/leagues/{season.league_id}/draft"
    assert message.urgency == "high"
    # The owner of team 0 has no device.
    await notifications.notify_on_the_clock(db, season.id, teams[0].id)
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
    await db.execute(update(User).values(push_chat=True))
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


async def _chat_message(db: AsyncSession, season: Any, author: User) -> LeagueMessage:
    message = LeagueMessage(
        league_id=season.league_id,
        season_id=season.id,
        author_user_id=author.id,
        author_name="Ann",
        body="hi",
    )
    db.add(message)
    await db.flush()
    return message


async def test_chat_is_off_by_default_and_follows_the_members_choices(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    await _subscribe(db, users[1], CHROME + "dave")
    await _subscribe(db, users[2], CHROME + "pat")
    message = await _chat_message(db, season, users[0])

    await push.notify_league_message(db, message.id)
    assert sender.sent == []

    await db.execute(update(User).where(User.id == users[1].id).values(push_chat=True))
    await db.execute(update(User).where(User.id == users[2].id).values(push_chat=True))
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[2].id)
        .values(chat_muted=True)
    )
    await push.notify_league_message(db, message.id)
    assert [endpoint for endpoint, _ in sender.sent] == [CHROME + "dave"]


async def test_a_burst_of_chat_says_how_many_messages_it_stands_for(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    await db.execute(update(User).values(push_chat=True))
    await _subscribe(db, users[1], CHROME + "dave")
    await _chat_message(db, season, users[0])
    await _chat_message(db, season, users[0])
    last = await _chat_message(db, season, users[0])

    await push.notify_league_message(db, last.id)

    [(_, sent)] = sender.sent
    assert sent.body == "3 new messages in the chat."
    assert sent.tag == f"chat-{season.id}"


async def test_draft_alerts_and_lineup_reminders_can_be_turned_off(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[0], CHROME + "ann")
    await _subscribe(db, users[1], CHROME + "dave")
    await db.execute(
        update(User).where(User.id == users[1].id).values(push_draft_alerts=False)
    )

    await notifications.notify_draft_phase(db, season.id, "lobby")
    assert [endpoint for endpoint, _ in sender.sent] == [CHROME + "ann"]

    message = push.PushMessage(title="t", body="b", url="/", tag="x")
    assert await push.send_to_users(db, [users[0].id], message, "draft") == 1
    await db.execute(update(User).values(push_lineup_reminders=False))
    assert await push.send_to_users(db, [users[0].id], message, "lineup") == 0
    assert await push.send_to_users(db, [users[0].id], message, "draft") == 1


async def test_preferences_round_trip_and_per_league_mute(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        first = await client.get("/api/push/preferences")
        assert first.json() == {
            "draftAlerts": True,
            "lineupReminders": True,
            "chat": False,
            "mentions": True,
            "starterAlerts": True,
            "scoreAlerts": False,
            "roundResults": False,
            "announcements": True,
            "quietHours": False,
            "timezone": None,
            "mutedLeagueIds": [],
        }
        changed = await client.patch(
            "/api/push/preferences", json={"chat": True, "draftAlerts": False}
        )
        assert changed.json()["chat"] is True
        assert changed.json()["draftAlerts"] is False
        assert changed.json()["lineupReminders"] is True

        mute = await client.put(
            f"/api/push/chat-mute/{season.league_id}", json={"muted": True}
        )
        assert mute.status_code == 204
        assert (await client.get("/api/push/preferences")).json()["mutedLeagueIds"] == [
            season.league_id
        ]
        assert (
            await client.put("/api/push/chat-mute/99999", json={"muted": True})
        ).status_code == 404


async def test_draft_phase_push_reaches_every_active_member(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    for i, user in enumerate(users):
        await _subscribe(db, user, f"https://fcm.googleapis.com/send/m{i}")
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[2].id)
        .values(left_at=datetime.now(UTC))
    )
    await notifications.notify_draft_phase(db, season.id, "lobby")
    assert len(sender.sent) == 2
    assert sender.sent[0][1].title == "The draft lobby is open"
    assert sender.sent[0][1].urgency == "high"
    assert sender.sent[0][1].url == f"/leagues/{season.league_id}/draft"


async def test_draft_start_reminder_goes_once_in_the_last_15_minutes(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, draft = await make_season(db, teams=2)
    await _subscribe(db, users[0])
    draft.status = "scheduled"
    draft.start_time = NOW + timedelta(minutes=10)
    await db.flush()
    draft_reminders._sent.clear()

    assert (
        await draft_reminders.send_draft_start_reminders(db, NOW - timedelta(hours=1))
        == 0
    )
    assert await draft_reminders.send_draft_start_reminders(db, NOW) == 1
    assert await draft_reminders.send_draft_start_reminders(db, NOW) == 0
    assert len(sender.sent) == 1
    assert "starts it" in sender.sent[0][1].body
    assert (
        await draft_reminders.send_draft_start_reminders(
            db, NOW + timedelta(minutes=11)
        )
        == 0
    )


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


async def test_a_new_draft_time_pushes_without_the_time_itself(
    db: AsyncSession, sender: FakeSender
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    await _subscribe(db, users[1], CHROME + "dave")
    await notifications.notify_draft_phase(db, season.id, "scheduled")
    [(_, sent)] = sender.sent
    assert sent.title == "The draft time is set"
    assert sent.tag == f"draft-scheduled-{season.id}"
