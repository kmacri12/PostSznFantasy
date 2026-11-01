"""Epic 16: playoff-only pool, kickoff cutoff, position caps, auto-pick, locks."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import DraftPick, NFLGame, NFLPlayer, NFLTeam
from api.services import draft_flow
from api.services.draft_picks import DraftPickError, make_pick
from api.services.ingestion.players_ingest import ingest_nfl_players
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_playoff_field, make_season


def wild_card_game(kickoff: datetime) -> NFLGame:
    return NFLGame(
        id="20260110_A@B",
        season=2025,
        season_type="post",
        game_week=19,
        game_time_epoch=str(kickoff.timestamp()),
    )


async def test_fullbacks_are_running_backs_after_ingest(db: AsyncSession) -> None:
    db.add(NFLTeam(id=1, team_abv="KC"))
    await db.flush()
    raw = [
        {"playerID": "1", "longName": "Fullback", "pos": "FB", "teamID": "1"},
        {"playerID": "2", "longName": "Tight End", "pos": "TE", "teamID": "1"},
    ]
    await ingest_nfl_players(db, raw_data=raw)
    positions = {
        p.name: p.position for p in (await db.execute(select(NFLPlayer))).scalars()
    }
    assert positions == {"Fullback": "RB", "Tight End": "TE"}


async def test_draft_cannot_start_until_the_field_is_set(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        early = await commissioner.post(f"/api/drafts/{season.id}/control/start")
        await make_playoff_field(db)
        ready = await commissioner.post(f"/api/drafts/{season.id}/control/start")
    assert early.status_code == 409
    assert "playoff field" in early.json()["detail"]
    assert ready.status_code == 200


async def test_pool_is_playoff_players_at_draftable_positions(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db)
    kc = NFLTeam(id=1, team_abv="KC", in_playoffs=True)
    out = NFLTeam(id=2, team_abv="OUT")
    db.add_all([kc, out])
    await db.flush()
    await make_players(db, ["QB", "LB"], nfl_team=kc)
    await make_players(db, ["QB"], nfl_team=out, first_id=2000)
    async with client_as("uid-0") as user:
        pool = (await user.get("/api/players/draft-pool")).json()
    assert [(p["position"], p["teamAbv"]) for p in pool] == [("QB", "KC")]


async def test_picking_outside_the_pool_is_refused(db: AsyncSession) -> None:
    _, users, _, draft = await make_season(db)
    out = NFLTeam(id=2, team_abv="OUT")
    db.add(out)
    await db.flush()
    (player,) = await make_players(db, ["QB"], nfl_team=out)
    with pytest.raises(DraftPickError, match="playoff team") as exc:
        await make_pick(db, draft.season_id, users[0], player.id)
    assert exc.value.code == "not_in_pool"


async def test_start_and_scheduling_are_refused_after_the_first_wild_card_kickoff(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    await make_playoff_field(db)
    kickoff = datetime.now(UTC) + timedelta(hours=2)
    db.add(wild_card_game(kickoff))
    await db.flush()
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-0") as commissioner:
        just_before = await commissioner.patch(
            url, json={"startTime": (kickoff - timedelta(minutes=5)).isoformat()}
        )
        after = await commissioner.patch(
            url, json={"startTime": (kickoff + timedelta(minutes=5)).isoformat()}
        )
        game = await db.get(NFLGame, "20260110_A@B")
        assert game is not None
        game.game_time_epoch = str((datetime.now(UTC) - timedelta(hours=1)).timestamp())
        await db.flush()
        started_late = await commissioner.post(f"{url}/control/start")
        scheduled_late = await commissioner.patch(
            url,
            json={"startTime": (datetime.now(UTC) + timedelta(minutes=1)).isoformat()},
        )
    assert just_before.status_code == 200
    assert after.status_code == 409
    assert "first Wild Card kickoff" in after.json()["detail"]
    assert started_late.status_code == 409
    assert scheduled_late.status_code == 409


async def test_a_running_draft_keeps_going_after_kickoff(db: AsyncSession) -> None:
    _, users, _, draft = await make_season(db)
    db.add(wild_card_game(datetime.now(UTC) - timedelta(hours=1)))
    (player,) = await make_players(db, ["QB"])
    await db.flush()
    result = await make_pick(db, draft.season_id, users[0], player.id)
    assert result.pick.number_pick_overall == 1


async def test_capped_position_is_refused_with_a_plain_reason_over_rest(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, roster_total=4, roster_max_qb=1)
    players = await make_players(db, ["QB", "QB", "RB", "RB"])
    url = f"/api/drafts/{season.id}/picks"
    async with client_as("uid-0") as a:
        await a.post(url, json={"playerId": players[0].id})
    async with client_as("uid-1") as b:
        await b.post(url, json={"playerId": players[2].id})
        await b.post(url, json={"playerId": players[3].id})
    async with client_as("uid-0") as a:
        capped = await a.post(url, json={"playerId": players[1].id})
    assert capped.status_code == 409
    assert capped.json()["detail"] == (
        "You already have 1 QB, the most your league allows"
    )


async def test_draft_state_lists_only_real_caps(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(
        db, roster_total=18, roster_max_qb=2, roster_max_k=2, roster_max_dst=2
    )
    async with client_as("uid-0") as user:
        state = (await user.get(f"/api/drafts/draft-info/{season.id}")).json()
    assert state["positionCaps"] == {"QB": 2, "K": 2, "DST": 2}


async def test_autopick_never_drafts_a_third_qb_from_the_queue(
    db: AsyncSession,
) -> None:
    season, users, teams, draft = await make_season(db, roster_total=6, roster_max_qb=2)
    qbs = await make_players(db, ["QB", "QB", "QB"])
    rbs = await make_players(db, ["RB"] * 6, first_id=2000)
    await draft_flow.set_queue(db, draft.id, teams[0].id, [q.id for q in qbs])

    await draft_flow.auto_pick(db, season.id)  # pick 1, team 0: first queued QB
    await make_pick(db, season.id, users[1], rbs[0].id)  # picks 2 and 3: team 1
    await make_pick(db, season.id, users[1], rbs[1].id)
    await draft_flow.auto_pick(db, season.id)  # pick 4, team 0: second queued QB
    fifth = await draft_flow.auto_pick(db, season.id)  # pick 5, team 0 again

    assert fifth.pick.team_id == teams[0].id
    assert fifth.pick.player_id not in {q.id for q in qbs}
    held = (
        await db.execute(
            select(DraftPick.player_id).where(DraftPick.team_id == teams[0].id)
        )
    ).scalars()
    assert sum(pid in {q.id for q in qbs} for pid in held) == 2


async def test_autopick_takes_the_best_scorer_and_skips_non_pool_players(
    db: AsyncSession,
) -> None:
    from api.db.models import NFLPlayerSeasonStats

    season, _, _, _ = await make_season(db, roster_total=2)
    out = NFLTeam(id=2, team_abv="OUT")
    db.add(out)
    await db.flush()
    (star_out,) = await make_players(db, ["QB"], nfl_team=out, first_id=500)
    low, high = await make_players(db, ["QB", "QB"], first_id=2000)
    for player, yards in ((star_out, 9000), (low, 100), (high, 4000)):
        db.add(
            NFLPlayerSeasonStats(
                season="2025", player_id=player.id, passing_yards=yards
            )
        )
    await db.flush()
    result = await draft_flow.auto_pick(db, season.id)
    assert result.pick.player_id == high.id


async def test_caps_and_roster_lock_at_draft_start_but_scoring_stays_editable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    await make_playoff_field(db)
    url = f"/api/seasons/{season.id}/settings"
    async with client_as("uid-0") as commissioner:
        before = await commissioner.patch(url, json={"rosterMaxQb": 3})
        await commissioner.post(f"/api/drafts/{season.id}/order/randomize")
        await commissioner.post(f"/api/drafts/{season.id}/control/start")
        caps = await commissioner.patch(url, json={"rosterMaxQb": 1})
        slots = await commissioner.patch(url, json={"rosterNumRb": 5})
        resize = await commissioner.patch(
            f"/api/seasons/{season.id}", json={"numberTeams": 4}
        )
        scoring = await commissioner.patch(url, json={"scoringPassingTd": 6})
    assert before.status_code == 200
    assert caps.status_code == 409
    assert "position caps" in caps.json()["detail"]
    assert slots.status_code == 409
    assert resize.status_code == 409
    assert scoring.status_code == 200
    assert float(scoring.json()["scoringPassingTd"]) == 6


async def test_team_defense_without_season_stats_is_in_the_pool_and_auto_pickable(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, roster_total=2, roster_max_dst=1)
    kc = NFLTeam(id=1, team_abv="KC", in_playoffs=True)
    db.add(kc)
    await db.flush()
    # Synthetic team defenses use the negative team id and have no season-stat rows.
    db.add(NFLPlayer(id=-1, name="KC DST", position="DST", team_id=kc.id))
    await db.flush()
    async with client_as("uid-0") as user:
        pool = (await user.get("/api/players/draft-pool")).json()
    assert [p["position"] for p in pool] == ["DST"]
    result = await draft_flow.auto_pick(db, season.id)
    assert result.pick.player_id == -1


async def test_naive_start_time_is_treated_as_utc_not_a_server_error(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    db.add(wild_card_game(datetime.now(UTC) + timedelta(hours=2)))
    await db.flush()
    late = (datetime.now(UTC) + timedelta(hours=3)).replace(tzinfo=None)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.patch(
            f"/api/drafts/{season.id}", json={"startTime": late.isoformat()}
        )
    assert response.status_code == 409
