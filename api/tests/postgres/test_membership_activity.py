"""League membership in the activity feed: creation, joins, leaves and role changes
are written with the change, light the nav dot (except league creation), and are
reconstructed for leagues that existed before they were logged."""

import importlib.util
from pathlib import Path
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, Team, User
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

_spec = importlib.util.spec_from_file_location(
    "membership_migration",
    Path(__file__).parents[2] / "alembic/versions/0016_membership_activity.py",
)
assert _spec and _spec.loader
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)


async def _feed(client: AsyncClient, season_id: int) -> dict[str, Any]:
    feed: dict[str, Any] = (
        await client.get(f"/api/seasons/{season_id}/activity")
    ).json()
    return feed


async def _nav_dot(client: AsyncClient, league_id: int) -> bool:
    leagues = (await client.get("/api/leagues/user-leagues")).json()
    league = next(entry for entry in leagues if entry["id"] == league_id)
    return bool(league["hasNewActivity"])


async def _joinable_league(db: AsyncSession) -> tuple[int, int, str]:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    db.add(Team(name="Open", season_id=season.id))
    db.add(User(supabase_uid="newbie", username="newbie", email="n@x.co"))
    await db.flush()
    return season.league_id, season.id, "newbie"


async def test_a_new_league_starts_with_its_creation_and_the_creator_as_commissioner(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    db.add(User(supabase_uid="creator", username="creator", email="c@x.co"))
    await db.flush()
    async with client_as("creator") as creator:
        created = await creator.post(
            "/api/leagues/create-league",
            json={
                "leagueName": "Fresh",
                "rosterSettings": {"numberTeams": 4},
                "teamUnitSettings": {"teamQb": False, "teamK": False},
            },
        )
        assert created.status_code == 201
        body = created.json()
        feed = await _feed(creator, body["seasonId"])
        dot = await _nav_dot(creator, body["leagueId"])
    oldest_first = list(reversed(feed["events"]))
    assert [e["kind"] for e in oldest_first] == ["league_created", "membership_joined"]
    assert oldest_first[0]["payload"] == {"leagueName": "Fresh"}
    assert oldest_first[1]["payload"] == {"role": "commissioner", "teamName": "Team 1"}
    assert {e["actorName"] for e in feed["events"]} == {"creator"}
    assert dot is False and feed["hasNew"] is False


async def test_joining_leaving_and_role_changes_are_logged_with_their_actor(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id, uid = await _joinable_league(db)
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
    async with client_as(uid) as newbie:
        await newbie.post(f"/api/invites/{code}/join")
        await newbie.post(f"/api/invites/{code}/join")  # a replay logs nothing
    newbie_id = await db.scalar(select(User.id).where(User.supabase_uid == uid))
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{league_id}/members/{newbie_id}",
            json={"role": "commissioner"},
        )
        await commissioner.patch(  # same role again: nothing changed, nothing logged
            f"/api/leagues/{league_id}/members/{newbie_id}",
            json={"role": "commissioner"},
        )
        await commissioner.patch(
            f"/api/leagues/{league_id}/members/{newbie_id}", json={"role": "member"}
        )
        await commissioner.delete(f"/api/leagues/{league_id}/members/{newbie_id}")
        events = list(reversed((await _feed(commissioner, season_id))["events"]))

    assert [(e["kind"], e["actorName"]) for e in events] == [
        ("membership_joined", "newbie"),
        ("role_changed", "user0"),
        ("role_changed", "user0"),
        ("membership_left", "user0"),
    ]
    assert events[0]["payload"] == {"role": "member", "teamName": "Open"}
    assert events[1]["payload"] == {
        "userId": newbie_id,
        "userName": "newbie",
        "role": "commissioner",
    }
    assert events[2]["payload"]["role"] == "member"
    assert events[3]["payload"] == {"userId": newbie_id, "userName": "newbie"}


async def test_leaving_on_your_own_is_the_members_own_event(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{season.league_id}/members/{users[1].id}",
            json={"role": "commissioner"},
        )
    async with client_as("uid-1") as member:
        await member.delete(f"/api/leagues/{season.league_id}/members/{users[1].id}")
    async with client_as("uid-0") as commissioner:
        newest = (await _feed(commissioner, season.id))["events"][0]
    assert (newest["kind"], newest["actorUserId"]) == ("membership_left", users[1].id)


async def test_membership_changes_light_the_dot_for_others_and_clear_on_viewing(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id, uid = await _joinable_league(db)
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
        await commissioner.post(f"/api/seasons/{season_id}/activity/viewed", json={})
        assert await _nav_dot(commissioner, league_id) is False
    async with client_as(uid) as newbie:
        await newbie.post(f"/api/invites/{code}/join")
    newbie_id = await db.scalar(select(User.id).where(User.supabase_uid == uid))

    async with client_as("uid-0") as commissioner:
        assert await _nav_dot(commissioner, league_id) is True  # a join
        assert (await _feed(commissioner, season_id))["hasNew"] is True
        await commissioner.post(f"/api/seasons/{season_id}/activity/viewed", json={})
        assert await _nav_dot(commissioner, league_id) is False
        await commissioner.patch(
            f"/api/leagues/{league_id}/members/{newbie_id}",
            json={"role": "commissioner"},
        )
        assert await _nav_dot(commissioner, league_id) is False  # their own doing
    async with client_as("uid-1") as other:
        assert await _nav_dot(other, league_id) is True  # a role change
        await other.post(f"/api/seasons/{season_id}/activity/viewed", json={})
        assert await _nav_dot(other, league_id) is False
    async with client_as(uid) as newcomer:
        await newcomer.delete(f"/api/leagues/{league_id}/members/{newbie_id}")
    async with client_as("uid-1") as other:
        assert await _nav_dot(other, league_id) is True  # a leave


async def test_a_brand_new_member_sees_the_dot_on_first_visit(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id, uid = await _joinable_league(db)
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
        await commissioner.patch(
            f"/api/leagues/{league_id}/members/{(await _user_id(db, 'uid-1'))}",
            json={"role": "commissioner"},
        )
    async with client_as(uid) as newcomer:
        await newcomer.post(f"/api/invites/{code}/join")
        views = await db.scalar(text("SELECT count(*) FROM fantasy.activity_views"))
        assert views == 0
        assert await _nav_dot(newcomer, league_id) is True
        feed = await _feed(newcomer, season_id)
        assert feed["hasNew"] is True
        assert any(e["isNew"] for e in feed["events"])
        await newcomer.post(f"/api/seasons/{season_id}/activity/viewed", json={})
        assert await _nav_dot(newcomer, league_id) is False
        assert (await _feed(newcomer, season_id))["hasNew"] is False


async def _user_id(db: AsyncSession, uid: str) -> int:
    user_id = await db.scalar(select(User.id).where(User.supabase_uid == uid))
    assert user_id is not None
    return user_id


async def test_league_creation_alone_does_not_light_the_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    from api.models.activity_models import LeagueCreatedPayload
    from api.services import activity

    await activity.append(
        db,
        season.id,
        LeagueCreatedPayload(league_name="x"),
        actor=activity.Actor(users[0].id, "user0"),
    )
    async with client_as("uid-1") as member:
        assert await _nav_dot(member, season.league_id) is False
        assert (await _feed(member, season.id))["hasNew"] is False


async def _run_backfill(db: AsyncSession) -> None:
    for statement in migration.BACKFILL.split(";\n\n"):
        if statement.strip():
            await db.execute(text(statement))


async def test_the_migration_backfills_existing_leagues_once(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, teams, _ = await make_season(db, teams=3)
    # user 2 was promoted, user 1 left; the feed then predates this feature.
    from datetime import UTC, datetime

    from api.db.models import LeagueMember

    for offset, member in enumerate(
        await db.scalars(
            select(LeagueMember)
            .where(LeagueMember.league_id == season.league_id)
            .order_by(LeagueMember.user_id)
        )
    ):
        member.joined_at = datetime(2030, 1, 1 + offset, tzinfo=UTC)
        if member.user_id == users[2].id:
            member.role = "commissioner"
        if member.user_id == users[1].id:
            member.left_at = datetime(2030, 1, 9, tzinfo=UTC)
    await db.flush()

    await _run_backfill(db)
    await _run_backfill(db)  # idempotent

    async with client_as("uid-0") as creator:
        events = list(reversed((await _feed(creator, season.id))["events"]))
    assert [
        (e["kind"], e["actorName"] or e["payload"].get("userName")) for e in events
    ] == [
        ("league_created", "user0"),
        ("membership_joined", "user0"),
        ("membership_joined", "user1"),
        ("membership_joined", "user2"),
        ("role_changed", "user2"),
        ("membership_left", "user1"),
    ]
    assert events[0]["payload"] == {"leagueName": "Test League"}
    assert events[1]["payload"] == {"role": "commissioner", "teamName": teams[0].name}
    assert events[3]["payload"]["role"] == "member"
    total = await db.scalar(select(text("count(*)")).select_from(ActivityEvent))
    assert total == 6
