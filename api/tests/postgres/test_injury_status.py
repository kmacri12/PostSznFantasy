from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLPlayer, NFLTeam, TeamPlayer
from api.services.ingestion.players_ingest import ingest_nfl_players
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players


async def injury_statuses(db: AsyncSession) -> dict[str, str | None]:
    rows = (await db.execute(select(NFLPlayer))).scalars()
    return {p.name or "": p.injury_status for p in rows}


async def test_ingest_stores_the_tag_and_clears_it_when_tank01_does(
    db: AsyncSession,
) -> None:
    db.add(NFLTeam(id=1, team_abv="KC"))
    await db.flush()
    hurt = {
        "playerID": "1",
        "longName": "Hurt",
        "pos": "WR",
        "teamID": "1",
        "injury": {"designation": "Questionable"},
    }
    healthy = {"playerID": "2", "longName": "Healthy", "pos": "WR", "teamID": "1"}
    await ingest_nfl_players(db, raw_data=[hurt, healthy])
    assert await injury_statuses(db) == {"Hurt": "Questionable", "Healthy": None}

    await ingest_nfl_players(db, raw_data=[{**hurt, "injury": {"designation": ""}}])
    assert await injury_statuses(db) == {"Hurt": None, "Healthy": None}


async def test_the_tag_reaches_the_draft_pool_and_the_roster(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, teams, _ = await make_league(db, roster_total=2)
    hurt, healthy = await make_players(db, ["WR", "WR"])
    hurt.injury_status = "Doubtful"
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in (hurt, healthy)
    )
    await db.flush()
    async with client_as("uid-0") as owner:
        pool = (await owner.get("/api/players/draft-pool")).json()
        roster = (await owner.get(f"/api/teams/{teams[0].id}")).json()["roster"]
        lineup = (await owner.get(f"/api/teams/{teams[0].id}")).json()["lineups"]

    assert {p["id"]: p["injuryStatus"] for p in pool} == {
        hurt.id: "Doubtful",
        healthy.id: None,
    }
    assert {p["id"]: p["injuryStatus"] for p in roster} == {
        hurt.id: "Doubtful",
        healthy.id: None,
    }
    in_lineup = [
        p
        for rnd in lineup
        for p in [s["player"] for s in rnd["slots"] if s["player"]]
        + rnd["unassigned"]
    ]
    assert {p["injuryStatus"] for p in in_lineup} == {"Doubtful", None}
