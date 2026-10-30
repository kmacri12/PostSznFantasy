"""Rebuild a throwaway database from the committed e2e fixtures (never touches real data).

    python -m api.scripts.seed_e2e            # uses PG_URI / the usual settings

Refuses to run unless the database name ends in `_e2e` or `_test`, because it drops
every table first.
"""

import argparse
import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from api.core.config import get_settings
from api.core.logging import setup_logging
from api.db import session as db_session
from api.db.models import Base
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.services.ingestion.schemas import safe_int

logger = logging.getLogger("seed_e2e")

FIXTURES = Path(__file__).resolve().parents[2] / "e2e" / "fixtures"
SAFE_DATABASE_SUFFIXES = ("_e2e", "_e2e_live", "_test")


def _database_name() -> str:
    name = make_url(get_settings().async_database_url).database or ""
    if not name.endswith(SAFE_DATABASE_SUFFIXES):
        raise SystemExit(
            f"Refusing to wipe database {name!r}: its name must end in "
            f"one of {SAFE_DATABASE_SUFFIXES}."
        )
    return name


async def _create_database_if_missing(name: str) -> None:
    admin_url = make_url(get_settings().async_database_url).set(database="postgres")
    engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name}
            )
            if not exists:
                await conn.execute(text(f'CREATE DATABASE "{name}"'))
    finally:
        await engine.dispose()


async def _recreate_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        for schema in ("fantasy", "nfl"):
            await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
            await conn.execute(text(f"CREATE SCHEMA {schema}"))
        await conn.run_sync(Base.metadata.create_all)


def _season_stats_row(raw: dict[str, Any]) -> NFLPlayerSeasonStats:
    columns = {k: v for k, v in raw.items() if k not in ("playerId", "season")}
    return NFLPlayerSeasonStats(
        season=raw["season"], player_id=raw["playerId"], **columns
    )


async def _load_fixtures() -> None:
    data = json.loads((FIXTURES / "nfl.json").read_text())
    async with db_session.get_session_factory()() as db:
        db.add_all(
            NFLTeam(
                id=t["id"],
                team_abv=t["teamAbv"],
                team_city=t["teamCity"],
                team_name=t["teamName"],
            )
            for t in data["teams"]
        )
        await db.flush()
        db.add_all(
            NFLPlayer(
                id=p["id"],
                name=p["name"],
                position=p["position"],
                jersey_num=p["jerseyNum"],
                team_id=p["teamId"],
            )
            for p in data["players"]
        )
        await db.flush()
        db.add_all(_season_stats_row(row) for row in data["seasonStats"])
        db.add_all(
            NFLGame(
                id=g["gameID"],
                game_status=g["gameStatus"],
                game_date=g["gameDate"],
                game_time_epoch=g["gameTime_epoch"],
                game_week=20,
                season=safe_int(g["season"]),
                team_id_home=safe_int(g["teamIDHome"]),
                team_id_away=safe_int(g["teamIDAway"]),
                season_type="post",
            )
            for g in data["games"]
        )
        await db.commit()


async def main() -> None:
    argparse.ArgumentParser(description=__doc__).parse_args()
    setup_logging()
    name = _database_name()
    await _create_database_if_missing(name)
    db_session.init_db()
    assert db_session.engine is not None
    await _recreate_schema(db_session.engine)
    await _load_fixtures()
    await db_session.close_db()
    logger.info("Seeded %s from %s", name, FIXTURES)


if __name__ == "__main__":
    asyncio.run(main())
