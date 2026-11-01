from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayerGameStats,
    NFLTeam,
    SeasonSettings,
    SeasonStanding,
    TeamPlayer,
)
from api.services.draft_flow import undo_last_pick
from api.services.draft_picks import record_pick
from api.services.scheduler import run_poll_cycle
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season
from api.tests.postgres.test_live_polling import NOW, FakeClient, box, summary


async def _stored(db: AsyncSession, season_id: int) -> dict[int, SeasonStanding]:
    rows = (
        (
            await db.execute(
                select(SeasonStanding)
                .where(SeasonStanding.season_id == season_id)
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
    season, _, teams, _ = await make_season(db, draft_status="completed")
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=True, in_playoffs=True)
    db.add_all([kc, buf])
    await db.flush()
    starter, bench = await make_players(db, ["QB", "QB"], nfl_team=kc)
    (rival,) = await make_players(db, ["QB"], nfl_team=buf, first_id=2000)
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=p.id)
            for p in (starter, bench)
        ]
        + [TeamPlayer(team_id=teams[1].id, season_id=season.id, player_id=rival.id)]
    )
    db.add_all(
        [
            NFLGame(id="wc", season=2025, season_type="post", game_week=1),
            NFLGame(id="div", season=2025, season_type="post", game_week=20),
        ]
    )
    db.add_all(
        [
            LineupSlot(
                team_id=teams[0].id, round=1, player_id=starter.id, slot_index=0
            ),
            LineupSlot(
                team_id=teams[0].id, round=2, player_id=starter.id, slot_index=0
            ),
            LineupSlot(team_id=teams[0].id, round=1, player_id=bench.id, slot_index=9),
            LineupSlot(team_id=teams[1].id, round=1, player_id=rival.id, slot_index=0),
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

    rows = await _stored(db, season.id)
    first, second = rows[teams[0].id], rows[teams[1].id]
    assert (first.rank, first.wild_card, first.divisional) == (1, 20, 4)  # type: ignore[comparison-overlap]
    assert first.total == Decimal("24")
    assert (first.conf_champ, first.super_bowl) == (0, 0)  # type: ignore[comparison-overlap]
    assert (second.rank, second.total, second.players_left) == (2, Decimal("2"), 1)
    assert first.players_left == 2


async def _two_team_league(db: AsyncSession) -> tuple[int, list[int]]:
    season, _, teams, _ = await make_season(db, draft_status="completed")
    db.add_all([NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)])
    db.add(NFLTeam(id=2, team_abv="BUF", is_active=True, in_playoffs=True))
    await db.flush()
    (kc_qb,) = await make_players(db, ["QB"], nfl_team=await db.get(NFLTeam, 1))
    (buf_qb,) = await make_players(
        db, ["QB"], nfl_team=await db.get(NFLTeam, 2), first_id=2000
    )
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=kc_qb.id),
            TeamPlayer(team_id=teams[1].id, season_id=season.id, player_id=buf_qb.id),
        ]
    )
    await db.flush()
    return season.id, [t.id for t in teams]


async def test_a_poll_that_eliminates_a_team_updates_players_left(
    db: AsyncSession,
) -> None:
    season_id, (kc_owner, buf_owner) = await _two_team_league(db)
    await recompute_standings(db, 2025)
    before = await _stored(db, season_id)
    assert (before[kc_owner].players_left, before[buf_owner].players_left) == (1, 1)
    assert before[kc_owner].rank == before[buf_owner].rank == 1

    client = FakeClient(
        games=[summary("g1", NOW - 3600, "Live - In Progress")],
        boxes={"g1": box("Completed", 27, 24)},
    )
    await run_poll_cycle(db, 2025, client=client, now=NOW)  # type: ignore[arg-type]

    after = await _stored(db, season_id)
    assert (after[kc_owner].players_left, after[buf_owner].players_left) == (1, 0)
    # Players left is shown, but it no longer breaks ties: both teams still have 0.
    assert (after[kc_owner].rank, after[buf_owner].rank) == (1, 1)


