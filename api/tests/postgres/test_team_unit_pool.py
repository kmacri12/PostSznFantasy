"""Epic 13.3: with team QB / team K on, the pool lists one QB / K per NFL team."""

import logging
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    DepthChartStarter,
    NFLPlayer,
    NFLPlayerSeasonStats,
    NFLTeam,
)
from api.models.enums import PlayerPosition
from api.services import draft_flow
from api.services.draft_picks import DraftPickError, make_pick
from api.services.ingestion.depth_chart_ingest import ingest_depth_charts
from api.services.team_starters import resolve_depth_chart_starters
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

KC, PHI = 1, 2


class Field:
    """KC and PHI, each with a starting and a backup QB and kicker, plus a RB."""

    async def build(self, db: AsyncSession) -> "Field":
        db.add_all(
            [
                NFLTeam(id=KC, team_abv="KC", is_active=True, in_playoffs=True),
                NFLTeam(id=PHI, team_abv="PHI", is_active=True, in_playoffs=True),
                NFLTeam(id=3, team_abv="OUT", is_active=True),
            ]
        )
        await db.flush()
        rows = [
            (10, "Mahomes", "QB", KC), (11, "Minshew", "QB", KC),
            (12, "Butker", "PK", KC), (13, "Backup Kicker KC", "PK", KC),
            (14, "Kelce Back", "RB", KC),
            (20, "Hurts", "QB", PHI), (21, "McKee", "QB", PHI),
            (22, "Elliott", "PK", PHI), (23, "Backup Kicker PHI", "PK", PHI),
            (30, "Out QB", "QB", 3),
        ]  # fmt: skip
        db.add_all(
            NFLPlayer(id=pid, name=name, position=pos, team_id=team)
            for pid, name, pos, team in rows
        )
        await db.flush()
        self.db = db
        await self.depth_chart(
            {KC: (10, 12), PHI: (20, 22)},
        )
        return self

    async def depth_chart(self, starters: dict[int, tuple[int, int]]) -> None:
        body: list[dict[str, Any]] = [
            {
                "teamID": str(team),
                "depthChart": {
                    "QB": [{"depthPosition": "QB1", "playerID": str(qb)}],
                    "PK": [{"depthPosition": "PK1", "playerID": str(pk)}],
                },
            }
            for team, (qb, pk) in starters.items()
        ]
        await ingest_depth_charts(self.db, raw_data=body)

    async def pool(
        self, client_as: ClientFactory, league_id: int, uid: str = "uid-0"
    ) -> dict[int, dict[str, Any]]:
        async with client_as(uid) as user:
            response = await user.get(f"/api/players/draft-pool?seasonId={league_id}")
        assert response.status_code == 200
        return {player["id"]: player for player in response.json()}


async def test_the_pool_lists_only_the_starting_qb_of_each_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, team_qb=True)
    field = await Field().build(db)

    pool = await field.pool(client_as, season.id)

    qbs = {pid for pid, p in pool.items() if p["position"] == "QB"}
    assert qbs == {10, 20}
    # Team K is a separate choice: both kickers per team are still listed.
    assert {12, 13, 22, 23} <= set(pool)
    assert 14 in pool


async def test_team_k_lists_one_kicker_per_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, team_k=True)
    field = await Field().build(db)

    pool = await field.pool(client_as, season.id)

    assert {pid for pid, p in pool.items() if p["position"] == "PK"} == {12, 22}
    assert {10, 11, 20, 21} <= set(pool)


async def test_with_both_off_every_qb_and_k_is_listed_and_unflagged(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    field = await Field().build(db)

    pool = await field.pool(client_as, season.id)

    assert {10, 11, 12, 13, 14, 20, 21, 22, 23} == set(pool)
    assert not any(player["scoresWholeTeam"] for player in pool.values())


async def test_listed_qbs_and_ks_say_they_score_the_whole_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, team_qb=True, team_k=True)
    field = await Field().build(db)

    pool = await field.pool(client_as, season.id)

    assert {pid for pid, p in pool.items() if p["scoresWholeTeam"]} == {10, 12, 20, 22}
    assert pool[14]["scoresWholeTeam"] is False


async def test_without_a_league_the_pool_is_unchanged(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db, team_qb=True)
    await Field().build(db)
    async with client_as("uid-0") as user:
        everyone = (await user.get("/api/players/draft-pool")).json()

    assert {10, 11, 20, 21} <= {player["id"] for player in everyone}


async def test_a_backup_qb_cannot_be_drafted_but_the_starter_can(
    db: AsyncSession,
) -> None:
    season, users, _, _ = await make_season(db, team_qb=True)
    await Field().build(db)

    with pytest.raises(DraftPickError, match="starting QB") as refused:
        await make_pick(db, season.id, users[0], 11)
    picked = await make_pick(db, season.id, users[0], 10)

    assert refused.value.code == "not_in_pool"
    assert picked.player_name == "Mahomes"


