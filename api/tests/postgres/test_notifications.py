"""The notification inbox (#397): `notify` writes the inbox and the push in one place."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    League,
    LeagueMember,
    NFLGame,
    NFLTeam,
    Notification,
    PushSubscription,
    TeamPlayer,
    User,
)
from api.services import notifications, push
from api.services.lineup_reminders import send_lock_reminders
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

CHROME = "https://fcm.googleapis.com/fcm/send/"
NOW = datetime(2027, 1, 9, 12, tzinfo=UTC)


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


async def _subscribe(db: AsyncSession, user: User) -> None:
    db.add(
        PushSubscription(
            user_id=user.id, endpoint=CHROME + user.username, p256dh="k", auth="a"
        )
    )
    await db.flush()


async def _entries(db: AsyncSession) -> list[Notification]:
    return list(
        (
            await db.execute(
                select(Notification)
                .order_by(Notification.id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


def _notice(league_id: int, **payload: int) -> notifications.Notice:
    return notifications.Notice(
        kind="draft_turn",
        league_id=league_id,
        payload=payload or {"seasonId": 1},
        push=push.PushMessage("t", "b", "/", "tag"),
    )


async def test_every_recipient_gets_an_entry_and_only_willing_devices_a_push(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    for user in users:
        await _subscribe(db, user)
    await db.execute(
        update(User).where(User.id == users[1].id).values(push_draft_alerts=False)
    )

    await notifications.notify(
        db, [u.id for u in users], _notice(season.league_id, seasonId=season.id)
    )

    assert sorted(e.user_id for e in await _entries(db)) == sorted(u.id for u in users)
    assert sorted(endpoint for endpoint, _ in sent) == sorted(
        CHROME + u.username for u in (users[0], users[2])
    )


async def test_the_inbox_fills_without_push_set_up(db: AsyncSession) -> None:
    season, users, teams, _ = await make_season(db, teams=2)
    assert not get_settings().push_enabled
    await notifications.notify_on_the_clock(db, season.id, teams[1].id)
    [entry] = await _entries(db)
    assert (entry.user_id, entry.kind) == (users[1].id, "draft_turn")
    assert entry.payload == {"seasonId": season.id, "teamId": teams[1].id}


async def test_a_repeat_of_an_unread_entry_moves_it_up_instead_of_adding_one(
    db: AsyncSession,
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    notice = _notice(season.league_id, seasonId=season.id)
    await notifications.notify(db, [users[0].id], notice)
    [first] = await _entries(db)
    await notifications.notify(db, [users[0].id], notice)
    [again] = await _entries(db)
    assert again.id == first.id
    assert again.created_at >= first.created_at

    await notifications.mark_read(db, users[0].id, None)
    await notifications.notify(db, [users[0].id], notice)
    assert len(await _entries(db)) == 2


async def test_draft_phase_reaches_every_active_members_inbox(db: AsyncSession) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[2].id)
        .values(left_at=datetime.now(UTC))
    )
    await notifications.notify_draft_phase(db, season.id, "started")
    entries = await _entries(db)
    assert sorted(e.user_id for e in entries) == [users[0].id, users[1].id]
    assert {e.kind for e in entries} == {"draft_started"}


async def test_the_inbox_lists_recent_entries_and_marks_them_read(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    member = users[1]
    db.add_all(
        [
            Notification(
                user_id=member.id,
                kind="draft_lobby",
                league_id=season.league_id,
                payload={"seasonId": season.id},
                created_at=datetime.now(UTC) - timedelta(hours=2),
            ),
            Notification(
                user_id=member.id,
                kind="draft_turn",
                league_id=season.league_id,
                payload={"seasonId": season.id, "teamId": 5},
            ),
            Notification(
                user_id=member.id,
                kind="draft_soon",
                league_id=season.league_id,
                payload={"seasonId": season.id},
                created_at=datetime.now(UTC) - timedelta(days=31),
            ),
            Notification(
                user_id=users[0].id,
                kind="draft_turn",
                league_id=season.league_id,
                payload={"seasonId": season.id},
            ),
        ]
    )
    await db.flush()

    async with client_as("uid-1") as client:
        body = (await client.get("/api/notifications")).json()
        assert body["unreadCount"] == 2
        assert [i["kind"] for i in body["items"]] == ["draft_turn", "draft_lobby"]
        newest = body["items"][0]
        assert newest["leagueId"] == season.league_id
        assert newest["leagueName"] == "Test League"
        assert newest["payload"] == {"seasonId": season.id, "teamId": 5}
        assert newest["read"] is False

        read_one = await client.post(
            "/api/notifications/read", json={"ids": [newest["id"]]}
        )
        assert read_one.status_code == 204
        body = (await client.get("/api/notifications")).json()
        assert body["unreadCount"] == 1
        assert [i["read"] for i in body["items"]] == [True, False]

        await client.post("/api/notifications/read", json={})
        assert (await client.get("/api/notifications")).json()["unreadCount"] == 0

    async with client_as("uid-0") as other:
        assert (await other.get("/api/notifications")).json()["unreadCount"] == 1


async def test_entries_from_a_deleted_or_left_league_are_hidden(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    await notifications.notify(
        db, [users[0].id, users[1].id], _notice(season.league_id)
    )
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[1].id)
        .values(left_at=datetime.now(UTC))
    )
    async with client_as("uid-1") as former:
        assert (await former.get("/api/notifications")).json()["items"] == []
    await db.execute(
        update(League)
        .where(League.id == season.league_id)
        .values(deleted_at=datetime.now(UTC))
    )
    async with client_as("uid-0") as commissioner:
        assert (await commissioner.get("/api/notifications")).json() == {
            "items": [],
            "unreadCount": 0,
        }


async def test_a_caller_with_no_user_row_yet_has_an_empty_inbox(
    client_as: ClientFactory,
) -> None:
    async with client_as("nobody") as client:
        assert (await client.get("/api/notifications")).json() == {
            "items": [],
            "unreadCount": 0,
        }
        assert (
            await client.post("/api/notifications/read", json={})
        ).status_code == 204


async def test_entries_older_than_30_days_are_pruned(db: AsyncSession) -> None:
    season, users, _, _ = await make_season(db, teams=2)
    await notifications.notify(db, [users[0].id], _notice(season.league_id))
    db.add(
        Notification(
            user_id=users[0].id,
            kind="draft_soon",
            league_id=season.league_id,
            payload={"seasonId": season.id},
            created_at=datetime.now(UTC) - timedelta(days=31),
        )
    )
    await db.flush()
    assert await notifications.prune_old(db) == 1
    assert [e.kind for e in await _entries(db)] == ["draft_turn"]


async def test_a_lock_reminder_reaches_an_owner_without_a_device(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    season, users, teams, _ = await make_season(
        db, teams=2, year=2027, draft_status="completed", roster_total=1,
        roster_num_qb=1, roster_num_rb=0, roster_num_wr=0, roster_num_te=0,
        roster_num_flex_wr_rb_te=0, roster_num_k=0, roster_num_dst=0,
        roster_num_bench=0,
    )  # fmt: skip
    [qb] = await make_players(db, ["QB"], first_id=1000)
    db.add(NFLTeam(id=2000, team_abv="AWY", is_active=True, in_playoffs=True))
    db.add(
        NFLGame(
            id="g1",
            season=2027,
            season_type="post",
            game_week=19,
            game_status="Scheduled",
            game_time_epoch=str(int((NOW + timedelta(minutes=30)).timestamp())),
            team_id_home=1000,
            team_id_away=2000,
        )  # fmt: skip
    )
    db.add(TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=qb.id))
    await db.flush()

    assert await send_lock_reminders(db, 2027, NOW) == 1
    [entry] = await _entries(db)
    assert entry.user_id == users[0].id
    assert entry.kind == "lineup_lock"
    assert entry.payload == {"seasonId": season.id, "teamId": teams[0].id, "round": 1}
    assert sent == []


async def test_a_commissioner_changing_someone_elses_lineup_tells_the_owner(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    season, users, teams, _ = await make_season(
        db, teams=2, roster_total=2, roster_num_qb=1, roster_num_rb=0,
        roster_num_wr=0, roster_num_te=0, roster_num_flex_wr_rb_te=0,
        roster_num_k=0, roster_num_dst=0, roster_num_bench=1,
    )  # fmt: skip
    [qb] = await make_players(db, ["QB"], first_id=1000)
    db.add(TeamPlayer(team_id=teams[1].id, season_id=season.id, player_id=qb.id))
    await db.flush()
    spawned: list[tuple[Any, ...]] = []
    monkeypatch.setattr(push, "spawn", lambda fn, *args: spawned.append((fn, *args)))
    move = {"round": 1, "playerId": qb.id, "slotIndex": 0}

    async with client_as("uid-1") as owner:
        assert (
            await owner.post(f"/api/teams/{teams[1].id}/lineup", json=move)
        ).status_code == 200
    assert spawned == []
    async with client_as("uid-0") as commissioner:
        assert (
            await commissioner.post(
                f"/api/teams/{teams[1].id}/lineup", json={**move, "slotIndex": 1}
            )
        ).status_code == 200
    assert spawned == [(notifications.notify_lineup_changed, teams[1].id, 1)]

    await notifications.notify_lineup_changed(db, teams[1].id, 1)
    [entry] = await _entries(db)
    assert (entry.user_id, entry.kind) == (users[1].id, "lineup_changed")
    assert entry.payload == {"seasonId": season.id, "teamId": teams[1].id, "round": 1}