async def test_a_manual_result_updates_standings(
    db: AsyncSession, client_as: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "admin-uid")
    get_settings.cache_clear()
    season_id, (kc_owner, buf_owner) = await _two_team_league(db)
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
    rows = await _stored(db, season_id)
    assert (rows[kc_owner].players_left, rows[buf_owner].players_left) == (0, 1)
    assert rows[buf_owner].rank == 1


async def test_a_failed_recompute_keeps_the_last_good_rows(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    season_id, (kc_owner, buf_owner) = await _two_team_league(db)
    db.add_all(
        [
            SeasonStanding(
                season_id=season_id, team_id=kc_owner, rank=1, players_left=7,
                total=Decimal("99"),
            ),
            SeasonStanding(
                season_id=season_id, team_id=buf_owner, rank=2, players_left=5,
                total=Decimal("50"),
            ),
        ]
    )  # fmt: skip
    await db.flush()

    def boom(_: object) -> None:
        raise RuntimeError("scoring blew up")

    monkeypatch.setattr("api.services.standings.rank_teams", boom)
    assert await recompute_standings(db, 2025) == 0

    rows = await _stored(db, season_id)
    assert [(rows[t].total, rows[t].players_left) for t in (kc_owner, buf_owner)] == [
        (Decimal("99"), 7),
        (Decimal("50"), 5),
    ]


async def test_finishing_the_draft_creates_a_zero_point_table(
    db: AsyncSession,
) -> None:
    season, _, teams, draft = await make_season(db, roster_total=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    qb, rb = await make_players(db, ["QB", "RB"], nfl_team=kc)
    settings = await db.scalar(
        select(SeasonSettings).where(SeasonSettings.season_id == season.id)
    )
    assert settings is not None
    assert await _stored(db, season.id) == {}

    for player in (qb, rb):
        await record_pick(db, draft, settings, player.id, acting_user=None)

    assert draft.status == "completed"
    rows = await _stored(db, season.id)
    assert {r.team_id: (r.rank, r.total, r.players_left) for r in rows.values()} == {
        t.id: (1, Decimal("0"), 1) for t in teams
    }


async def test_undoing_the_final_pick_removes_the_table(db: AsyncSession) -> None:
    season, _, teams, draft = await make_season(db, roster_total=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB"], nfl_team=kc)
    settings = await db.scalar(
        select(SeasonSettings).where(SeasonSettings.season_id == season.id)
    )
    assert settings is not None
    for player in players:
        await record_pick(db, draft, settings, player.id, acting_user=None)

    assert len(await _stored(db, season.id)) == 2
    await undo_last_pick(db, season.id)

    rows = await _stored(db, season.id)
    assert rows == {}


async def test_leagues_still_drafting_get_no_table(db: AsyncSession) -> None:
    season, _, _, _ = await make_season(db, draft_status="in_progress")

    assert await recompute_standings(db, 2025) == 0

    assert await _stored(db, season.id) == {}


async def test_lineup_moves_and_settings_changes_recompute_standings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, draft_status="completed")
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    (qb,) = await make_players(db, ["QB"], nfl_team=kc)
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, season_id=season.id, player_id=qb.id),
            NFLGame(id="wc", season=2025, season_type="post", game_week=1),
        ]
    )
    await db.flush()
    db.add(NFLPlayerGameStats(game_id="wc", player_id=qb.id, passing_yards=300))
    await db.flush()
    await recompute_standings(db, 2025)
    assert (await _stored(db, season.id))[teams[0].id].total == 0

    async with client_as("uid-0") as owner:
        moved = await owner.post(
            f"/api/teams/{teams[0].id}/lineup",
            json={"round": 1, "playerId": qb.id, "slotIndex": 0},
        )
        assert moved.status_code == 200
        assert (await _stored(db, season.id))[teams[0].id].total == Decimal("12")

        await owner.patch(
            f"/api/seasons/{season.id}/settings", json={"multiplierWildCard": 2}
        )
        assert (await _stored(db, season.id))[teams[0].id].total == Decimal("24")

        await owner.post(
            f"/api/teams/{teams[0].id}/lineup",
            json={"round": 1, "playerId": qb.id, "slotIndex": None},
        )
        assert (await _stored(db, season.id))[teams[0].id].total == 0
