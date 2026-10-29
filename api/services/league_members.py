from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueMember, Team
from api.models.enums import LeagueRole


class LeagueRuleError(Exception):
    """A league rule blocked the change; the message is safe to show to the user."""


async def commissioner_count(db: AsyncSession, league_id: int) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(LeagueMember)
            .where(
                LeagueMember.league_id == league_id,
                LeagueMember.role == LeagueRole.COMMISSIONER.value,
            )
        )
    ) or 0


async def _member(db: AsyncSession, league_id: int, user_id: int) -> LeagueMember:
    member = await db.get(LeagueMember, (league_id, user_id))
    if member is None:
        raise LeagueRuleError("That user is not a member of this league")
    return member


async def set_role(
    db: AsyncSession, league_id: int, user_id: int, role: LeagueRole
) -> LeagueMember:
    """Promote or demote a member; a league must always keep a commissioner."""
    member = await _member(db, league_id, user_id)
    if (
        member.role == LeagueRole.COMMISSIONER.value
        and role != LeagueRole.COMMISSIONER
        and await commissioner_count(db, league_id) <= 1
    ):
        raise LeagueRuleError("A league needs at least one commissioner")
    member.role = role.value
    return member


async def remove_member(db: AsyncSession, league_id: int, user_id: int) -> None:
    """Remove a member; their team stays in the league, unclaimed, with its roster."""
    member = await _member(db, league_id, user_id)
    if (
        member.role == LeagueRole.COMMISSIONER.value
        and await commissioner_count(db, league_id) <= 1
    ):
        raise LeagueRuleError("A league needs at least one commissioner")
    await db.execute(
        update(Team)
        .where(Team.league_id == league_id, Team.owner_id == user_id)
        .values(owner_id=None)
    )
    await db.delete(member)
