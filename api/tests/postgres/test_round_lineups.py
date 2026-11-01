from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLTeam,
    SeasonSettings,
    Team,
    TeamPlayer,
)
from api.services.lineups import team_lineups
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season

LAYOUT: dict[str, Any] = dict(
    roster_total=5, roster_num_qb=1, roster_num_rb=1, roster_num_wr=0, roster_num_te=0,
    roster_num_flex_wr_rb_te=1, roster_num_k=0, roster_num_dst=0, roster_num_bench=2,
)  # fmt: skip
# Slot indexes for LAYOUT: 0 QB, 1 RB, 2 FLEX, 3 BENCH, 4 BENCH.
QB, RB, FLEX, BENCH_1, BENCH_2 = range(5)

HOUR = timedelta(hours=1)


def epoch(moment: datetime) -> str:
    return str(int(moment.timestamp()))


def game(
    game_id: str,
    week: int,
    home: int,
    away: int,
    kickoff: datetime,
    score: tuple[int, int] | None = None,
) -> NFLGame:
    return NFLGame(
        id=game_id, season=2025, season_type="post", game_week=week,
        game_status="Completed" if score else "Scheduled",
        game_time_epoch=epoch(kickoff), team_id_home=home, team_id_away=away,
        home_pts=score[0] if score else None, away_pts=score[1] if score else None,
    )  # fmt: skip


class Setup:
    def __init__(self, team: Team, players: list[NFLPlayer]) -> None:
        self.team = team
        self.players = players
        self.url = f"/api/teams/{team.id}"

    def move(self, round_: int, player: NFLPlayer, slot: int | None) -> dict[str, Any]:
        return {"round": round_, "playerId": player.id, "slotIndex": slot}


async def _setup(
    db: AsyncSession, games: list[NFLGame], positions: list[str] | None = None
) -> Setup:
    """Players 0..n on KC (id 1), except the last on BUF (id 2); DEN (3) is the foe."""
    season, _, teams, _ = await make_season(db, **LAYOUT)
    db.add_all(
        NFLTeam(id=i, team_abv=a, is_active=True)
        for i, a in [(1, "KC"), (2, "BUF"), (3, "DEN")]
    )
    await db.flush()
    positions = positions or ["QB", "RB", "RB", "WR"]
    players = await make_players(db, positions[:-1], nfl_team=await db.get(NFLTeam, 1))
    players += await make_players(
        db, positions[-1:], nfl_team=await db.get(NFLTeam, 2), first_id=2000
    )
    db.add_all(
        TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=p.id)
        for p in players
    )
    db.add_all(games)
    await db.flush()
    return Setup(teams[0], players)


def round_of(body: dict[str, Any], round_: int) -> dict[str, Any]:
    return next(r for r in body["lineups"] if r["round"] == round_)


def placed(body: dict[str, Any], round_: int) -> dict[int, int]:
    return {
        s["index"]: s["player"]["id"]
        for s in round_of(body, round_)["slots"]
        if s["player"]
    }


FUTURE = datetime.now(UTC) + 30 * 24 * HOUR


