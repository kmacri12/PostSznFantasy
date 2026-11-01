"""The activity feed through its HTTP seam: events written by the code paths that cause
them, read back per league and per fantasy team, member-only and paginated."""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.activity_models import SettingChange, SettingsChangePayload
from api.services import activity
from api.tests.postgres.activity_support import (
    FUTURE,
    HOUR,
    PAST,
    QB,
    RB,
    ActivityLeague,
    activity_league,
    game,
)
from api.tests.postgres.conftest import ClientFactory


async def test_an_owners_lineup_move_is_in_the_league_and_team_feeds(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    qb = s.players[0]
    async with client_as("uid-1") as owner:
        await owner.post(s.lineup_url, json=s.move(qb, QB))
    async with client_as("uid-0") as commissioner:
        league_feed = (
            await commissioner.get(f"/api/seasons/{s.season.id}/activity")
        ).json()
        team_feed = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
    for feed in (league_feed, team_feed):
        assert [e["kind"] for e in feed["events"]] == ["lineup_move"]
        event = feed["events"][0]
        assert event["actorName"] == "user1"
        assert event["teamId"] == s.team.id
        assert event["createdAt"]
        assert event["payload"]["playerName"] == qb.name
        assert event["payload"]["round"] == 1
        assert event["payload"]["toSlot"] == "QB"
        assert event["payload"]["fromSlot"] is None


async def test_a_move_that_changes_nothing_is_not_an_event(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await owner.post(s.lineup_url, json=s.move(s.players[0], QB))
        await owner.post(s.lineup_url, json=s.move(s.players[0], QB))
        feed = (await owner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert len(feed["events"]) == 1


async def test_a_swap_names_the_displaced_player(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    first, second = s.players[1], s.players[2]
    async with client_as("uid-1") as owner:
        await owner.post(s.lineup_url, json=s.move(first, RB))
        await owner.post(s.lineup_url, json=s.move(second, RB))
        feed = (await owner.get(f"/api/teams/{s.team.id}/activity")).json()
    newest = feed["events"][0]["payload"]
    assert newest["playerName"] == second.name
    assert newest["displaced"]["playerName"] == first.name


async def test_feeds_are_newest_first_and_paginated(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        for player, slot in [
            (s.players[0], QB),
            (s.players[1], RB),
            (s.players[0], None),
        ]:
            await owner.post(s.lineup_url, json=s.move(player, slot))
        url = f"/api/seasons/{s.season.id}/activity"
        first = (await owner.get(url, params={"limit": 2})).json()
        assert [e["payload"]["toSlot"] for e in first["events"]] == [None, "RB"]
        assert first["nextBefore"] == first["events"][-1]["id"]
        rest = (
            await owner.get(url, params={"limit": 2, "before": first["nextBefore"]})
        ).json()
    assert [e["payload"]["toSlot"] for e in rest["events"]] == ["QB"]
    assert rest["nextBefore"] is None


async def test_only_league_members_can_read_the_feeds(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("stranger") as stranger:
        assert (
            await stranger.get(f"/api/seasons/{s.season.id}/activity")
        ).status_code == 403
        assert (
            await stranger.get(f"/api/teams/{s.team.id}/activity")
        ).status_code == 403


async def test_the_team_feed_holds_only_that_teams_events(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await owner.post(s.lineup_url, json=s.move(s.players[0], QB))
    async with client_as("uid-0") as commissioner:
        own_team_feed = (
            await commissioner.get(f"/api/teams/{s.commissioner_team.id}/activity")
        ).json()
    assert own_team_feed["events"] == []


async def _kc_started(db: AsyncSession) -> ActivityLeague:
    """KC (players 0-2) kicked off an hour ago, so moving them is an override."""
    return await activity_league(
        db,
        [
            game("g1", 1, 1, 3, datetime.now(UTC) - HOUR),
            game("g2", 1, 2, 3, FUTURE),
        ],
    )


async def _move(
    client: AsyncClient, s: ActivityLeague, player_index: int, slot: int | None
) -> None:
    await client.post(s.lineup_url, json=s.move(s.players[player_index], slot))


async def _announce(db: AsyncSession, s: ActivityLeague) -> None:
    """A settings change: league news that lights the dot."""
    await activity.append(
        db,
        s.season.id,
        SettingsChangePayload(
            changes=[SettingChange(field="scoringPassingTd", before=4, after=6)]
        ),
    )


async def test_new_activity_is_other_peoples_events_since_the_feed_was_last_viewed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await _move(owner, s, 0, QB)
        mine = (await owner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert mine["hasNew"] is False
    assert [e["isNew"] for e in mine["events"]] == [False]
    async with client_as("uid-0") as commissioner:
        theirs = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert theirs["hasNew"] is True
    assert [e["isNew"] for e in theirs["events"]] == [True]


async def test_ordinary_lineup_moves_do_not_light_the_league_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await _move(owner, s, 0, QB)
    async with client_as("uid-0") as commissioner:
        feed = (await commissioner.get(f"/api/seasons/{s.season.id}/activity")).json()
        seasons = (await commissioner.get("/api/leagues/user-leagues")).json()
    assert [e["kind"] for e in feed["events"]] == ["lineup_move"]
    assert feed["hasNew"] is False
    assert [row["hasNewActivity"] for row in seasons] == [False]


async def test_overrides_corrections_and_settings_changes_light_the_league_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _kc_started(db)
    async with client_as("uid-1") as owner:
        seasons = (await owner.get("/api/leagues/user-leagues")).json()
        assert [row["hasNewActivity"] for row in seasons] == [False]
    async with client_as("uid-0") as commissioner:
        await commissioner.post(
            s.lineup_url, json=s.move(s.players[1], RB, confirmOverride=True)
        )
    async with client_as("uid-1") as owner:
        seasons = (await owner.get("/api/leagues/user-leagues")).json()
        feed = (await owner.get(f"/api/seasons/{s.season.id}/activity")).json()
    assert [row["hasNewActivity"] for row in seasons] == [True]
    assert feed["hasNew"] is True


async def test_expanding_the_feed_clears_new_and_only_later_events_are_new_again(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    url = f"/api/seasons/{s.season.id}/activity"
    await _announce(db, s)
    async with client_as("uid-0") as commissioner:
        assert (await commissioner.post(f"{url}/viewed")).status_code == 204
        seen = (await commissioner.get(url)).json()
    await _announce(db, s)
    async with client_as("uid-0") as commissioner:
        later = (await commissioner.get(url)).json()
    assert (seen["hasNew"], [e["isNew"] for e in seen["events"]]) == (False, [False])
    assert later["hasNew"] is True
    assert [e["isNew"] for e in later["events"]] == [True, False]


async def test_viewing_up_to_an_event_leaves_newer_ones_new(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    url = f"/api/seasons/{s.season.id}/activity"
    await _announce(db, s)
    await _announce(db, s)
    async with client_as("uid-0") as commissioner:
        events = (await commissioner.get(url)).json()["events"]
        await commissioner.post(f"{url}/viewed", json={"upToEventId": events[-1]["id"]})
        after = (await commissioner.get(url)).json()
    assert [e["isNew"] for e in after["events"]] == [True, False]
    assert after["hasNew"] is True


async def test_each_feed_remembers_its_own_view(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await _move(owner, s, 0, QB)
    await _announce(db, s)
    async with client_as("uid-0") as commissioner:
        await commissioner.post(f"/api/teams/{s.team.id}/activity/viewed")
        team_feed = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
        league_feed = (
            await commissioner.get(f"/api/seasons/{s.season.id}/activity")
        ).json()
    assert team_feed["hasNew"] is False
    assert league_feed["hasNew"] is True


async def test_activity_from_before_you_joined_is_not_new(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    await activity.append(
        db,
        s.season.id,
        SettingsChangePayload(changes=[SettingChange(field="x", before=1, after=2)]),
        at=PAST,
    )
    async with client_as("uid-0") as commissioner:
        feed = (await commissioner.get(f"/api/seasons/{s.season.id}/activity")).json()
    assert feed["hasNew"] is False
    assert [e["isNew"] for e in feed["events"]] == [False]


async def test_the_league_list_flags_leagues_with_new_activity(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    await _announce(db, s)
    async with client_as("uid-0") as commissioner:
        before = (await commissioner.get("/api/leagues/user-leagues")).json()
        await commissioner.post(f"/api/seasons/{s.season.id}/activity/viewed")
        after = (await commissioner.get("/api/leagues/user-leagues")).json()
    assert [row["hasNewActivity"] for row in before] == [True]
    assert [row["hasNewActivity"] for row in after] == [False]
