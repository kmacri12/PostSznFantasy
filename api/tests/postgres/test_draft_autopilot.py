from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import DraftPick
from api.services import draft_clock
from api.services.draft_picks import AUTOPILOT_DELAY_SECONDS, make_pick
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

# Two teams, snake: A, B, B, A (roster_total=2).


@pytest.fixture
def clock_on_test_db(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> Callable[[], AbstractAsyncContextManager[AsyncSession]]:
    @asynccontextmanager
    async def session() -> AsyncIterator[AsyncSession]:
        yield db

    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: session)
    monkeypatch.setattr(db, "commit", db.flush)
    return session


async def _sources(db: AsyncSession) -> list[str]:
    picks = (
        (await db.execute(select(DraftPick).order_by(DraftPick.number_pick_overall)))
        .scalars()
        .all()
    )
    return [p.source for p in picks]


def _turn_started(seconds_ago: float) -> datetime:
    return datetime.now(UTC) - timedelta(seconds=seconds_ago)


async def test_a_timed_out_team_goes_on_autopilot_and_is_picked_early_next_time(
    db: AsyncSession, clock_on_test_db: object
) -> None:
    season, users, teams, draft = await make_season(db)
    players = await make_players(db, ["QB", "RB", "WR", "TE"])
    draft.current_pick_deadline = _turn_started(1)
    await db.flush()

    assert await draft_clock.expire_overdue_picks() == 1  # A times out
    await db.refresh(draft)
    assert draft.autopilot_team_ids == [teams[0].id]

    await make_pick(db, season.id, users[1], players[1].id)  # B, pick 2
    await make_pick(db, season.id, users[1], players[2].id)  # B, pick 3
    await db.refresh(draft)
    assert draft.current_pick_deadline is not None
    assert draft.current_pick_deadline > datetime.now(UTC) + timedelta(seconds=30)

    draft.pick_started_at = _turn_started(AUTOPILOT_DELAY_SECONDS - 3)
    await db.flush()
    assert await draft_clock.expire_overdue_picks() == 0  # still A's few seconds

    draft.pick_started_at = _turn_started(AUTOPILOT_DELAY_SECONDS + 1)
    await db.flush()
    assert await draft_clock.expire_overdue_picks() == 1
    assert await _sources(db) == ["timer", "manager", "manager", "autopilot"]
    await db.refresh(draft)
    assert draft.status == "completed"
    assert draft.autopilot_team_ids == [teams[0].id]


async def test_the_managers_own_pick_switches_autopilot_off(
    db: AsyncSession,
) -> None:
    season, users, teams, draft = await make_season(db)
    players = await make_players(db, ["QB", "RB"])
    draft.autopilot_team_ids = [teams[0].id, teams[1].id]
    await db.flush()

    await make_pick(db, season.id, users[0], players[0].id)

    await db.refresh(draft)
    assert draft.autopilot_team_ids == [teams[1].id]


async def test_a_team_without_an_owner_keeps_the_one_tick_pick(
    db: AsyncSession, clock_on_test_db: object
) -> None:
    _, _, teams, draft = await make_season(db)
    await make_players(db, ["QB", "RB"])
    teams[0].owner_id = None
    draft.autopilot_team_ids = [teams[0].id]
    draft.pick_started_at = datetime.now(UTC)
    draft.current_pick_deadline = datetime.now(UTC) + timedelta(minutes=5)
    await db.flush()

    assert await draft_clock.expire_overdue_picks() == 1
    assert await _sources(db) == ["no_owner"]


async def test_managers_switch_their_own_autopilot_and_commissioners_switch_it_off(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, draft = await make_season(db, teams=3)
    url = f"/api/drafts/{season.id}/autopilot"

    async with client_as("uid-1") as manager:
        on = await manager.put(f"{url}/{teams[1].id}", json={"enabled": True})
        others = await manager.put(f"{url}/{teams[2].id}", json={"enabled": True})
    assert on.status_code == 200
    assert on.json()["autopilotTeamIds"] == [teams[1].id]
    assert others.status_code == 403

    async with client_as("uid-0") as commissioner:
        switch_on = await commissioner.put(
            f"{url}/{teams[2].id}", json={"enabled": True}
        )
        switch_off = await commissioner.put(
            f"{url}/{teams[1].id}", json={"enabled": False}
        )
        state = await commissioner.get(f"/api/drafts/draft-info/{season.id}")
    assert switch_on.status_code == 403
    assert switch_off.json()["autopilotTeamIds"] == []
    assert state.json()["autopilotTeamIds"] == []
    await db.refresh(draft)
    assert draft.autopilot_team_ids == []
