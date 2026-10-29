from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import League, Team
from api.db.models.user import User


@dataclass(frozen=True)
class LeagueMembership:
    user: User
    league: League
    team: Team | None

    @property
    def is_commissioner(self) -> bool:
        return self.league.commissioner_id == self.user.id


async def find_membership(
    db: AsyncSession, league_id: int, supabase_uid: str
) -> LeagueMembership | None:
    """Return the caller's membership, or None unless they own a team or run the league."""
    user = (
        (await db.execute(select(User).where(User.supabase_uid == supabase_uid)))
        .scalars()
        .first()
    )
    league = await db.get(League, league_id)
    if user is None or league is None:
        return None

    team = (
        (
            await db.execute(
                select(Team)
                .where(Team.league_id == league_id, Team.owner_id == user.id)
                .order_by(Team.id)
            )
        )
        .scalars()
        .first()
    )
    if team is None and league.commissioner_id != user.id:
        return None
    return LeagueMembership(user=user, league=league, team=team)
