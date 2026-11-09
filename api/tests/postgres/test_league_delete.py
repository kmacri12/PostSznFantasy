"""Deleting a league is a soft delete of the permanent league (#231)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, Draft, League, LeagueInvite
from api.services import draft_clock, draft_flow
from api.services.draft_picks import PickNotDue
from api.services.live_leagues import delete_league, restore_league
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

NAME = "Test League"


async def _delete(client, league_id: int, name: str = NAME):  # type: ignore[no-untyped-def]
    return await client.request(
        "DELETE", f"/api/leagues/{league_id}", json={"leagueName": name}
    )


async def test_a_commissioner_deletes_the_league_and_the_row_stays(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-0") as commissioner:
        response = await _delete(commissioner, season.league_id)
    assert response.status_code == 204
    league = await db.get(League, season.league_id)
    assert league is not None
    assert league.deleted_at is not None
    assert league.deleted_by == users[0].id


async def test_only_a_commissioner_may_delete(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-1") as member:
        response = await _delete(member, season.league_id)
    assert response.status_code == 403
    league = await db.get(League, season.league_id)
    assert league is not None and league.deleted_at is None


@pytest.mark.parametrize("name", ["", "test league", "Other"])
async def test_the_typed_name_must_match_exactly(
    db: AsyncSession, client_as: ClientFactory, name: str
) -> None:
    season, _, _, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-0") as commissioner:
        response = await _delete(commissioner, season.league_id, name)
    assert response.status_code == 422
    league = await db.get(League, season.league_id)
    assert league is not None and league.deleted_at is None


@pytest.mark.parametrize("status", ["in_progress", "paused"])
async def test_a_running_draft_blocks_the_delete(
    db: AsyncSession, client_as: ClientFactory, status: str
) -> None:
    season, _, _, _ = await make_season(db, draft_status=status)
    async with client_as("uid-0") as commissioner:
        response = await _delete(commissioner, season.league_id)
    assert response.status_code == 409
    league = await db.get(League, season.league_id)
    assert league is not None and league.deleted_at is None


async def test_a_deleted_league_answers_404_with_a_code_to_former_members(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-0") as commissioner:
        await _delete(commissioner, season.league_id)
    async with client_as("uid-1") as member:
        for path in (
            f"/api/leagues/{season.league_id}",
            f"/api/seasons/{season.id}",
            f"/api/seasons/{season.id}/standings",
            f"/api/teams/{teams[1].id}",
            f"/api/seasons/{season.id}/activity",
            f"/api/drafts/draft-info/{season.id}",
        ):
            response = await member.get(path)
            assert response.status_code == 404, path
            body = response.json()
            assert body["code"] == "leagueDeleted", path
            assert body["leagueName"] == NAME
            assert body["deletedAt"]


async def test_non_members_get_the_same_403_as_for_a_live_league(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    from api.db.models import User

    season, _, _, _ = await make_season(db, draft_status="completed")
    db.add(User(supabase_uid="stranger", username="s", email="s@x.co"))
    await db.flush()
    async with client_as("uid-0") as commissioner:
        await _delete(commissioner, season.league_id)
    async with client_as("stranger") as stranger:
        response = await stranger.get(f"/api/leagues/{season.league_id}")
    assert response.status_code == 403
    assert "code" not in response.json()


async def test_the_league_leaves_the_list_and_the_nav_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, draft_status="completed")
    db.add(
        ActivityEvent(
            season_id=season.id,
            team_id=teams[1].id,
            kind="commissioner_override",
            payload={},
        )
    )
    await db.flush()
    async with client_as("uid-1") as member:
        before = (await member.get("/api/leagues/user-leagues")).json()
    assert [row["id"] for row in before] == [season.league_id]
    assert before[0]["hasNewActivity"] is True
    async with client_as("uid-0") as commissioner:
        await _delete(commissioner, season.league_id)
    async with client_as("uid-1") as member:
        after = await member.get("/api/leagues/user-leagues")
    assert after.json() == []


async def test_season_list_and_past_leagues_hide_a_deleted_league(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-0") as commissioner:
        await commissioner.delete(
            f"/api/leagues/{season.league_id}/members/{users[1].id}"
        )
        await _delete(commissioner, season.league_id)
    async with client_as("uid-1") as former:
        past = await former.get("/api/leagues/past-leagues")
        seasons = await former.get(f"/api/leagues/{season.league_id}/seasons")
    assert past.json() == []
    assert seasons.status_code == 404
    assert seasons.json()["code"] == "leagueDeleted"


async def test_the_invite_is_revoked_and_its_preview_404s(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="unscheduled")
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{season.league_id}/invite", json={})
        ).json()["code"]
        assert (await commissioner.get(f"/api/invites/{code}")).status_code == 200
        await _delete(commissioner, season.league_id)
        assert (await commissioner.get(f"/api/invites/{code}")).status_code == 404
        joined = await commissioner.post(f"/api/invites/{code}/join")
    assert joined.status_code == 404
    invite = await db.scalar(select(LeagueInvite).where(LeagueInvite.code == code))
    assert invite is not None and invite.revoked


async def test_the_draft_clock_skips_a_deleted_league(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    season, _, _, draft = await make_season(db, draft_status="scheduled")
    league = await db.get(League, season.league_id)
    assert league is not None
    draft.status = "in_progress"
    draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=5)
    await db.flush()

    seen: list[int] = []

    async def fake_auto_pick(_db: AsyncSession, season_id: int, **_: object) -> None:
        seen.append(season_id)
        raise PickNotDue("not due")

    monkeypatch.setattr(draft_flow, "auto_pick", fake_auto_pick)
    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: lambda: _Reuse(db))
    await draft_clock.expire_overdue_picks()
    assert seen == [season.id]

    seen.clear()
    league.deleted_at = datetime.now(UTC)
    await db.flush()
    await draft_clock.expire_overdue_picks()
    assert seen == []


class _Reuse:
    """Hands the test session to code that opens its own; a rollback would undo the
    test's setup, so it is a no-op."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def __aenter__(self) -> "_Reuse":
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def rollback(self) -> None:
        return None

    def __getattr__(self, name: str) -> object:
        return getattr(self.db, name)