async def test_drafting_a_team_qb_keeps_the_rest_of_his_team_out(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, team_qb=True)
    field = await Field().build(db)
    await make_pick(db, season.id, users[0], 10)

    pool = await field.pool(client_as, season.id)
    with pytest.raises(DraftPickError):
        await make_pick(db, season.id, users[1], 11)

    assert {pid for pid, p in pool.items() if p["position"] == "QB"} <= {10, 20}


async def test_a_unit_already_covered_by_a_drafted_backup_is_closed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    # Team QB was off when a backup went; turning it on mid-draft closes his team.
    season, users, _, _ = await make_season(db)
    field = await Field().build(db)
    await make_pick(db, season.id, users[0], 21)  # PHI's backup
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )

    pool = await field.pool(client_as, season.id)
    with pytest.raises(DraftPickError, match="already covered") as refused:
        await make_pick(db, season.id, users[1], 20)  # PHI's starter

    assert 20 not in pool and 10 in pool
    assert refused.value.code == "not_in_pool"


async def test_auto_pick_never_takes_a_backup_even_when_he_scores_more(
    db: AsyncSession,
) -> None:
    season, _, _, _ = await make_season(db, team_qb=True)
    await Field().build(db)
    db.add_all(
        NFLPlayerSeasonStats(season="2025", player_id=pid, passing_yards=yards)
        for pid, yards in ((11, 9000), (21, 8000), (10, 100), (20, 50))
    )
    await db.flush()

    result = await draft_flow.auto_pick(db, season.id)

    assert result.pick.player_id == 10


async def test_the_draft_board_flags_a_picked_team_qb(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, team_qb=True)
    await Field().build(db)
    await make_pick(db, season.id, users[0], 10)
    await make_pick(db, season.id, users[1], 14)

    async with client_as("uid-0") as user:
        state = (await user.get(f"/api/drafts/draft-info/{season.id}")).json()

    flags = {pick["playerName"]: pick["scoresWholeTeam"] for pick in state["picks"]}
    assert flags == {"Mahomes": True, "Kelce Back": False}


async def test_ingesting_the_depth_chart_replaces_the_stored_starters(
    db: AsyncSession,
) -> None:
    field = await Field().build(db)

    await field.depth_chart({KC: (11, 13)})

    stored = {
        (row.team_id, row.position): row.player_id
        for row in (await db.execute(select(DepthChartStarter))).scalars()
    }
    assert stored == {(KC, "QB"): 11, (KC, "K"): 13}


async def test_a_depth_chart_outage_keeps_the_last_starters(db: AsyncSession) -> None:
    await Field().build(db)

    assert await ingest_depth_charts(db, raw_data=[]) == 0

    starters = await resolve_depth_chart_starters(db)
    assert starters[(KC, PlayerPosition.QB)].player_id == 10


async def test_a_team_without_a_depth_chart_falls_back_to_pass_attempts_and_kicks(
    db: AsyncSession, caplog: pytest.LogCaptureFixture
) -> None:
    field = await Field().build(db)
    await field.depth_chart({KC: (10, 12)})  # PHI has no depth chart entry
    db.add_all(
        [
            NFLPlayerSeasonStats(season="2025", player_id=20, passing_attempts=30),
            NFLPlayerSeasonStats(season="2025", player_id=21, passing_attempts=300),
            NFLPlayerSeasonStats(season="2025", player_id=22, kicking_xp_made=5),
            NFLPlayerSeasonStats(
                season="2025", player_id=23, kicking_fg_made=10, kicking_fg_missed=2
            ),
        ]
    )
    await db.flush()

    with caplog.at_level(logging.WARNING):
        starters = await resolve_depth_chart_starters(db)

    assert starters[(PHI, PlayerPosition.QB)].player_id == 21
    assert starters[(PHI, PlayerPosition.K)].player_id == 23
    assert not starters[(PHI, PlayerPosition.QB)].from_depth_chart
    assert starters[(KC, PlayerPosition.QB)].from_depth_chart
    assert "PHI" in caplog.text and "falling back" in caplog.text.lower()


async def test_a_listed_starter_who_left_the_team_is_not_trusted(
    db: AsyncSession,
) -> None:
    await Field().build(db)
    traded = await db.get(NFLPlayer, 10)
    assert traded is not None
    traded.team_id = PHI
    await db.flush()
    db.add(NFLPlayerSeasonStats(season="2025", player_id=11, passing_attempts=5))
    await db.flush()

    starters = await resolve_depth_chart_starters(db)

    assert starters[(KC, PlayerPosition.QB)].player_id == 11
    assert not starters[(KC, PlayerPosition.QB)].from_depth_chart


async def test_only_playoff_teams_get_a_starter(db: AsyncSession) -> None:
    await Field().build(db)

    starters = await resolve_depth_chart_starters(db)

    assert {team for team, _ in starters} == {KC, PHI}
