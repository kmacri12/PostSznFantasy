"""Player and score alerts (#391): a hurt starter, a touchdown, round results and
eliminations, each once, through the inbox, and held back overnight."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    AlertSent,
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLTeam,
    Notification,
    PushSubscription,
    SeasonStanding,
    Team,
    TeamPlayer,
    User,
)
from api.services import push
from api.services.player_alerts import (
    send_round_alerts,
    send_score_alerts,
    send_starter_out_alerts,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

NOW = datetime(2027, 1, 9, 15, tzinfo=UTC)
QB, RB, BENCH_RB = 1000, 1001, 1002


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, push.PushMessage]]:
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_public_key", "public")
    monkeypatch.setattr(settings, "vapid_private_key", "private")
    monkeypatch.setattr(settings, "vapid_subject", "mailto:owner@example.com")
    monkeypatch.setattr(push, "_now", lambda: NOW)
    deliveries: list[tuple[str, push.PushMessage]] = []

    def deliver(subscription: PushSubscription, message: push.PushMessage) -> int:
        deliveries.append((subscription.endpoint, message))
        return 201

    monkeypatch.setattr(push, "_deliver", deliver)
    return deliveries


def _game(game_id: str, week: int, status: str, kickoff: datetime) -> NFLGame:
    return NFLGame(
        id=game_id,
        season=2027,
        season_type="post",
        game_week=week,
        game_status=status,
        game_time_epoch=str(int(kickoff.timestamp())),
        team_id_home=1000,
        team_id_away=2000,
        home_pts=24 if status == "Completed" else None,
        away_pts=17 if status == "Completed" else None,
    )


async def _setup(
    db: AsyncSession, *, status: str = "Scheduled", kickoff: datetime = NOW
) -> tuple[list[User], list[Team], int]:
    """Two teams of a drafted 2027 league; team 0 starts a QB and an RB with an RB on
    the bench, all on the home team of one Wild Card game; every owner has a device."""
    season, users, teams, _ = await make_season(
        db, teams=2, year=2027, draft_status="completed", roster_total=3,
        roster_num_qb=1, roster_num_rb=1, roster_num_wr=0, roster_num_te=0,
        roster_num_flex_wr_rb_te=0, roster_num_k=0, roster_num_dst=0,
        roster_num_bench=1,
    )  # fmt: skip
    await make_players(db, ["QB", "RB", "RB"], first_id=QB)
    db.add(NFLTeam(id=2000, team_abv="AWY", is_active=True, in_playoffs=True))
    db.add(_game("g1", 19, status, kickoff))
    db.add_all(
        TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=pid)
        for pid in (QB, RB, BENCH_RB)
    )
    db.add(NFLPlayer(id=1003, name="Player 3", position="QB", team_id=1000))
    await db.flush()
    db.add(TeamPlayer(team_id=teams[1].id, season_id=season.id, player_id=1003))
    db.add_all(
        LineupSlot(team_id=teams[0].id, round=1, player_id=pid, slot_index=index)
        for index, pid in enumerate((QB, RB, BENCH_RB))
    )
    db.add_all(
        PushSubscription(
            user_id=u.id,
            endpoint=f"https://fcm.googleapis.com/fcm/send/{u.username}",
            p256dh="k",
            auth="a",
        )
        for u in users
    )
    await db.flush()
    return users, teams, season.league_id


async def _inbox(db: AsyncSession) -> list[Notification]:
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


async def _set_injury(db: AsyncSession, player_id: int, status: str | None) -> None:
    await db.execute(
        update(NFLPlayer).where(NFLPlayer.id == player_id).values(injury_status=status)
    )


async def test_a_starter_ruled_out_before_lock_is_alerted_once(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    users, teams, league_id = await _setup(db, kickoff=NOW + timedelta(hours=5))
    await _set_injury(db, RB, "Out")

    assert await send_starter_out_alerts(db, 2027, NOW) == 1
    assert await send_starter_out_alerts(db, 2027, NOW + timedelta(minutes=3)) == 0

    [(endpoint, message)] = sent
    assert endpoint.endswith(users[0].username)
    assert message.title == "Player 1 is ruled Out"
    assert message.urgency == "high"
    assert message.tag == f"starter-out-{teams[0].id}-1"
    [entry] = await _inbox(db)
    assert (entry.user_id, entry.kind) == (users[0].id, "starter_out")
    assert entry.payload == {
        "seasonId": teams[0].season_id,
        "teamId": teams[0].id,
        "round": 1,
    }


async def test_two_hurt_starters_go_out_as_one_alert(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    await _setup(db, kickoff=NOW + timedelta(hours=5))
    await _set_injury(db, QB, "Doubtful")
    await _set_injury(db, RB, "Out")
    assert await send_starter_out_alerts(db, 2027, NOW) == 1
    [(_, message)] = sent
    assert message.title == "2 of your starters are hurt"
    assert "Player 0" in message.body and "Player 1" in message.body


@pytest.mark.parametrize(
    ("status", "player_id", "kickoff_in"),
    [
        ("Questionable", RB, timedelta(hours=5)),  # not a ruling
        ("Out", BENCH_RB, timedelta(hours=5)),  # not a starter
        ("Out", RB, timedelta(hours=-1)),  # locked: he has played or is playing
    ],
)
async def test_no_alert_for_a_starter_who_cannot_be_swapped_or_is_not_out(
    db: AsyncSession,
    sent: list[tuple[str, push.PushMessage]],
    status: str,
    player_id: int,
    kickoff_in: timedelta,
) -> None:
    await _setup(db, kickoff=NOW + kickoff_in)
    await _set_injury(db, player_id, status)
    assert await send_starter_out_alerts(db, 2027, NOW) == 0
    assert sent == [] and await _inbox(db) == []


async def test_turning_the_preference_off_keeps_the_inbox_entry_but_not_the_push(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    users, _, _ = await _setup(db, kickoff=NOW + timedelta(hours=5))
    await db.execute(update(User).values(push_starter_alerts=False))
    await _set_injury(db, RB, "Out")
    await send_starter_out_alerts(db, 2027, NOW)
    assert sent == []
    assert [e.user_id for e in await _inbox(db)] == [users[0].id]


async def test_quiet_hours_hold_the_push_in_the_members_own_zone(
    db: AsyncSession,
    sent: list[tuple[str, push.PushMessage]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    users, _, _ = await _setup(db, kickoff=NOW + timedelta(hours=5))
    await db.execute(update(User).values(quiet_hours=True, timezone="America/New_York"))
    await _set_injury(db, RB, "Out")
    message = push.PushMessage("t", "b", "/", "x")

    midnight_in_new_york = datetime(2027, 1, 9, 5, tzinfo=UTC)
    monkeypatch.setattr(push, "_now", lambda: midnight_in_new_york)
    assert await push.send_to_users(db, [users[0].id], message, "starter") == 0
    # Draft alerts are not player alerts: they still come through.
    assert await push.send_to_users(db, [users[0].id], message, "draft") == 1

    monkeypatch.setattr(push, "_now", lambda: midnight_in_new_york + timedelta(hours=8))
    assert await push.send_to_users(db, [users[0].id], message, "starter") == 1


def test_quiet_hours_are_11pm_to_7am() -> None:
    zone = "America/Los_Angeles"

    def at(local_hour: int) -> datetime:
        # January: Los Angeles is UTC-8.
        return datetime(2027, 1, 9, local_hour, tzinfo=UTC) + timedelta(hours=8)

    assert push.in_quiet_hours(zone, at(23))
    assert push.in_quiet_hours(zone, at(6))
    assert not push.in_quiet_hours(zone, at(7))
    assert not push.in_quiet_hours(zone, at(22))
    assert push.in_quiet_hours("Not/AZone", datetime(2027, 1, 9, 2, tzinfo=UTC))


async def _score(db: AsyncSession, player_id: int, **stats: int) -> None:
    existing = await db.get(NFLPlayerGameStats, ("g1", player_id))
    if existing is None:
        db.add(NFLPlayerGameStats(game_id="g1", player_id=player_id, **stats))
    else:
        for name, value in stats.items():
            setattr(existing, name, value)
    await db.flush()


async def test_a_starters_touchdown_is_one_push_and_a_burst_collapses(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    users, teams, league_id = await _setup(
        db, status="Live - In Progress", kickoff=NOW - timedelta(hours=1)
    )
    await db.execute(update(User).values(push_score_alerts=True))
    await _score(db, QB, passing_touchdowns=1)

    assert await send_score_alerts(db, 2027, ["g1"], NOW) == 1
    assert await send_score_alerts(db, 2027, ["g1"], NOW + timedelta(minutes=1)) == 0
    [(endpoint, message)] = sent
    assert endpoint.endswith(users[0].username)
    assert (message.title, message.tag) == ("Touchdown!", f"td-{teams[0].id}-g1")
    assert "Player 0" in message.body

    # Two more inside the throttle wait, then go out together.
    await _score(db, QB, passing_touchdowns=2)
    await _score(db, RB, rushing_touchdowns=1)
    assert await send_score_alerts(db, 2027, ["g1"], NOW + timedelta(minutes=2)) == 0
    assert await send_score_alerts(db, 2027, ["g1"], NOW + timedelta(minutes=5)) == 1
    assert sent[1][1].title == "2 touchdowns!"
    assert await send_score_alerts(db, 2027, ["g1"], NOW + timedelta(minutes=9)) == 0
    assert len(sent) == 2
    assert len(await _inbox(db)) == 1  # unread repeats move up instead of piling up


async def test_score_alerts_are_off_by_default_and_skip_bench_players(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    users, _, _ = await _setup(
        db, status="Live - In Progress", kickoff=NOW - timedelta(hours=1)
    )
    await _score(db, BENCH_RB, rushing_touchdowns=1)
    assert await send_score_alerts(db, 2027, ["g1"], NOW) == 0

    await _score(db, RB, receiving_touchdowns=1)
    assert await send_score_alerts(db, 2027, ["g1"], NOW) == 1
    assert sent == []  # opt-in, so no push
    assert [e.user_id for e in await _inbox(db)] == [users[0].id]


async def _standings(db: AsyncSession, team: Team, left: int, **rounds: str) -> None:
    values = {
        k: Decimal(rounds.get(k, "0"))
        for k in ("wild_card", "divisional", "conf_champ", "super_bowl")
    }
    db.add(
        SeasonStanding(
            season_id=team.season_id,
            team_id=team.id,
            rank=1,
            players_left=left,
            total=sum(values.values(), Decimal(0)),
            **values,
        )
    )
    await db.flush()


async def test_round_result_and_elimination_go_out_once_each(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    users, teams, league_id = await _setup(
        db, status="Completed", kickoff=NOW - timedelta(hours=5)
    )
    await db.execute(update(User).values(push_round_results=True))
    await _standings(db, teams[0], 2, wild_card="20.5")
    await _standings(db, teams[1], 0, wild_card="3")

    assert await send_round_alerts(db, 2027, NOW) == 2
    assert await send_round_alerts(db, 2027, NOW + timedelta(minutes=3)) == 0

    by_user = {u.id: u.username for u in users}
    entries = {e.kind: e for e in await _inbox(db)}
    assert by_user[entries["round_result"].user_id] == "user0"
    assert by_user[entries["team_eliminated"].user_id] == "user1"
    messages = {m.title: m for _, m in sent}
    result = messages["Wild Card is final"]
    assert result.body == "Test League: you're 1st with 20.5 points (20.5 this round)."
    assert result.url == f"/leagues/{league_id}"
    out = messages["Your last player's team lost"]
    assert out.body == (
        "You're out of players in Test League. Currently 2nd with 3 points."
    )
    assert entries["round_result"].payload == {
        "seasonId": teams[0].season_id,
        "teamId": teams[0].id,
        "round": 1,
    }


async def test_the_round_result_says_how_far_a_team_moved(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    _, teams, _ = await _setup(db, status="Completed", kickoff=NOW - timedelta(days=9))
    db.add(_game("g2", 20, "Completed", NOW - timedelta(days=2)))
    await db.execute(update(User).values(push_round_results=True))
    await _standings(db, teams[0], 1, wild_card="10")
    await _standings(db, teams[1], 1, wild_card="5", divisional="20")

    assert await send_round_alerts(db, 2027, NOW) == 2
    assert {m.title for _, m in sent} == {"Divisional is final"}
    assert sorted(m.body for _, m in sent) == [
        "Test League: you're 1st, up 1 with 25 points (20 this round).",
        "Test League: you're 2nd, down 1 with 10 points (0 this round).",
    ]


async def test_nothing_goes_out_before_a_game_is_final(
    db: AsyncSession, sent: list[tuple[str, push.PushMessage]]
) -> None:
    _, teams, _ = await _setup(db, status="Live - In Progress")
    await _standings(db, teams[0], 0)
    assert await send_round_alerts(db, 2027, NOW) == 0
    assert sent == [] and (await db.execute(select(AlertSent))).first() is None


async def test_alert_preferences_round_trip_with_a_validated_time_zone(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db, teams=2)
    async with client_as("uid-1") as client:
        first = (await client.get("/api/push/preferences")).json()
        assert first["starterAlerts"] is True
        assert (first["scoreAlerts"], first["roundResults"]) == (False, False)
        assert (first["quietHours"], first["timezone"]) == (False, None)

        changed = (
            await client.patch(
                "/api/push/preferences",
                json={
                    "scoreAlerts": True,
                    "quietHours": True,
                    "timezone": "America/Chicago",
                },
            )
        ).json()
        assert changed["scoreAlerts"] is True
        assert changed["starterAlerts"] is True
        assert (changed["quietHours"], changed["timezone"]) == (
            True,
            "America/Chicago",
        )
        bad = await client.patch(
            "/api/push/preferences", json={"timezone": "Mars/Base"}
        )
        assert bad.status_code == 422
