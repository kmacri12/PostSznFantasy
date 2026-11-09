from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Draft, DraftPick, LineupSlot, NFLTeam, TeamPlayer
from api.services import draft_clock, draft_flow
from api.services.draft_picks import DraftPickError, PickNotDue
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_playoff_field, make_season


async def _league(db: AsyncSession, **kwargs: object):  # type: ignore[no-untyped-def]
    return await make_season(db, draft_status="scheduled", ordered=False, **kwargs)  # type: ignore[arg-type]


async def test_visiting_the_draft_never_starts_it(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, draft = await _league(db)
    async with client_as("uid-1") as member:
        state = (await member.get(f"/api/drafts/draft-info/{season.id}")).json()
        await member.get(f"/api/drafts/draft-info/{season.id}")
    assert state["status"] == "scheduled"
    assert state["currentPickDeadline"] is None
    await db.refresh(draft)
    assert draft.current_pick_deadline is None


async def test_start_requires_every_team_in_a_slot_and_is_commissioner_only(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await _league(db)
    await make_playoff_field(db)
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-1") as member:
        assert (await member.post(f"{url}/control/start")).status_code == 403
        assert (
            await member.put(f"{url}/order", json={"teamIds": [teams[0].id]})
        ).status_code == 403
    async with client_as("uid-0") as commissioner:
        unordered = await commissioner.post(f"{url}/control/start")
        partial = await commissioner.put(
            f"{url}/order", json={"teamIds": [teams[1].id]}
        )
        still_partial = await commissioner.post(f"{url}/control/start")
        full = await commissioner.put(
            f"{url}/order", json={"teamIds": [teams[1].id, teams[0].id]}
        )
        started = await commissioner.post(f"{url}/control/start")
    assert unordered.status_code == 409
    assert partial.json()["unassignedTeamIds"] == [teams[0].id]
    assert still_partial.status_code == 409
    assert [s["teamId"] for s in full.json()["order"]] == [teams[1].id, teams[0].id]
    assert started.json()["status"] == "in_progress"
    assert started.json()["currentPickDeadline"] is not None
    assert started.json()["onTheClockTeamId"] == teams[1].id


async def test_order_and_setup_lock_once_started_but_clock_length_can_change(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await _league(db)
    await make_playoff_field(db)
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-0") as commissioner:
        await commissioner.post(f"{url}/order/randomize")
        await commissioner.post(f"{url}/control/start")
        reorder = await commissioner.put(
            f"{url}/order", json={"teamIds": [t.id for t in teams]}
        )
        retype = await commissioner.patch(url, json={"draftType": "linear"})
        faster = await commissioner.patch(url, json={"timePerPickSeconds": 30})
    assert reorder.status_code == 409
    assert retype.status_code == 409
    assert faster.status_code == 200
    assert faster.json()["timePerPickSeconds"] == 30


async def test_randomize_assigns_every_team_once(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await _league(db)
    async with client_as("uid-0") as commissioner:
        body = (
            await commissioner.post(f"/api/drafts/{season.id}/order/randomize")
        ).json()
    assert sorted(s["teamId"] for s in body["order"]) == sorted(t.id for t in teams)


async def test_setup_schedules_the_draft(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, draft = await make_season(
        db, draft_status="unscheduled", ordered=False
    )
    async with client_as("uid-0") as commissioner:
        scheduled = await commissioner.patch(
            f"/api/drafts/{season.id}",
            json={
                "startTime": "2030-01-05T18:00:00Z",
                "draftType": "third_round_reversal",
                "pickTimeoutAction": "best_available",
            },
        )
        lobby = await commissioner.post(f"/api/drafts/{season.id}/control/lobby")
        cleared = await commissioner.patch(
            f"/api/drafts/{season.id}", json={"clearStartTime": True}
        )
    body = scheduled.json()
    assert body["status"] == "scheduled"
    assert body["draftType"] == "third_round_reversal"
    assert lobby.json()["status"] == "lobby"
    assert cleared.json()["status"] == "unscheduled"
    await db.refresh(draft)
    assert draft.start_time is None


async def test_pause_freezes_the_clock_and_resume_restores_it(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, draft = await make_season(db)
    draft.current_pick_deadline = datetime.now(UTC) + timedelta(seconds=40)
    await db.flush()
    url = f"/api/drafts/{season.id}/control"
    async with client_as("uid-0") as commissioner:
        paused = (await commissioner.post(f"{url}/pause")).json()
        resumed = (await commissioner.post(f"{url}/resume")).json()
    assert paused["status"] == "paused"
    assert paused["currentPickDeadline"] is None
    assert 38 <= paused["pausedRemainingSeconds"] <= 40
    deadline = datetime.fromisoformat(resumed["currentPickDeadline"])
    assert 36 <= (deadline - datetime.now(UTC)).total_seconds() <= 41


async def test_rest_pick_is_validated_idempotent_and_blocked_while_paused(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, roster_total=2)
    players = await make_players(db, ["QB", "RB", "WR"])
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-1") as not_up:
        wrong_turn = await not_up.post(f"{url}/picks", json={"playerId": players[0].id})
    async with client_as("uid-0") as on_clock:
        first = await on_clock.post(f"{url}/picks", json={"playerId": players[0].id})
        replay = await on_clock.post(f"{url}/picks", json={"playerId": players[0].id})
    assert wrong_turn.status_code == 409
    assert first.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    count = len((await db.execute(select(DraftPick))).scalars().all())
    assert count == 1

    async with client_as("uid-0") as commissioner:
        await commissioner.post(f"{url}/control/pause")
    async with client_as("uid-1") as on_clock_now:
        paused = await on_clock_now.post(
            f"{url}/picks", json={"playerId": players[1].id}
        )
    assert paused.status_code == 409
    assert "not in progress" in paused.json()["detail"]


async def test_picks_move_the_server_deadline(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, draft = await make_season(db, roster_total=2)
    players = await make_players(db, ["QB"])
    draft.current_pick_deadline = datetime.now(UTC) + timedelta(seconds=1)
    draft.time_per_pick_seconds = 90
    await db.flush()
    async with client_as("uid-0") as drafter:
        await drafter.post(
            f"/api/drafts/{season.id}/picks", json={"playerId": players[0].id}
        )
        state = (await drafter.get(f"/api/drafts/draft-info/{season.id}")).json()
    deadline = datetime.fromisoformat(state["currentPickDeadline"])
    assert 85 <= (deadline - datetime.now(UTC)).total_seconds() <= 91
    assert state["currentPickOverall"] == 2


async def test_commissioner_can_undo_the_last_pick(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, roster_total=2)
    players = await make_players(db, ["QB"])
    async with client_as("uid-0") as commissioner:
        await commissioner.post(
            f"/api/drafts/{season.id}/picks", json={"playerId": players[0].id}
        )
        undone = await commissioner.post(f"/api/drafts/{season.id}/control/undo")
        nothing = await commissioner.post(f"/api/drafts/{season.id}/control/undo")
    assert undone.json()["picks"] == []
    assert undone.json()["onTheClockTeamId"] == teams[0].id
    assert nothing.status_code == 409
    assert (await db.execute(select(TeamPlayer))).scalars().all() == []


async def test_queue_is_per_team_and_drives_autopick(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, roster_total=2)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB", "WR"], nfl_team=kc)
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-0") as drafter:
        saved = await drafter.put(
            f"{url}/queue", json={"playerIds": [players[2].id, players[1].id]}
        )
        bad = await drafter.put(f"{url}/queue", json={"playerIds": [999999]})
        forced = await drafter.post(f"{url}/force-pick")
    assert saved.json()["playerIds"] == [players[2].id, players[1].id]
    assert bad.status_code == 409
    assert forced.status_code == 200
    first = (await db.execute(select(DraftPick))).scalars().one()
    assert first.player_id == players[2].id
    assert first.autopick is True
    assert first.team_id == teams[0].id
    async with client_as("uid-1") as other:
        assert (await other.get(f"{url}/queue")).json()["playerIds"] == []


async def test_autopick_falls_back_to_best_available_and_skips_full_positions(
    db: AsyncSession,
) -> None:
    season, _, _, draft = await make_season(db, roster_total=3, roster_max_qb=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    out = NFLTeam(id=2, team_abv="OUT", is_active=False)
    db.add_all([kc, out])
    await db.flush()
    await make_players(db, ["QB"], nfl_team=out)  # eliminated: never auto-picked
    players = await make_players(
        db, ["QB", "QB", "QB", "RB"], nfl_team=kc, first_id=2000
    )

    first = await draft_flow.auto_pick(db, season.id)
    second = await draft_flow.auto_pick(db, season.id)
    third = await draft_flow.auto_pick(db, season.id)  # same team as `second` (snake)
    assert first.pick.player_id == players[0].id  # no stats: lowest id first
    assert second.pick.player_id == players[1].id
    # Team 2 already holds a QB at the position limit, so the remaining QB is skipped.
    assert third.pick.team_id == second.pick.team_id
    assert third.pick.player_id == players[3].id
    await db.refresh(draft)


async def test_expired_deadline_triggers_an_autopick_via_the_clock(
    db: AsyncSession, monkeypatch: object
) -> None:
    season, _, _, draft = await make_season(db, roster_total=2)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(db, ["QB", "RB"], nfl_team=kc)
    draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=5)
    await db.flush()

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def session():  # type: ignore[no-untyped-def]
        yield db

    assert isinstance(monkeypatch, pytest.MonkeyPatch)
    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: session)
    monkeypatch.setattr(db, "commit", db.flush)
    assert await draft_clock.expire_overdue_picks() == 1
    picks = (await db.execute(select(DraftPick))).scalars().all()
    assert len(picks) == 1
    assert picks[0].autopick is True
    assert await draft_clock.expire_overdue_picks() == 0  # deadline moved forward


async def test_clock_skips_a_pick_whose_deadline_was_reset_after_it_looked(
    db: AsyncSession,
) -> None:
    season, _, _, draft = await make_season(db, roster_total=2)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(db, ["QB", "RB"], nfl_team=kc)
    draft.current_pick_deadline = datetime.now(UTC) + timedelta(seconds=60)
    await db.flush()

    with pytest.raises(PickNotDue):
        await draft_flow.auto_pick(db, season.id, only_if_overdue=True)
    assert (await db.execute(select(DraftPick))).scalars().all() == []

    draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=1)
    await db.flush()
    result = await draft_flow.auto_pick(db, season.id, only_if_overdue=True)
    assert result.pick.autopick is True


async def _overdue_draft_with_pool(db: AsyncSession):  # type: ignore[no-untyped-def]
    season, users, _, draft = await make_season(db, roster_total=3)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(db, ["QB", "RB", "WR", "TE"], nfl_team=kc)
    draft.current_pick_deadline = datetime.now(UTC) - timedelta(seconds=1)
    await db.flush()
    return season, draft


async def test_clock_does_nothing_for_a_draft_paused_after_its_scan(
    db: AsyncSession,
) -> None:
    season, draft = await _overdue_draft_with_pool(db)
    await draft_flow.pause_draft(db, season.id)

    with pytest.raises(DraftPickError, match="not in progress"):
        await draft_flow.auto_pick(db, season.id, only_if_overdue=True)
    assert (await db.execute(select(DraftPick))).scalars().all() == []


async def test_clock_does_not_pick_again_after_an_undo_reset_the_deadline(
    db: AsyncSession,
) -> None:
    season, draft = await _overdue_draft_with_pool(db)
    await draft_flow.auto_pick(db, season.id)
    await draft_flow.undo_last_pick(db, season.id)

    with pytest.raises(PickNotDue):
        await draft_flow.auto_pick(db, season.id, only_if_overdue=True)
    assert (await db.execute(select(DraftPick))).scalars().all() == []


async def test_restart_extends_lapsed_deadlines_instead_of_autopicking(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def session():  # type: ignore[no-untyped-def]
        yield db

    season, draft = await _overdue_draft_with_pool(db)
    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: session)
    monkeypatch.setattr(db, "commit", db.flush)

    assert await draft_clock.extend_overdue_deadlines() == 1
    await db.refresh(draft)
    assert draft.current_pick_deadline is not None
    assert draft.current_pick_deadline > datetime.now(UTC)
    assert await draft_clock.expire_overdue_picks() == 0
    assert await draft_clock.extend_overdue_deadlines() == 0


async def test_draft_completes_after_the_last_round(db: AsyncSession) -> None:
    season, _, _, draft = await make_season(db, roster_total=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(db, ["QB", "RB"], nfl_team=kc)
    await draft_flow.auto_pick(db, season.id)
    last = await draft_flow.auto_pick(db, season.id)
    assert last.draft_complete
    await db.refresh(draft)
    assert draft.status == "completed"
    assert draft.current_pick_deadline is None
    assert isinstance(draft, Draft)


async def test_partial_order_keeps_slot_positions_but_cannot_start(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(
        db, teams=4, draft_status="unscheduled", ordered=False
    )
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-0") as commissioner:
        saved = await commissioner.put(
            f"{url}/order", json={"teamIds": [None, teams[0].id, None, teams[1].id]}
        )
        started = await commissioner.post(f"{url}/control/start")
    assert saved.status_code == 200
    assert [(s["slot"], s["teamId"]) for s in saved.json()["order"]] == [
        (2, teams[0].id),
        (4, teams[1].id),
    ]
    assert started.status_code == 409


async def test_undo_clears_the_undone_players_lineup_slots(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, roster_total=2)
    players = await make_players(db, ["QB"])
    async with client_as("uid-0") as commissioner:
        await commissioner.post(
            f"/api/drafts/{season.id}/picks", json={"playerId": players[0].id}
        )
        db.add(
            LineupSlot(
                team_id=teams[0].id, round=1, player_id=players[0].id, slot_index=0
            )
        )
        await db.flush()
        await commissioner.post(f"/api/drafts/{season.id}/control/undo")
    assert (await db.execute(select(LineupSlot))).scalars().all() == []

async def test_clock_finishes_a_four_team_draft_with_two_owners_in_seconds(
    db: AsyncSession, monkeypatch: object
) -> None:
    from contextlib import asynccontextmanager

    season, _, teams, draft = await make_season(db, teams=4, roster_total=2)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(
        db, ["QB", "RB", "WR", "TE", "QB", "RB", "WR", "TE"], nfl_team=kc
    )
    unowned = {teams[2].id, teams[3].id}
    for team in teams[2:]:
        team.owner_id = None
    draft.current_pick_deadline = datetime.now(UTC) + timedelta(hours=1)
    await db.flush()

    @asynccontextmanager
    async def session():  # type: ignore[no-untyped-def]
        yield db

    assert isinstance(monkeypatch, pytest.MonkeyPatch)
    monkeypatch.setattr(draft_clock, "get_session_factory", lambda: session)
    monkeypatch.setattr(db, "commit", db.flush)

    for _ in range(8):
        await db.refresh(draft)
        if draft.status == "completed":
            break
        if not await draft_clock.expire_overdue_picks():
            await draft_flow.auto_pick(db, season.id)  # an owner picking in time
    await db.refresh(draft)
    assert draft.status == "completed"
    picks = (await db.execute(select(DraftPick))).scalars().all()
    assert {p.team_id for p in picks if p.autopick} >= unowned
