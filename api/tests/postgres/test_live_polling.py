import time
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import IngestionStatus, NFLGame, NFLTeam
from api.services.scheduler import (
    GAMES_LIST_MAX_AGE_SECONDS,
    RECONCILE_FIRST_SECONDS,
    RECONCILE_SECOND_SECONDS,
    games_list_due,
    games_to_poll,
    reconcile_due,
    run_poll_cycle,
)

NOW = time.time()  # the stored freshness stamp is real wall-clock time


class FakeClient:
    """Counts calls so tests can assert how much quota a cycle spends."""

    def __init__(
        self,
        games: list[dict[str, Any]],
        boxes: dict[str, dict[str, Any]],
        failing: set[str] = frozenset(),  # type: ignore[assignment]
    ) -> None:
        self.games, self.boxes, self.failing = games, boxes, failing
        self.list_calls = 0
        self.box_calls: list[str] = []
        self.requests_remaining: int | None = 900
        self.budget_exhausted = False
        self.requests_today = 7

    async def get_nfl_games_list(self, *_: Any, **__: Any) -> list[dict[str, Any]]:
        self.list_calls += 1
        return self.games

    async def get_nfl_box_score(self, game_id: str) -> dict[str, Any]:
        self.box_calls.append(game_id)
        if game_id in self.failing:
            raise RuntimeError("upstream down")
        return self.boxes[game_id]


def summary(game_id: str, epoch: float, status: str = "Scheduled") -> dict[str, Any]:
    return {
        "gameID": game_id,
        "gameStatus": status,
        "gameTime_epoch": str(epoch),
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "2",
    }


def box(status: str, home: int, away: int) -> dict[str, Any]:
    return {
        "gameStatus": status,
        "gameWeek": "Wild Card",
        "teamIDHome": "1",
        "teamIDAway": "2",
        "homePts": str(home),
        "awayPts": str(away),
        "playerStats": {},
    }


def game(
    game_id: str, epoch: float | None, status: str | None = "Scheduled"
) -> NFLGame:
    return NFLGame(
        id=game_id,
        season=2025,
        season_type="post",
        game_status=status,
        game_time_epoch=None if epoch is None else str(epoch),
    )


def test_only_started_unfinished_games_are_polled() -> None:
    games = [
        game("live", NOW - 3600, "Live - In Progress"),
        game("upcoming", NOW + 3600),
        game("done", NOW - 7200, "Completed"),
        game("abandoned", NOW - 48 * 3600, "Scheduled"),
        game("unscheduled", None),
    ]
    assert [g.id for g in games_to_poll(games, NOW)] == ["live"]


def test_games_list_is_due_when_never_fetched_or_a_day_old() -> None:
    assert games_list_due([], None, NOW)
    assert games_list_due([], NOW - GAMES_LIST_MAX_AGE_SECONDS - 1, NOW)
    assert not games_list_due([], NOW - 60, NOW)


def test_games_list_is_due_when_a_kickoff_passed_since_the_last_fetch() -> None:
    kicked_off = [game("g", NOW - 120)]
    assert games_list_due(kicked_off, NOW - 600, NOW)
    assert not games_list_due(kicked_off, NOW - 60, NOW)
    assert not games_list_due([game("g", NOW - 120, "Completed")], NOW - 600, NOW)
    assert not games_list_due([game("later", NOW + 600)], NOW - 600, NOW)


@pytest.fixture
async def teams(db: AsyncSession) -> None:
    db.add_all([NFLTeam(id=1, team_abv="KC"), NFLTeam(id=2, team_abv="BUF")])
    await db.flush()


