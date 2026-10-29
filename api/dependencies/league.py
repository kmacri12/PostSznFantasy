from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, Team
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser


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
DraftMember = Annotated[LeagueMembership, Depends(get_draft_member)]
TeamMember = Annotated[LeagueMembership, Depends(get_team_member)]
