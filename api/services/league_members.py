from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueMember, Season, Team
from api.models.enums import LeagueRole
from api.services.round_status import season_is_finished


class LeagueRuleError(Exception):
    """A league rule blocked the change; the message is safe to show to the user."""


async def commissioner_count(db: AsyncSession, league_id: int) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(LeagueMember)
            .where(
                LeagueMember.league_id == league_id,
                LeagueMember.left_at.is_(None),
                LeagueMember.role == LeagueRole.COMMISSIONER.value,
            )
        )
    ) or 0


async def _member(db: AsyncSession, league_id: int, user_id: int) -> LeagueMember:
    member = await db.get(LeagueMember, (league_id, user_id))
    if member is None or member.left_at is not None:
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
    """Mark a member as left. Their team in an open season stays unclaimed with its
    roster; teams of finished seasons keep their owner for good."""
    member = await _member(db, league_id, user_id)
    if (
        member.role == LeagueRole.COMMISSIONER.value
        and await commissioner_count(db, league_id) <= 1
    ):
        raise LeagueRuleError("A league needs at least one commissioner")
    for season in await db.scalars(select(Season).where(Season.league_id == league_id)):
        if not await season_is_finished(db, season.year):
            await db.execute(
                update(Team)
                .where(Team.season_id == season.id, Team.owner_id == user_id)
                .values(owner_id=None)
            )
    member.left_at = datetime.now(UTC)