async def test_every_round_starts_empty_with_all_players_unassigned(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _setup(db, [game("g1", 1, 1, 3, FUTURE)])
    async with client_as("uid-0") as owner:
        body = (await owner.get(s.url)).json()
    assert [r["round"] for r in body["lineups"]] == [1, 2, 3, 4]
    for lineup in body["lineups"]:
        assert placed(body, lineup["round"]) == {}
        assert len(lineup["unassigned"]) == 4
        assert lineup["emptyStarterSlots"] == 3
    assert round_of(body, 1)["firstKickoff"] is not None
    assert body["canSetLineup"] is True


async def test_set_and_clear_a_slot_in_one_round(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _setup(db, [game("g1", 1, 1, 3, FUTURE)])
    qb, rb = s.players[0], s.players[1]
    async with client_as("uid-0") as owner:
        await owner.post(f"{s.url}/lineup", json=s.move(1, qb, QB))
        done = await owner.post(f"{s.url}/lineup", json=s.move(1, rb, FLEX))
        assert placed(done.json(), 1) == {QB: qb.id, FLEX: rb.id}
        cleared = await owner.post(f"{s.url}/lineup", json=s.move(1, rb, None))
    assert placed(cleared.json(), 1) == {QB: qb.id}
    assert round_of(cleared.json(), 1)["emptyStarterSlots"] == 2


async def test_nothing_is_carried_forward_to_other_rounds(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _setup(db, [game("g1", 1, 1, 3, FUTURE)])
    async with client_as("uid-0") as owner:
        await owner.post(f"{s.url}/lineup", json=s.move(1, s.players[0], QB))
        body = (await owner.get(s.url)).json()
    assert placed(body, 1) == {QB: s.players[0].id}
    for other in (2, 3, 4):
        assert placed(body, other) == {}
    stored = (await db.execute(select(LineupSlot))).scalars().all()
    assert [(row.round, row.slot_index) for row in stored] == [(1, QB)]


async def test_a_player_can_sit_in_different_slots_in_different_rounds(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _setup(db, [game("g1", 1, 1, 3, FUTURE)])
    rb = s.players[1]
    async with client_as("uid-0") as owner:
        await owner.post(f"{s.url}/lineup", json=s.move(1, rb, RB))
        both = await owner.post(f"{s.url}/lineup", json=s.move(2, rb, BENCH_1))
    assert placed(both.json(), 1) == {RB: rb.id}
    assert placed(both.json(), 2) == {BENCH_1: rb.id}


async def test_lineup_rules_are_enforced(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await _setup(db, [game("g1", 1, 1, 3, FUTURE)])
    wr = s.players[3]
    async with client_as("uid-0") as owner:
        wrong_position = await owner.post(f"{s.url}/lineup", json=s.move(1, wr, QB))
        stranger = await owner.post(
            f"{s.url}/lineup",
            json={"round": 1, "playerId": 999999, "slotIndex": BENCH_1},
        )
        bad_round = await owner.post(
            f"{s.url}/lineup", json={**s.move(1, wr, FLEX), "round": 5}
        )
    async with client_as("uid-1") as other:
        not_owner = await other.post(f"{s.url}/lineup", json=s.move(1, wr, FLEX))
    assert wrong_position.status_code == 409
    assert stranger.status_code == 409
    assert bad_round.status_code == 422
    assert not_owner.status_code == 403


async def test_locks_follow_the_scheduled_kickoff_per_player(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    now = datetime.now(UTC)
    # KC kicked off an hour ago; BUF kicks off in a month.
    s = await _setup(db, [game("g1", 1, 1, 3, now - HOUR), game("g2", 1, 2, 3, FUTURE)])
    started, upcoming = s.players[1], s.players[3]
    async with client_as("uid-0") as owner:
        body = (await owner.get(s.url)).json()
        by_id = {p["id"]: p for p in round_of(body, 1)["unassigned"]}
        refused = await owner.post(f"{s.url}/lineup", json=s.move(1, started, RB))
        allowed = await owner.post(f"{s.url}/lineup", json=s.move(1, upcoming, FLEX))
    assert by_id[started.id]["locked"] is True
    assert by_id[upcoming.id]["locked"] is False
    assert refused.status_code == 409
    assert "locked" in refused.json()["detail"]
    assert allowed.status_code == 200


async def test_the_lock_applies_exactly_at_kickoff(db: AsyncSession) -> None:
    kickoff = datetime(2030, 1, 12, 21, 30, tzinfo=UTC)
    s = await _setup(db, [game("g1", 1, 1, 3, kickoff)])
    settings = (await db.execute(select(SeasonSettings))).scalars().first()
    assert settings is not None
    roster = list(
        (
            await db.execute(select(NFLPlayer).options(selectinload(NFLPlayer.team)))
        ).scalars()
    )

    async def locked_at(now: datetime) -> bool:
        lineups = await team_lineups(db, s.team, settings, roster, 2025, now)
        by_id = {p.id: p for p in lineups[0].unassigned}
        return by_id[s.players[1].id].locked

    assert await locked_at(kickoff - timedelta(seconds=1)) is False
    assert await locked_at(kickoff) is True
    assert await locked_at(kickoff + timedelta(hours=3)) is True


async def test_a_swap_touching_a_locked_player_is_refused_even_on_the_bench(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    now = datetime.now(UTC)
    s = await _setup(db, [game("g1", 1, 2, 3, FUTURE)])
    unlocked = s.players[3]
    # Place both before anything kicks off, then let KC's game start.
    kc_rb = s.players[1]
    async with client_as("uid-0") as owner:
        await owner.post(f"{s.url}/lineup", json=s.move(1, kc_rb, BENCH_1))
        await owner.post(f"{s.url}/lineup", json=s.move(1, unlocked, FLEX))
    db.add(game("g2", 1, 1, 3, now - HOUR))
    await db.flush()
    async with client_as("uid-0") as owner:
        swap = await owner.post(f"{s.url}/lineup", json=s.move(1, unlocked, BENCH_1))
        drop = await owner.post(f"{s.url}/lineup", json=s.move(1, kc_rb, None))
    assert swap.status_code == 409
    assert drop.status_code == 409


async def test_eliminated_is_per_round_and_cannot_be_moved(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    now = datetime.now(UTC)
    s = await _setup(
        db,
        [
            game("g1", 1, 2, 3, now - 48 * HOUR, score=(10, 20)),  # BUF loses
            game("g2", 2, 1, 3, FUTURE),
        ],
    )
    buf_player = s.players[3]
    async with client_as("uid-0") as owner:
        body = (await owner.get(s.url)).json()
        refused = await owner.post(f"{s.url}/lineup", json=s.move(2, buf_player, FLEX))
    wild_card, divisional = round_of(body, 1), round_of(body, 2)
    assert buf_player.id not in [p["id"] for p in wild_card["eliminated"]]
    assert [p["id"] for p in divisional["eliminated"]] == [buf_player.id]
    assert buf_player.id not in [p["id"] for p in divisional["unassigned"]]
    assert divisional["eliminated"][0]["status"] == "eliminated"
    assert refused.status_code == 409


async def test_players_placed_early_drop_out_once_their_team_is_eliminated(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    now = datetime.now(UTC)
    s = await _setup(db, [game("g1", 1, 2, 3, now + HOUR)])
    buf_player = s.players[3]
    async with client_as("uid-0") as owner:
        await owner.post(f"{s.url}/lineup", json=s.move(2, buf_player, FLEX))
        early = (await owner.get(s.url)).json()
    assert placed(early, 2) == {FLEX: buf_player.id}

    game_row = await db.get(NFLGame, "g1")
    assert game_row is not None
    game_row.game_status, game_row.home_pts, game_row.away_pts = "Completed", 3, 24
    await db.flush()
    async with client_as("uid-0") as owner:
        later = (await owner.get(s.url)).json()
        # The vacated slot is open to anyone else.
        fill = await owner.post(f"{s.url}/lineup", json=s.move(2, s.players[1], FLEX))
    assert placed(later, 2) == {}
    assert round_of(later, 2)["emptyStarterSlots"] == 3
    assert [p["id"] for p in round_of(later, 2)["eliminated"]] == [buf_player.id]
    assert placed(fill.json(), 2) == {FLEX: s.players[1].id}
    stale = (
        (
            await db.execute(
                select(LineupSlot).where(LineupSlot.player_id == buf_player.id)
            )
        )
        .scalars()
        .all()
    )
    assert stale == []


async def test_a_bye_team_is_alive_and_not_locked(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    # KC has a bye in the Wild Card; BUF plays DEN.
    s = await _setup(db, [game("g1", 1, 2, 3, datetime.now(UTC) - HOUR)])
    kc_player = s.players[1]
    async with client_as("uid-0") as owner:
        body = (await owner.get(s.url)).json()
        moved = await owner.post(f"{s.url}/lineup", json=s.move(1, kc_player, RB))
    statuses = {p["id"]: p["status"] for p in round_of(body, 1)["unassigned"]}
    assert statuses[kc_player.id] == "bye"
    assert statuses[s.players[3].id] == "alive"
    assert moved.status_code == 200
