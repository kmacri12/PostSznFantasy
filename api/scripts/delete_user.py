"""Owner-only fallback: delete a member's account the way the app's Delete my account does (#330).

Run it where the API runs (`fly ssh console`):

    python -m api.scripts.delete_user <user id>

Needs SUPABASE_SERVICE_ROLE_KEY. Refuses while the member is the only commissioner of a
league with other members, like the app; hand the league over first.
"""

import argparse
import asyncio
import logging
from collections.abc import Sequence

from api.core.logging import setup_logging
from api.db.models.user import User
from api.db.session import close_db, get_session_factory
from api.services.account_deletion import AccountDeletionError, delete_account

logger = logging.getLogger(__name__)


async def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Delete a member's account.")
    parser.add_argument("user_id", type=int)
    args = parser.parse_args(argv)
    setup_logging()

    try:
        async with get_session_factory()() as session:
            user = await session.get(User, args.user_id)
            if user is None:
                raise SystemExit(f"User {args.user_id} does not exist")
            try:
                result = await delete_account(session, user)
            except AccountDeletionError as exc:
                raise SystemExit(str(exc)) from exc
            await session.commit()
    finally:
        await close_db()
    logger.info(
        "User %d deleted: left %d leagues, freed %d teams",
        args.user_id,
        result.leagues_left,
        result.teams_freed,
    )


if __name__ == "__main__":
    asyncio.run(main())
