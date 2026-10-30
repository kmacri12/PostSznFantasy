from decimal import Decimal

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LeagueSettings,
    LeagueStanding,
    NFLGame,
    NFLPlayerGameStats,
    NFLTeam,
    TeamPlayer,
)
from api.services.draft_flow import undo_last_pick
from api.services.draft_picks import record_pick
from api.services.scheduler import run_poll_cycle
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players
from api.tests.postgres.test_live_polling import NOW, FakeClient, box, summary


async def _stored(db: AsyncSession, league_id: int) -> dict[int, LeagueStanding]:
    rows = (
        (
            await db.execute(
                select(LeagueStanding)
                .where(LeagueStanding.league_id == league_id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    return {row.team_id: row for row in rows}


async def test_starters_score_per_round_and_the_bench_does_not(
    db: AsyncSession,
) -> None:
    league, _, teams, _ = await make_league(db, draft_status="completed")
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=True)
    db.add_all([kc, buf])
    await db.flush()
    starter, bench = await make_players(db, ["QB", "QB"], nfl_team=kc)
    (rival,) = await make_players(db, ["QB"], nfl_team=buf, first_id=2000)
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
            for p in (starter, bench)
        ]
        + [TeamPlayer(team_id=teams[1].id, league_id=league.id, player_id=rival.id)]
    )
    db.add_all(
        [
            NFLGame(id="wc", season=2025, season_type="post", game_week=1),
            NFLGame(id="div", season=2025, season_type="post", game_week=20),
        ]
    )
    await db.flush()
    # 300 yds + 2 TD = 20 points; the 40-point bench QB must not count.
    db.add_all(
        [
            NFLPlayerGameStats(
                game_id="wc", player_id=starter.id, passing_yards=300,
                passing_touchdowns=2,
            ),
            NFLPlayerGameStats(
                game_id="div", player_id=starter.id, passing_yards=100
            ),
            NFLPlayerGameStats(
                game_id="wc", player_id=bench.id, passing_yards=1000
            ),
            NFLPlayerGameStats(game_id="wc", player_id=rival.id, passing_yards=50),
        ]
    )  # fmt: skip
    await db.flush()

    await recompute_standings(db, 2025)

    rows = await _stored(db, league.id)
    first, second = rows[teams[0].id], rows[teams[1].id]
    assert (first.rank, first.wild_card, first.divisional) == (1, 20, 4)  # type: ignore[comparison-overlap]
    assert first.total == Decimal("24")
    assert (first.conf_champ, first.super_bowl) == (0, 0)  # type: ignore[comparison-overlap]
    assert (second.rank, second.total, second.players_left) == (2, Decimal("2"), 1)
    assert first.players_left == 2


async def _two_team_league(db: AsyncSession) -> tuple[int, list[int]]:
    league, _, teams, _ = await make_league(db, draft_status="completed")
    db.add_all([NFLTeam(id=1, team_abv="KC", is_active=True)])
    db.add(NFLTeam(id=2, team_abv="BUF", is_active=True))
    await db.flush()
    (kc_qb,) = await make_players(db, ["QB"], nfl_team=await db.get(NFLTeam, 1))
    (buf_qb,) = await make_players(
        db, ["QB"], nfl_team=await db.get(NFLTeam, 2), first_id=2000
    )
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=kc_qb.id),
            TeamPlayer(team_id=teams[1].id, league_id=league.id, player_id=buf_qb.id),
        ]
    )
    await db.flush()
    return league.id, [t.id for t in teams]


