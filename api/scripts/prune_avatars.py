"""Owner-only: delete stored pictures no profile, team or league points at (#341).

A failed delete when a picture is replaced or removed leaves an object behind. The
scheduler's roster sync runs this sweep too; run it by hand with:

    python -m api.scripts.prune_avatars

Objects younger than a day are kept (an upload is stored before its row commits).
"""

import asyncio
import logging

from api.core.logging import setup_logging
from api.db.session import close_db, get_session_factory
from api.services.avatars import prune_orphans

logger = logging.getLogger(__name__)


async def main() -> None:
    setup_logging()
    try:
        async with get_session_factory()() as session:
            removed = await prune_orphans(session)
    finally:
        await close_db()
    logger.info("Removed %d orphaned pictures", removed)


if __name__ == "__main__":
    asyncio.run(main())
