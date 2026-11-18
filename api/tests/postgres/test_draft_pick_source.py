from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, DraftPick, User
from api.models.enums import PickSource
from api.services import activity, draft_clock, draft_events
from api.services.draft_flow import assign_pick, auto_pick, build_state
from api.services.draft_picks import make_pick
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

# Two teams, snake: A, B, B, A, ... (overall slots 1-4 with roster_total=2).


async def _actor(db: AsyncSession, user: User) -> activity.Actor:
    return activity.Actor.of(user)


async def _sources(db: AsyncSession) -> list[str]:
    picks = (
        (await db.execute(select(DraftPick).order_by(DraftPick.number_pick_overall)))
        .scalars()
        .all()
    )
    return [p.source for p in picks]


async def test_a_managers_own_pick_is_marked_manager(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, draft = await make_season(db)
    players = await make_players(db, ["QB", "RB"])
    async with client_as("uid-0") as drafter:
        made = await drafter.post(
            f"/api/drafts/{season.id}/picks", json={"playerId": players[0].id}
        )
    assert made.json()["source"] == "manager"
    assert made.json()["autopick"] is False
    state = await build_state(db, draft)
    assert state.picks[0].source == PickSource.MANAGER


async def test_the_clock_marks_timer_and_no_owner_picks(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    season, _, teams, draft = await make_season(db)
    await make_players(db, ["QB", "RB", "WR", "TE"])
    teams[1].owner_id = None
    draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=5)
    await db.flush()

    @asynccontextmanager
    async def session():  # type: ignore[no-untyped-def]
        yield db

    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: session)
    monkeypatch.setattr(db, "commit", db.flush)
    assert await draft_clock.expire_overdue_picks() == 1  # team A timed out
    assert await draft_clock.expire_overdue_picks() == 1  # team B has no owner

    assert await _sources(db) == ["timer", "no_owner"]
    picks = (await db.execute(select(DraftPick))).scalars().all()
    assert all(p.autopick for p in picks)


async def test_auto_pick_now_is_the_commissioners_and_posts_to_the_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    players = await make_players(db, ["QB", "RB"])
    async with client_as("uid-0") as commissioner:
        forced = await commissioner.post(f"/api/drafts/{season.id}/force-pick")
    assert forced.status_code == 200
    assert forced.json()["picks"][0]["source"] == "commissioner_auto"
    assert forced.json()["picks"][0]["autopick"] is True
    event = await db.scalar(
        select(ActivityEvent).where(ActivityEvent.kind == "draft_pick_assigned")
    )
    assert event is not None
    assert event.team_id == teams[0].id
    assert event.payload["autoPick"] is True
    assert event.payload["pickNumber"] == 1
    assert event.payload["playerId"] in {p.id for p in players}


async def test_assigned_reserved_and_replaced_picks_are_the_commissioners(
    db: AsyncSession,
) -> None:
    season, users, _, _ = await make_season(db, roster_total=3)
    players = await make_players(db, ["QB", "RB", "WR", "TE", "RB", "WR"])
    actor = await _actor(db, users[0])

    await assign_pick(db, season.id, 1, players[0].id, replace=False, actor=actor)
    await assign_pick(db, season.id, 3, players[2].id, replace=False, actor=actor)
    await make_pick(db, season.id, users[1], players[1].id)  # pick 2; 3 settles
    assert await _sources(db) == [
        "commissioner_assigned",
        "manager",
        "commissioner_assigned",
    ]

    await auto_pick(db, season.id)  # pick 4, timer
    await assign_pick(db, season.id, 4, players[5].id, replace=True, actor=actor)
    replaced = await db.scalar(
        select(DraftPick).where(DraftPick.number_pick_overall == 4)
    )
    assert replaced is not None
    assert replaced.source == "commissioner_assigned"
    assert replaced.autopick is False


async def test_pick_made_broadcast_carries_the_source(db: AsyncSession) -> None:
    season, _, _, draft = await make_season(db)
    await make_players(db, ["QB", "RB"])
    result = await auto_pick(db, season.id)
    events = await draft_events.pick_events(db, draft, result)
    pick_made = next(e for e in events if e["eventType"] == "PICK_MADE")
    assert pick_made["data"]["source"] == "timer"
    state = next(e for e in events if e["eventType"] == "DRAFT_STATE")
    assert state["data"]["picks"][0]["source"] == "timer"
