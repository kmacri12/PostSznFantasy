import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLTeam,
    Notification,
    TeamPlayer,
)
from api.services.replay import GAME_LENGTH_SECONDS, ReplayClient, load_replay
from api.services.scheduler import run_poll_cycle
from api.tests.postgres.factories import make_season

FIXTURES = Path(__file__).parent.parent / "fixtures"
KICKOFF = 1768080600.0  # gameTime_epoch of the fixture game


def fixture_client(clock: list[float]) -> ReplayClient:
    games = json.loads((FIXTURES / "games_for_week.json").read_text())["body"]
    box = json.loads((FIXTURES / "box_score_lar_car.json").read_text())["body"]
    return ReplayClient(games, {box["gameID"]: box}, lambda: clock[0])


async def test_the_replayed_game_moves_from_scheduled_to_live_to_final() -> None:
    clock = [KICKOFF - 600]
    client = fixture_client(clock)

    (listing,) = await client.get_nfl_games_list("2025", "post")
    assert listing["gameStatus"] == "Scheduled"

    clock[0] = KICKOFF + GAME_LENGTH_SECONDS / 2
    (listing,) = await client.get_nfl_games_list("2025", "post")
    assert listing["gameStatus"] == "Live - In Progress"
    live = await client.get_nfl_box_score("20260110_LAR@CAR")
    assert live["gameStatus"] == "Live - In Progress"
    assert (int(live["homePts"]), int(live["awayPts"])) == (15, 17)

    clock[0] = KICKOFF + GAME_LENGTH_SECONDS + 1
    final = await client.get_nfl_box_score("20260110_LAR@CAR")
    assert (final["gameStatus"], final["homePts"], final["awayPts"]) == (
        "Completed",
        "31",
        "34",
    )
    assert client.requests_remaining is None


def test_a_replay_file_round_trips(tmp_path: Path) -> None:
    path = tmp_path / "replay.json"
    path.write_text(json.dumps({"games": [{"gameID": "g"}], "boxes": {"g": {}}}))
    games, boxes = load_replay(path)
    assert games == [{"gameID": "g"}]
    assert boxes == {"g": {}}


async def test_replay_drives_the_real_poll_scoring_and_elimination_code(
    db: AsyncSession,
) -> None:
    db.add_all([NFLTeam(id=5, team_abv="CAR"), NFLTeam(id=19, team_abv="LAR")])
    await db.flush()
    clock = [KICKOFF + 60]
    client = fixture_client(clock)

    await run_poll_cycle(db, 2025, client=client, now=clock[0])  # type: ignore[arg-type]
    live = await db.get(NFLGame, "20260110_LAR@CAR")
    assert live is not None and live.game_status == "Live - In Progress"
    assert (await db.get(NFLTeam, 19)).is_active is True  # type: ignore[union-attr]

    clock[0] = KICKOFF + GAME_LENGTH_SECONDS + 1
    await run_poll_cycle(db, 2025, client=client, now=clock[0])  # type: ignore[arg-type]
    await db.refresh(live)
    assert (live.game_status, live.home_pts, live.away_pts) == ("Completed", 31, 34)
    home = await db.get(NFLTeam, 5)
    await db.refresh(home)
    assert home.is_active is False  # type: ignore[union-attr]


@pytest.mark.parametrize("fraction", [0.0, 1.0])
async def test_scores_are_clamped_before_kickoff_and_after_the_end(
    fraction: float,
) -> None:
    clock = [KICKOFF + fraction * GAME_LENGTH_SECONDS]
    box = await fixture_client(clock).get_nfl_box_score("20260110_LAR@CAR")
    assert box["homePts"] in {"0", "31"}


async def test_replay_triggers_the_score_and_round_alerts_once_each(
    db: AsyncSession,
) -> None:
    """A starter who throws touchdowns in the replayed game, and the round ending."""
    season, users, teams, _ = await make_season(
        db, teams=2, draft_status="completed", roster_total=1, roster_num_qb=1,
        roster_num_rb=0, roster_num_wr=0, roster_num_te=0, roster_num_flex_wr_rb_te=0,
        roster_num_k=0, roster_num_dst=0, roster_num_bench=0,
    )  # fmt: skip
    db.add_all([NFLTeam(id=5, team_abv="CAR"), NFLTeam(id=19, team_abv="LAR")])
    await db.flush()
    db.add(NFLPlayer(id=12483, name="Matthew Stafford", position="QB", team_id=19))
    await db.flush()
    db.add(TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=12483))
    db.add(LineupSlot(team_id=teams[0].id, round=1, player_id=12483, slot_index=0))
    await db.flush()
    clock = [KICKOFF + GAME_LENGTH_SECONDS / 2]
    client = fixture_client(clock)

    await run_poll_cycle(db, 2025, client=client, now=clock[0])  # type: ignore[arg-type]
    clock[0] = KICKOFF + GAME_LENGTH_SECONDS + 1
    await run_poll_cycle(db, 2025, client=client, now=clock[0])  # type: ignore[arg-type]
    await run_poll_cycle(db, 2025, client=client, now=clock[0] + 600)  # type: ignore[arg-type]

    entries = list(
        (await db.execute(select(Notification).order_by(Notification.id))).scalars()
    )
    assert {e.user_id for e in entries} == {users[0].id}
    kinds = [e.kind for e in entries]
    assert kinds.count("round_result") == 1
    assert kinds.count("player_scored") == 1  # the second TD report moved the first up
    assert "team_eliminated" not in kinds  # his team won
