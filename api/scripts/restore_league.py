"""Owner-only: bring a deleted league back (#231). Never exposed in the app.

Run it where the API runs (`fly ssh console`):

    python -m api.scripts.restore_league <league id>

The league returns with all its seasons; its invite stays revoked, so a
commissioner creates a new one.
"""

import argparse
import asyncio
import logging
from collections.abc import Sequence

from api.core.logging import setup_logging
from api.db.session import close_db, get_session_factory
from api.services.live_leagues import restore_league

logger = logging.getLogger(__name__)


async def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Restore a deleted league.")
    parser.add_argument("league_id", type=int)
    args = parser.parse_args(argv)
    setup_logging()

    try:
        async with get_session_factory()() as session:
            restored = await restore_league(session, args.league_id)
            await session.commit()
    finally:
        await close_db()
    if not restored:
        raise SystemExit(f"League {args.league_id} does not exist or is not deleted")
    logger.info("League %d restored", args.league_id)


if __name__ == "__main__":
    asyncio.run(main())