async def test_the_standings_loop_skips_a_deleted_league(db: AsyncSession) -> None:
    season, _, _, _ = await make_season(db, draft_status="completed")
    assert await recompute_standings(db, season.year) == 1
    league = await db.get(League, season.league_id)
    assert league is not None
    await delete_league(db, league, deleted_by=None)
    assert await recompute_standings(db, season.year) == 0


async def test_restore_brings_it_back(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="completed")
    async with client_as("uid-0") as commissioner:
        await _delete(commissioner, season.league_id)
    assert await restore_league(db, season.league_id) is True
    async with client_as("uid-1") as member:
        assert (await member.get(f"/api/leagues/{season.league_id}")).status_code == 200
    assert await restore_league(db, season.league_id) is False
    draft = await db.scalar(select(Draft).where(Draft.season_id == season.id))
    assert draft is not None


async def test_removing_a_member_or_deleting_the_league_closes_open_sockets(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from api.ws.draft_manager import draft_manager
    from api.ws.feed_manager import feed_manager

    season, users, _, _ = await make_season(db, draft_status="completed")
    removed, other = MagicMock(close=AsyncMock()), MagicMock(close=AsyncMock())
    feed_removed = MagicMock(close=AsyncMock())
    await draft_manager.join(season.id, removed, users[1].id)
    await draft_manager.join(season.id, other, users[0].id)
    await feed_manager.join(season.id, feed_removed, users[1].id)
    try:
        async with client_as("uid-0") as commissioner:
            await commissioner.delete(
                f"/api/leagues/{season.league_id}/members/{users[1].id}"
            )
            removed.close.assert_awaited_once()
            feed_removed.close.assert_awaited_once()
            other.close.assert_not_awaited()
            await _delete(commissioner, season.league_id)
        other.close.assert_awaited_once()
    finally:
        await draft_manager.disconnect(season.id, removed)
        await draft_manager.disconnect(season.id, other)
        await feed_manager.disconnect(season.id, feed_removed)