async def test_a_cycle_polls_one_box_score_per_live_game(
    db: AsyncSession, teams: None, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO")
    client = FakeClient(
        games=[
            summary("live", NOW - 3600, "Live - In Progress"),
            summary("upcoming", NOW + 3600),
            summary("done", NOW - 9000, "Final"),
        ],
        boxes={
            "live": box("Live - In Progress", 10, 7),
            "done": box("Completed", 3, 0),
        },
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    assert client.list_calls == 1
    assert "calls today 7/700" in caplog.text
    assert "plan requests remaining 900" in caplog.text
    assert client.box_calls == ["live", "done"]  # the Final one: its last fetch
    assert (await db.get(NFLGame, "live")).home_pts == 10  # type: ignore[union-attr]

    await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]
    assert client.list_calls == 1  # list refreshed once, not every tick
    assert client.box_calls == ["live", "done", "live"]


async def test_the_poll_that_sees_completed_is_the_final_fetch(
    db: AsyncSession, teams: None
) -> None:
    client = FakeClient(
        games=[summary("g", NOW - 3600, "Live - In Progress")],
        boxes={"g": box("Completed", 24, 20)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]
    await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]

    assert client.box_calls == ["g"]
    loser = await db.get(NFLTeam, 2)
    await db.refresh(loser)
    assert loser.is_active is False  # type: ignore[union-attr]


async def test_a_spent_daily_budget_stops_polling_and_keeps_the_data(
    db: AsyncSession, teams: None, caplog: pytest.LogCaptureFixture
) -> None:
    client = FakeClient(
        games=[summary("g", NOW - 3600, "Live - In Progress")],
        boxes={"g": box("Live - In Progress", 10, 7)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    client.budget_exhausted = True
    list_calls, box_calls = client.list_calls, list(client.box_calls)
    polled = await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]

    assert polled == 0
    assert (client.list_calls, client.box_calls) == (list_calls, box_calls)
    assert "budget" in caplog.text
    stored = await db.get(NFLGame, "g")
    assert (stored.home_pts, stored.away_pts) == (10, 7)  # type: ignore[union-attr]


async def test_a_failed_poll_keeps_the_last_good_data(
    db: AsyncSession, teams: None
) -> None:
    client = FakeClient(
        games=[summary("g", NOW - 3600, "Live - In Progress")],
        boxes={"g": box("Live - In Progress", 10, 7)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]
    freshness = (await db.get(IngestionStatus, "box_scores")).last_synced_at  # type: ignore[union-attr]

    client.failing = {"g"}
    await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]

    stored = await db.get(NFLGame, "g")
    assert (stored.home_pts, stored.away_pts) == (10, 7)  # type: ignore[union-attr]
    status = await db.get(IngestionStatus, "box_scores")
    assert status.last_synced_at == freshness  # type: ignore[union-attr]


async def test_one_failing_game_does_not_stop_the_others(
    db: AsyncSession, teams: None
) -> None:
    client = FakeClient(
        games=[
            summary("bad", NOW - 3600, "Live - In Progress"),
            summary("good", NOW - 3600, "Live - In Progress"),
        ],
        boxes={"good": box("Live - In Progress", 3, 0)},
        failing={"bad"},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]
    assert (await db.get(NFLGame, "good")).home_pts == 3  # type: ignore[union-attr]


async def test_a_blank_box_score_never_overwrites_scores_with_nothing(
    db: AsyncSession, teams: None
) -> None:
    client = FakeClient(
        games=[summary("g", NOW - 3600, "Live - In Progress")],
        boxes={"g": box("Live - In Progress", 10, 7)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]
    client.boxes["g"] = {"gameStatus": "Live - In Progress", "playerStats": {}}
    await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]

    stored = (await db.execute(select(NFLGame).where(NFLGame.id == "g"))).scalar_one()
    assert (stored.home_pts, stored.away_pts) == (10, 7)


def test_a_completed_game_is_reconciled_next_morning_then_again_at_48_hours() -> None:
    kickoff = NOW - 100 * 3600
    done = game("g", kickoff, "Completed")
    day_one = kickoff + RECONCILE_FIRST_SECONDS
    day_two = kickoff + RECONCILE_SECOND_SECONDS

    assert not reconcile_due(done, None, kickoff + 3600)
    assert reconcile_due(done, None, day_one + 1)
    assert not reconcile_due(done, day_one + 5, day_one + 600)
    assert reconcile_due(done, day_one + 5, day_two + 1)
    assert not reconcile_due(done, day_two + 5, day_two + 10_000)
    assert not reconcile_due(game("live", kickoff, "Scheduled"), None, day_two)


async def test_reconcile_refetches_once_per_window_and_flips_a_changed_result(
    db: AsyncSession, teams: None
) -> None:
    kickoff = NOW - 30 * 3600
    client = FakeClient(
        games=[summary("g", kickoff, "Final")],
        boxes={"g": box("Completed", 24, 20)},
    )
    db.add(game("g", kickoff, "Completed"))
    await db.flush()

    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]
    assert client.box_calls == ["g"]
    await run_poll_cycle(db, 2025, client=client, now=NOW + 150)  # type: ignore[arg-type]
    assert client.box_calls == ["g"]  # same window: not again

    client.boxes["g"] = box("Completed", 20, 24)  # a scoring correction
    await run_poll_cycle(
        db,
        2025,
        client=client,  # type: ignore[arg-type]
        now=kickoff + RECONCILE_SECOND_SECONDS + 1,
    )
    assert client.box_calls == ["g", "g"]
    teams_by_id = {
        t.id: t
        for t in (
            await db.execute(select(NFLTeam).execution_options(populate_existing=True))
        )
        .scalars()
        .all()
    }
    assert (teams_by_id[1].is_active, teams_by_id[2].is_active) == (False, True)


async def test_a_game_the_list_calls_final_still_gets_its_final_box_score(
    db: AsyncSession, teams: None
) -> None:
    client = FakeClient(
        games=[summary("g", NOW - 20 * 3600, "Final")],
        boxes={"g": box("Completed", 24, 20)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    assert client.box_calls == ["g"]
    stored = await db.get(NFLGame, "g")
    assert stored is not None
    await db.refresh(stored)
    assert (stored.game_status, stored.home_pts) == ("Completed", 24)
