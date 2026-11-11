"""Turn a feature flag on or off (the owner's kill switch), through `fly ssh console`:

python -m api.scripts.set_feature_flag bracket off
"""

import argparse
import asyncio
import logging
from collections.abc import Sequence

from api.core.logging import setup_logging
from api.db.session import close_db, get_session_factory
from api.services.feature_flags import DEFAULTS, set_flag

logger = logging.getLogger(__name__)


async def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Turn a feature flag on or off.")
    parser.add_argument("flag", choices=sorted(DEFAULTS))
    parser.add_argument("state", choices=("on", "off"))
    args = parser.parse_args(argv)
    setup_logging()

    try:
        async with get_session_factory()() as session:
            await set_flag(session, args.flag, args.state == "on")
            await session.commit()
    finally:
        await close_db()
    logger.info("Feature flag %s is now %s", args.flag, args.state)


if __name__ == "__main__":
    asyncio.run(main())
