"""Set the playoff field (the draft pool) by team abbreviation.

Ingest marks only the 12 Wild Card teams; the two top seeds have byes, so the owner
sets the full field once the seeds are known, through `fly ssh console`:

    python -m api.scripts.set_playoff_field BUF KC BAL ...
"""

import argparse
import asyncio
import logging
from collections.abc import Sequence

from api.core.logging import setup_logging
from api.db.session import close_db, get_session_factory
from api.services.playoff_field import (
    PlayoffFieldError,
    set_playoff_field_by_abbreviation,
)

logger = logging.getLogger(__name__)


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
                field = await set_playoff_field_by_abbreviation(session, args.teams)
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
