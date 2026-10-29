from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, Team
from api.db.models.league import LeagueMember as LeagueMemberRow
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.models.enums import LeagueRole


@dataclass(frozen=True)
class LeagueMembership:
    user: User
    league: League
    role: str
    team: Team | None

    @property
    def is_commissioner(self) -> bool:
        return self.role == LeagueRole.COMMISSIONER.value


async def find_membership(
    db: AsyncSession, league_id: int, supabase_uid: str
) -> LeagueMembership | None:
    """Return the caller's membership, or None unless they belong to the league."""
    user = (
        (await db.execute(select(User).where(User.supabase_uid == supabase_uid)))
        .scalars()
        .first()
    )
    if user is None:
        return None
    member = await db.get(LeagueMemberRow, (league_id, user.id))
    league = await db.get(League, league_id)
    if member is None or league is None:
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
    return LeagueMembership(user=user, league=league, role=member.role, team=team)


async def require_league_member(
    db: AsyncSession, league_id: int, supabase_uid: str
) -> LeagueMembership:
    membership = await find_membership(db, league_id, supabase_uid)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return membership


async def get_league_member(
    league_id: int, supabase_uid: CurrentUser, db: DbSession
) -> LeagueMembership:
    """Guard for routes with a `{league_id}` path parameter."""
    return await require_league_member(db, league_id, supabase_uid)


async def require_commissioner(
    membership: Annotated[LeagueMembership, Depends(get_league_member)],
) -> LeagueMembership:
    """Guard for settings, invites, draft control and member management."""
    if not membership.is_commissioner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Commissioner access required",
        )
    return membership


async def get_draft_member(
    draft_id: int, supabase_uid: CurrentUser, db: DbSession
) -> LeagueMembership:
    """Guard for routes addressed by draft id; membership is checked on its league."""
    league_id = (
        await db.execute(select(Draft.league_id).where(Draft.id == draft_id))
    ).scalar()
    if league_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found"
        )
    return await require_league_member(db, league_id, supabase_uid)


async def get_team_member(
    team_id: int, supabase_uid: CurrentUser, db: DbSession
) -> LeagueMembership:
    """Guard for routes addressed by team id; membership is checked on its league."""
    league_id = (
        await db.execute(select(Team.league_id).where(Team.id == team_id))
    ).scalar()
    if league_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return await require_league_member(db, league_id, supabase_uid)


LeagueMember = Annotated[LeagueMembership, Depends(get_league_member)]
LeagueCommissioner = Annotated[LeagueMembership, Depends(require_commissioner)]
DraftMember = Annotated[LeagueMembership, Depends(get_draft_member)]
TeamMember = Annotated[LeagueMembership, Depends(get_team_member)]
