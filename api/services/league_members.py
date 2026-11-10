from collections.abc import Sequence
from datetime import UTC, datetime
from types import ModuleType

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueMember, Season, Team
from api.db.models.user import User
from api.models.activity_models import MembershipLeftPayload, RoleChangedPayload
from api.models.enums import LeagueRole
from api.models.league_models import MemberSummary
from api.services.avatars import avatar_url
from api.services.display_names import disambiguate
from api.services.round_status import season_is_finished


class LeagueRuleError(Exception):
    """A league rule blocked the change; the message is safe to show to the user.

    `code` is a stable machine-readable reason for the rules a client reacts to.
    """

    code: str | None = None


class LeagueFullError(LeagueRuleError):
    code = "league_full"


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
    db: AsyncSession, league_id: int, user_id: int, role: LeagueRole, actor: User
) -> LeagueMember:
    """Promote or demote a member; a league must always keep a commissioner."""
    member = await _member(db, league_id, user_id)
    if (
        member.role == LeagueRole.COMMISSIONER.value
        and role != LeagueRole.COMMISSIONER
        and await commissioner_count(db, league_id) <= 1
    ):
        raise LeagueRuleError("A league needs at least one commissioner")
    if member.role == role.value:
        return member
    member.role = role.value
    await _activity().append_to_league(
        db,
        league_id,
        RoleChangedPayload(
            user_id=user_id, user_name=await _username(db, user_id), role=role
        ),
        actor=_activity().Actor.of(actor),
    )
    return member


def _activity() -> ModuleType:
    # live_leagues imports this module for LeagueRuleError and activity imports
    # live_leagues, so a top-level import would be circular.
    from api.services import activity

    return activity


async def _username(db: AsyncSession, user_id: int) -> str:
    return (await db.scalar(select(User.username).where(User.id == user_id))) or ""


async def remove_member(
    db: AsyncSession, league_id: int, user_id: int, actor: User
) -> None:
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
    await _activity().append_to_league(
        db,
        league_id,
        MembershipLeftPayload(user_id=user_id, user_name=await _username(db, user_id)),
        actor=_activity().Actor.of(actor),
    )


def rule_error(exc: LeagueRuleError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def member_summaries(
    members: Sequence[LeagueMember], teams: Sequence[Team]
) -> list[MemberSummary]:
    """Each member with the team they own in the given season's teams, if any."""
    team_by_owner = {team.owner_id: team for team in teams if team.owner_id}
    listed_names = disambiguate([m.user.username for m in members])
    summaries = []
    for m, listed_name in zip(members, listed_names, strict=True):
        team = team_by_owner.get(m.user_id)
        summaries.append(
            MemberSummary(
                user_id=m.user_id,
                username=listed_name,
                role=LeagueRole(m.role),
                avatar_url=avatar_url(m.user.avatar_key),
                team_id=team.id if team else None,
                team_name=team.name if team else None,
                team_avatar_url=avatar_url(team.avatar_key) if team else None,
            )
        )
    return summaries
