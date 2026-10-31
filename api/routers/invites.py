from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from api.db.models.league import League, LeagueInvite
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.dependencies.league import LeagueCommissioner
from api.models.league_models import (
    InviteCreate,
    InvitePreview,
    InviteResponse,
    JoinResponse,
)
from api.services import invites as invite_service
from api.services.league_members import LeagueRuleError
from api.services.season_recap import ARCHIVED_MESSAGE, season_is_finished

router = APIRouter()


def _response(invite: LeagueInvite) -> InviteResponse:
    return InviteResponse(
        code=invite.code,
        league_id=invite.league_id,
        expires_at=invite.expires_at,
        max_uses=invite.max_uses,
        uses=invite.uses,
        revoked=invite.revoked,
    )


@router.get("/leagues/{league_id}/invite", response_model=InviteResponse | None)
async def get_invite(
    league_id: int, _: LeagueCommissioner, db: DbSession
) -> InviteResponse | None:
    invite = await invite_service.active_invite(db, league_id)
    return _response(invite) if invite else None


@router.post(
    "/leagues/{league_id}/invite",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_regenerate_invite(
    league_id: int,
    payload: InviteCreate,
    membership: LeagueCommissioner,
    db: DbSession,
) -> InviteResponse:
    """Create an invite, retiring the previous one (this is also "regenerate")."""
    invite = await invite_service.create_invite(
        db, league_id, membership.user.id, payload.expires_at, payload.max_uses
    )
    return _response(invite)


@router.delete("/leagues/{league_id}/invite", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(league_id: int, _: LeagueCommissioner, db: DbSession) -> None:
    await invite_service.revoke_invites(db, league_id)


@router.get("/invites/{code}", response_model=InvitePreview)
async def preview_invite(code: str, db: DbSession) -> InvitePreview:
    """Public on purpose: the join page shows what you are joining before login."""
    invite = await invite_service.find_invite(db, code)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )
    league = (
        await db.execute(select(League).where(League.id == invite.league_id))
    ).scalar_one()
    problem = await invite_service.join_problem(db, invite)
    return InvitePreview(
        code=invite.code,
        league_name=league.name,
        season=league.season,
        open_spots=await invite_service.open_team_count(db, league.id),
        joinable=problem is None,
        reason=problem,
    )


@router.post("/invites/{code}/join", response_model=JoinResponse)
async def join_with_invite(
    code: str, supabase_uid: CurrentUser, db: DbSession
) -> JoinResponse:
    """Idempotent: joining a league you are already in just returns it."""
    invite = await invite_service.find_invite(db, code)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )
    user = (
        await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    season = await db.scalar(select(League.season).where(League.id == invite.league_id))
    if season is not None and await season_is_finished(db, season):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ARCHIVED_MESSAGE,
        )
    try:
        league, team, already_member = await invite_service.join_league(
            db, invite, user
        )
    except LeagueRuleError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return JoinResponse(
        league_id=league.id,
        team_id=team.id if team else None,
        already_member=already_member,
    )
