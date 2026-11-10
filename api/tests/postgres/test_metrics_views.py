"""The owner's metrics views (#358): counts only, nothing personal, and a role that can
read them and nothing else. The test schema is built from the models, so the view SQL
is run from the migration, inside the test's own rolled-back transaction."""

import importlib.util
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, League, LeagueMessage, PushSubscription, Team
from api.tests.postgres.factories import make_season

_spec = importlib.util.spec_from_file_location(
    "metrics_migration",
    Path(__file__).parents[2] / "alembic/versions/0023_metrics_views.py",
)
assert _spec and _spec.loader
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)

NOON = datetime(2026, 11, 3, 12, tzinfo=UTC)


async def _install_views(db: AsyncSession) -> None:
    connection = await db.connection()
    await connection.run_sync(migration.create_metrics)


async def _rows(db: AsyncSession, view: str) -> list[dict[str, Any]]:
    result = await db.execute(text(f"SELECT * FROM fantasy.{view}"))
    return [dict(row) for row in result.mappings()]


async def test_leagues_view_counts_members_and_open_teams_without_names(
    db: AsyncSession,
) -> None:
    season, _, _, _ = await make_season(db, teams=3, draft_status="scheduled")
    db.add(Team(name="Open", season_id=season.id))
    await db.flush()
    await _install_views(db)

    [row] = await _rows(db, "metrics_leagues")

    assert row["league_id"] == season.league_id
    assert (row["members"], row["teams"], row["claimed_teams"], row["open_teams"]) == (
        3,
        4,
        3,
        1,
    )
    assert (row["season_year"], row["draft_status"]) == (2025, "scheduled")
    assert set(row) == {
        "league_id",
        "created_at",
        "season_year",
        "draft_status",
        "members",
        "seasons",
        "teams",
        "claimed_teams",
        "open_teams",
    }


async def test_a_deleted_league_is_not_counted(db: AsyncSession) -> None:
    season, _, _, _ = await make_season(db)
    league = await db.get(League, season.league_id)
    assert league
    league.deleted_at = NOON
    await db.flush()
    await _install_views(db)

    assert await _rows(db, "metrics_leagues") == []
    assert {row["leagues_joined"] for row in await _rows(db, "metrics_users")} == {0}


async def test_users_view_has_no_email_or_name(db: AsyncSession) -> None:
    _, users, _, _ = await make_season(db, teams=2)
    await _install_views(db)

    rows = await _rows(db, "metrics_users")

    assert sorted(row["user_id"] for row in rows) == sorted(u.id for u in users)
    assert {row["leagues_joined"] for row in rows} == {1}
    assert set(rows[0]) == {"user_id", "created_at", "leagues_joined"}


async def test_daily_view_counts_each_thing_on_its_day(db: AsyncSession) -> None:
    season, users, _, _ = await make_season(db, teams=2, draft_status="scheduled")
    await db.execute(text("UPDATE fantasy.users SET created_at = :at"), {"at": NOON})
    await db.execute(text("UPDATE fantasy.leagues SET created_at = :at"), {"at": NOON})
    await db.execute(
        text("UPDATE fantasy.league_members SET joined_at = :at"), {"at": NOON}
    )
    await db.execute(text("UPDATE fantasy.drafts SET start_time = :at"), {"at": NOON})
    db.add_all(
        [
            LeagueMessage(
                league_id=season.league_id,
                season_id=season.id,
                author_user_id=users[0].id,
                body="hi",
                created_at=NOON,
            ),
            LeagueMessage(
                league_id=season.league_id,
                season_id=season.id,
                author_user_id=users[1].id,
                body="deleted",
                created_at=NOON,
                deleted_at=NOON,
            ),
            ActivityEvent(
                season_id=season.id,
                kind="draft_started",
                actor_user_id=users[0].id,
                payload={},
                created_at=NOON,
            ),
            PushSubscription(
                user_id=users[0].id,
                endpoint="https://push.example/1",
                p256dh="k",
                auth="a",
                created_at=NOON,
            ),
        ]
    )
    await db.flush()
    await _install_views(db)

    day = next(r for r in await _rows(db, "metrics_daily") if r["day"] == NOON.date())

    assert day == {
        "day": NOON.date(),
        "signups": 2,
        "leagues_created": 1,
        "members_joined": 2,
        "drafts_scheduled": 1,
        "drafts_started": 1,
        "drafts_completed": 0,
        "active_members": 1,
        "chat_messages": 1,
        "push_subscriptions": 1,
    }


async def test_daily_view_has_a_row_for_every_day_through_today(
    db: AsyncSession,
) -> None:
    await make_season(db)
    await db.execute(
        text("UPDATE fantasy.users SET created_at = now() - interval '3 days'")
    )
    await _install_views(db)

    days = [row["day"] for row in await _rows(db, "metrics_daily")]

    assert len(days) == 4
    assert days == sorted(days)


async def test_the_reader_role_reads_the_views_and_nothing_else(
    db: AsyncSession,
) -> None:
    await make_season(db)
    await _install_views(db)

    await db.execute(text("SET LOCAL ROLE metrics_reader"))
    for view in migration.VIEWS:
        await db.execute(text(f"SELECT * FROM fantasy.{view}"))
    for table in ("users", "league_members", "league_messages"):
        with pytest.raises(DBAPIError, match="permission denied"):
            async with db.begin_nested():
                await db.execute(text(f"SELECT * FROM fantasy.{table}"))
    with pytest.raises(DBAPIError, match="permission denied"):
        async with db.begin_nested():
            await db.execute(text("DELETE FROM fantasy.metrics_users"))
