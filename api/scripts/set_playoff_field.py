"""Set the playoff field (the draft pool) by team abbreviation.

Ingest marks only the 12 Wild Card teams; the two top seeds have byes, so the owner
sets the full field once the seeds are known, through `fly ssh console`:

    python -m api.scripts.set_playoff_field BUF KC BAL ...
"""

import argparse
import asyncio
import logging
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.logging import setup_logging
from api.db.models.nfl import NFLTeam
from api.db.session import close_db, get_session_factory
from api.services.playoff_field import PlayoffFieldError, set_playoff_field

logger = logging.getLogger("set_playoff_field")


async def set_field_from_abbreviations(
    db: AsyncSession, abbreviations: Sequence[str]
) -> list[NFLTeam]:
    wanted = {abv.strip().upper() for abv in abbreviations}
    teams = list(await db.scalars(select(NFLTeam).where(NFLTeam.team_abv.in_(wanted))))
    if unknown := sorted(wanted - {team.team_abv for team in teams}):
        known = list(
            await db.scalars(
                select(NFLTeam.team_abv)
                .where(NFLTeam.team_abv.is_not(None))
                .order_by(NFLTeam.team_abv)
            )
        )
        if not known:
            raise PlayoffFieldError(
                "No NFL teams are loaded; run api.scripts.seed_nfl_data first"
            )
        raise PlayoffFieldError(
            f"Unknown team abbreviations: {', '.join(unknown)}. "
            f"Known: {', '.join(abv or '' for abv in known)}"
        )
    await set_playoff_field(db, [team.id for team in teams])
    return sorted(teams, key=lambda team: team.team_abv or "")


async def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Replace the playoff field (the draft pool) with these teams."
    )
    parser.add_argument(
        "teams", nargs="+", metavar="TEAM", help="team abbreviation, e.g. BUF"
    )
    args = parser.parse_args(argv)
    setup_logging()

    try:
        async with get_session_factory()() as session:
            try:
                field = await set_field_from_abbreviations(session, args.teams)
            except PlayoffFieldError as exc:
                raise SystemExit(f"Playoff field not changed: {exc}") from exc
            await session.commit()
    finally:
        await close_db()
    logger.info(
        "Playoff field set (%d teams): %s",
        len(field),
        ", ".join(f"{t.team_abv} {t.team_city} {t.team_name}" for t in field),
    )


if __name__ == "__main__":
    asyncio.run(main())
