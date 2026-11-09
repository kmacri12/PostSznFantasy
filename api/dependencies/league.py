from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, Season, Team
from api.db.models.league import LeagueMember as LeagueMemberRow
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.models.enums import LeagueRole
from api.services.live_leagues import LeagueDeletedError
from api.services.round_status import season_is_finished
from api.services.season_recap import ARCHIVED_MESSAGE

READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


@dataclass(frozen=True)
class LeagueMembership:
    user: User
    league: League
    role: str
    # A member who left: they keep read access to seasons they finished (see
    # `find_season_membership`) but nothing else.
    left: bool = False

    @property
    def is_commissioner(self) -> bool:
        return self.role == LeagueRole.COMMISSIONER.value and not self.left


@dataclass(frozen=True, kw_only=True)
class SeasonMembership(LeagueMembership):
    season: Season
    team: Team | None
    finished: bool

    @property
    def can_edit(self) -> bool:
        """Whether this caller may change anything in the season."""
        return not self.finished and not self.left


async def _user(db: AsyncSession, supabase_uid: str) -> User | None:
    return (
        (await db.execute(select(User).where(User.supabase_uid == supabase_uid)))
        .scalars()
        .first()
    )


def deleted_league_error(league: League, member: object | None) -> HTTPException:
    """Anyone who was ever a member learns it was deleted; others get the 403 a live
    league gives them, so league ids cannot be probed for deleted ones."""
    if member is None:
        return HTTPException(
            status.HTTP_403_FORBIDDEN, "You are not a member of this league"
        )
    return LeagueDeletedError(league)


async def find_membership(
    db: AsyncSession, league_id: int, supabase_uid: str
) -> LeagueMembership | None:
    """The caller's active membership, or None unless they belong to the league."""
    user = await _user(db, supabase_uid)
    if user is None:
        return None
    member = await db.get(LeagueMemberRow, (league_id, user.id))
    league = await db.get(League, league_id)
    if league is not None and league.deleted_at is not None:
        raise deleted_league_error(league, member)
    if member is None or member.left_at is not None or league is None:
        return None
    return LeagueMembership(user=user, league=league, role=member.role)


async def find_season_membership(
    db: AsyncSession, season_id: int, supabase_uid: str, *, read_only: bool = False
) -> SeasonMembership | None:
    """The caller's membership checked through a season.

    A former member qualifies only for reads of a finished season in which they own a
    team: their presence there is permanent.
    """
    user = await _user(db, supabase_uid)
    season = await db.get(Season, season_id)
    if user is None or season is None:
        return None
    member = await db.get(LeagueMemberRow, (season.league_id, user.id))
    league = await db.get(League, season.league_id)
    if league is not None and league.deleted_at is not None:
        raise deleted_league_error(league, member)
    if member is None or league is None:
        return None
    team = (
        (
            await db.execute(
                select(Team)
                .where(Team.season_id == season_id, Team.owner_id == user.id)
                .order_by(Team.id)
            )
        )
        .scalars()
        .first()
    )
    finished = await season_is_finished(db, season.year)
    left = member.left_at is not None
    if left and not (read_only and finished and team is not None):
        return None
    return SeasonMembership(
        user=user,
        league=league,
        role=member.role,
        left=left,
        season=season,
        team=team,
        finished=finished,
    )


async def get_league_member(
    league_id: int, supabase_uid: CurrentUser, db: DbSession
) -> LeagueMembership:
    """Guard for routes with a `{league_id}` path parameter. A league is never
    read-only; only its seasons are."""
    membership = await find_membership(db, league_id, supabase_uid)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return membership


async def require_season_member(
    request: Request, db: AsyncSession, season_id: int, supabase_uid: str
) -> SeasonMembership:
    membership = await find_season_membership(
        db, season_id, supabase_uid, read_only=request.method in READ_METHODS
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    if request.method not in READ_METHODS and membership.finished:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=ARCHIVED_MESSAGE
        )
    return membership


async def require_season_reader(
    db: AsyncSession, season_id: int, supabase_uid: str
) -> SeasonMembership:
    """Read access to a season, for routes that are not addressed by season path."""
    membership = await find_season_membership(
        db, season_id, supabase_uid, read_only=True
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return membership


async def get_season_member(
    request: Request, season_id: int, supabase_uid: CurrentUser, db: DbSession
) -> SeasonMembership:
    """Guard for routes with a `{season_id}` path parameter; writes to a finished
    season answer 409."""
    return await require_season_member(request, db, season_id, supabase_uid)


def _commissioner_only[M: LeagueMembership](membership: M) -> M:
    if not membership.is_commissioner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Commissioner access required",
        )
    return membership


async def require_commissioner(
    membership: Annotated[LeagueMembership, Depends(get_league_member)],
) -> LeagueMembership:
    """Guard for member management, invites and starting a season."""
    return _commissioner_only(membership)


async def require_season_commissioner(
    membership: Annotated[SeasonMembership, Depends(get_season_member)],
) -> SeasonMembership:
    """Guard for settings, draft control and team assignment."""
    return _commissioner_only(membership)


async def get_draft_member(
    request: Request, draft_id: int, supabase_uid: CurrentUser, db: DbSession
) -> SeasonMembership:
    """Guard for routes addressed by draft id; membership is checked on its season."""
    season_id = (
        await db.execute(select(Draft.season_id).where(Draft.id == draft_id))
    ).scalar()
    if season_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found"
        )
    return await require_season_member(request, db, season_id, supabase_uid)


async def get_team_member(
    request: Request, team_id: int, supabase_uid: CurrentUser, db: DbSession
) -> SeasonMembership:
    """Guard for routes addressed by team id; membership is checked on its season."""
    season_id = (
        await db.execute(select(Team.season_id).where(Team.id == team_id))
    ).scalar()
    if season_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return await require_season_member(request, db, season_id, supabase_uid)


LeagueMember = Annotated[LeagueMembership, Depends(get_league_member)]
LeagueCommissioner = Annotated[LeagueMembership, Depends(require_commissioner)]
SeasonMember = Annotated[SeasonMembership, Depends(get_season_member)]
SeasonCommissioner = Annotated[SeasonMembership, Depends(require_season_commissioner)]
DraftMember = Annotated[SeasonMembership, Depends(get_draft_member)]
TeamMember = Annotated[SeasonMembership, Depends(get_team_member)]