async def test_a_poll_that_eliminates_a_team_updates_players_left(
    db: AsyncSession,
) -> None:
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    await recompute_standings(db, 2025)
    before = await _stored(db, league_id)
    assert (before[kc_owner].players_left, before[buf_owner].players_left) == (1, 1)
    assert before[kc_owner].rank == before[buf_owner].rank == 1

    client = FakeClient(
        games=[summary("g1", NOW - 3600, "Live - In Progress")],
        boxes={"g1": box("Completed", 27, 24)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    after = await _stored(db, league_id)
    assert (after[kc_owner].players_left, after[buf_owner].players_left) == (1, 0)
    assert (after[kc_owner].rank, after[buf_owner].rank) == (1, 2)


async def test_a_manual_result_updates_standings(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "admin-uid")
    get_settings.cache_clear()
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    async with client_as("admin-uid") as admin:
        response = await admin.put(
            "/api/admin/games/manual/result",
            json={
                "season": 2025,
                "teamIdHome": 1,
                "teamIdAway": 2,
                "homePts": 10,
                "awayPts": 20,
            },
        )
    get_settings.cache_clear()
    assert response.status_code == 200
    rows = await _stored(db, league_id)
    assert (rows[kc_owner].players_left, rows[buf_owner].players_left) == (0, 1)
    assert rows[buf_owner].rank == 1


async def test_a_failed_recompute_keeps_the_last_good_rows(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    league_id, (kc_owner, buf_owner) = await _two_team_league(db)
    db.add_all(
        [
            LeagueStanding(
                league_id=league_id, team_id=kc_owner, rank=1, players_left=7,
                total=Decimal("99"),
            ),
            LeagueStanding(
                league_id=league_id, team_id=buf_owner, rank=2, players_left=5,
                total=Decimal("50"),
            ),
        ]
    )  # fmt: skip
    await db.flush()

    def boom(_: object) -> None:
        raise RuntimeError("scoring blew up")

    monkeypatch.setattr("api.services.standings.rank_teams", boom)
    assert await recompute_standings(db, 2025) == 0

    rows = await _stored(db, league_id)
    assert [(rows[t].total, rows[t].players_left) for t in (kc_owner, buf_owner)] == [
        (Decimal("99"), 7),
        (Decimal("50"), 5),
    ]


async def test_finishing_the_draft_creates_a_zero_point_table(
    db: AsyncSession,
) -> None:
    league, _, teams, draft = await make_league(db, roster_total=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    qb, rb = await make_players(db, ["QB", "RB"], nfl_team=kc)
    settings = await db.scalar(
        select(LeagueSettings).where(LeagueSettings.league_id == league.id)
    )
    assert settings is not None
    assert await _stored(db, league.id) == {}

    for player in (qb, rb):
        await record_pick(db, draft, settings, player.id, acting_user=None)

    assert draft.status == "completed"
    rows = await _stored(db, league.id)
    assert {r.team_id: (r.rank, r.total, r.players_left) for r in rows.values()} == {
        t.id: (1, Decimal("0"), 1) for t in teams
    }


async def test_undoing_the_final_pick_removes_the_table(db: AsyncSession) -> None:
    league, _, teams, draft = await make_league(db, roster_total=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB"], nfl_team=kc)
    settings = await db.scalar(
        select(LeagueSettings).where(LeagueSettings.league_id == league.id)
    )
    assert settings is not None
    for player in players:
        await record_pick(db, draft, settings, player.id, acting_user=None)

    assert len(await _stored(db, league.id)) == 2
    await undo_last_pick(db, league.id)

    rows = await _stored(db, league.id)
    assert rows == {}


async def test_leagues_still_drafting_get_no_table(db: AsyncSession) -> None:
    league, _, _, _ = await make_league(db, draft_status="in_progress")

    assert await recompute_standings(db, 2025) == 0

    assert await _stored(db, league.id) == {}


async def _drafted_roster_with_scoring_bench(
    db: AsyncSession,
) -> tuple[int, int, int, int]:
    """Team 0 starts a QB and a low-scoring RB; a high-scoring RB sits on the bench."""
    league, _, teams, _ = await make_league(
        db, draft_status="completed", roster_total=3, roster_num_qb=1,
        roster_num_rb=1, roster_num_wr=0, roster_num_te=0,
        roster_num_flex_wr_rb_te=0, roster_num_k=0, roster_num_dst=0,
        roster_num_bench=1,
    )  # fmt: skip
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    qb, starter_rb, bench_rb = await make_players(db, ["QB", "RB", "RB"], nfl_team=kc)
    (free_rb,) = await make_players(db, ["RB"], nfl_team=kc, first_id=3000)
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in (qb, starter_rb, bench_rb)
    )
    db.add(NFLGame(id="wc", season=2025, season_type="post", game_week=1))
    await db.flush()
    db.add_all(
        [
            NFLPlayerGameStats(game_id="wc", player_id=starter_rb.id, rushing_yards=10),
            NFLPlayerGameStats(game_id="wc", player_id=bench_rb.id, rushing_yards=100),
            NFLPlayerGameStats(game_id="wc", player_id=free_rb.id, rushing_yards=200),
        ]
    )
    await db.flush()
    await recompute_standings(db, 2025)
    return league.id, teams[0].id, bench_rb.id, free_rb.id


async def test_a_lineup_move_recomputes_standings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, team_id, bench_rb, _ = await _drafted_roster_with_scoring_bench(db)
    assert (await _stored(db, league_id))[team_id].total == Decimal("1")

    async with client_as("uid-0") as owner:
        team = (await owner.get(f"/api/teams/{team_id}")).json()
        rb_slot = next(s["index"] for s in team["slots"] if s["slot"] == "RB")
        moved = await owner.post(
            f"/api/teams/{team_id}/lineup",
            json={"playerId": bench_rb, "slotIndex": rb_slot},
        )

    assert moved.status_code == 200
    assert (await _stored(db, league_id))[team_id].total == Decimal("10")


async def test_add_drop_recomputes_standings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, team_id, bench_rb, free_rb = await _drafted_roster_with_scoring_bench(db)
    await db.execute(
        update(LeagueSettings)
        .where(LeagueSettings.league_id == league_id)
        .values(free_agency_enabled=True)
    )

    async with client_as("uid-0") as owner:
        starter = next(
            s["player"]["id"]
            for s in (await owner.get(f"/api/teams/{team_id}")).json()["slots"]
            if s["slot"] == "RB"
        )
        swapped = await owner.post(
            f"/api/teams/{team_id}/roster",
            json={"dropPlayerId": starter, "addPlayerId": free_rb},
        )

    assert swapped.status_code == 200
    # The 200-yard free agent takes the vacated RB slot, replacing the 10-yard starter.
    assert (await _stored(db, league_id))[team_id].total == Decimal("20")


async def test_a_failing_recompute_does_not_fail_the_lineup_move(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    league_id, team_id, bench_rb, _ = await _drafted_roster_with_scoring_bench(db)

    def boom(_: object) -> None:
        raise RuntimeError("scoring blew up")

    monkeypatch.setattr("api.services.standings.rank_teams", boom)
    async with client_as("uid-0") as owner:
        team = (await owner.get(f"/api/teams/{team_id}")).json()
        rb_slot = next(s["index"] for s in team["slots"] if s["slot"] == "RB")
        moved = await owner.post(
            f"/api/teams/{team_id}/lineup",
            json={"playerId": bench_rb, "slotIndex": rb_slot},
        )

    assert moved.status_code == 200
    assert (await _stored(db, league_id))[team_id].total == Decimal("1")
