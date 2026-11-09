from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from api.core.rate_limit import AvatarLimit
from api.db.models.league import Team
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.dependencies.league import LeagueCommissioner, TeamMember
from api.models.base import BaseSchema
from api.routers.teams import _team_or_404
from api.services import avatars

router = APIRouter()

# The image rides as the raw request body (the browser sends the cropped Blob), so no
# multipart parsing is involved. Anything past the limit is refused before it is read.
BODY_SLACK_BYTES = 4096


class AvatarResponse(BaseSchema):
    avatar_url: str | None


async def _read_image(request: Request) -> bytes:
    declared = request.headers.get("content-length", "")
    if (
        declared.isdigit()
        and int(declared) > avatars.MAX_AVATAR_BYTES + BODY_SLACK_BYTES
    ):
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "That picture is too large. The limit is 1 MB.",
        )
    return await request.body()


async def _store(owner: avatars.AvatarOwner, request: Request) -> AvatarResponse:
    try:
        await avatars.set_avatar(owner, await _read_image(request))
    except avatars.AvatarError as exc:
        raise HTTPException(exc.status_code, exc.detail) from exc
    return AvatarResponse(avatar_url=avatars.avatar_url(owner.avatar_key))


async def _clear(owner: avatars.AvatarOwner) -> Response:
    try:
        await avatars.clear_avatar(owner)
    except avatars.AvatarError as exc:
        raise HTTPException(exc.status_code, exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _me(db: DbSession, supabase_uid: str) -> User:
    user = await db.scalar(select(User).where(User.supabase_uid == supabase_uid))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("/avatars/{key}", include_in_schema=False)
async def get_avatar(key: str) -> Response:
    """Public by design: the key is random and a new picture gets a new key."""
    try:
        found = await avatars.read_avatar(key)
    except avatars.AvatarError as exc:
        raise HTTPException(exc.status_code, exc.detail) from exc
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Picture not found")
    data, content_type = found
    return Response(
        data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.put("/avatars/me", response_model=AvatarResponse)
async def set_my_avatar(
    request: Request, supabase_uid: CurrentUser, db: DbSession, _: AvatarLimit
) -> AvatarResponse:
    return await _store(await _me(db, supabase_uid), request)


@router.delete("/avatars/me", status_code=status.HTTP_204_NO_CONTENT)
async def clear_my_avatar(supabase_uid: CurrentUser, db: DbSession) -> Response:
    return await _clear(await _me(db, supabase_uid))


@router.put("/leagues/{league_id}/avatar", response_model=AvatarResponse)
async def set_league_avatar(
    league_id: int, request: Request, membership: LeagueCommissioner, _: AvatarLimit
) -> AvatarResponse:
    return await _store(membership.league, request)


@router.delete("/leagues/{league_id}/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def clear_league_avatar(
    league_id: int, membership: LeagueCommissioner
) -> Response:
    return await _clear(membership.league)


async def _team_for_editing(
    db: DbSession, team_id: int, membership: TeamMember
) -> Team:
    team = await _team_or_404(db, team_id)
    if team.owner_id != membership.user.id and not membership.is_commissioner:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the team owner or a commissioner can change this picture",
        )
    return team


@router.put("/teams/{team_id}/avatar", response_model=AvatarResponse)
async def set_team_avatar(
    team_id: int,
    request: Request,
    membership: TeamMember,
    db: DbSession,
    _: AvatarLimit,
) -> AvatarResponse:
    return await _store(await _team_for_editing(db, team_id, membership), request)


@router.delete("/teams/{team_id}/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def clear_team_avatar(
    team_id: int, membership: TeamMember, db: DbSession
) -> Response:
    return await _clear(await _team_for_editing(db, team_id, membership))
