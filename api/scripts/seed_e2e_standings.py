"""Writes a fixed standings snapshot for one e2e league (throwaway databases only).

Nothing in the app writes `fantasy.standings` yet, so the standings page can only be
exercised end to end by inserting rows. Teams are ranked by id; points are fixed.

    python -m api.scripts.seed_e2e_standings --league 3
"""

import argparse
import asyncio
from decimal import Decimal

from sqlalchemy import select

from api.db import session as db_session
from api.db.models.league import LeagueStanding, Team
from api.scripts.seed_e2e import _database_name

TOTALS = [Decimal("131.50"), Decimal("98.25"), Decimal("64.00"), Decimal("12.75")]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", type=int, required=True)
    args = parser.parse_args()
    _database_name()
    async with db_session.get_session_factory()() as db:
        teams = (
            (
                await db.execute(
                    select(Team).where(Team.league_id == args.league).order_by(Team.id)
                )
            )
            .scalars()
            .all()
        )
        for index, team in enumerate(teams):
            db.add(
                LeagueStanding(
                    league_id=args.league,
                    team_id=team.id,
                    rank=index + 1,
                    players_left=max(4 - index, 0),
                    wild_card=int(TOTALS[index % 4] / 2),
                    divisional=int(TOTALS[index % 4] / 2),
                    conf_champ=0,
                    super_bowl=0,
                    total=TOTALS[index % 4],
                )
            )
        await db.commit()
    await db_session.close_db()


if __name__ == "__main__":
    asyncio.run(main())
