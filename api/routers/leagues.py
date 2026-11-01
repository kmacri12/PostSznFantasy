from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.core.config import get_settings
from api.db.models.draft import Draft
from api.db.models.league import (
    League,
    Season,
    SeasonSettings,
    Team,
)
from api.db.models.league import (
    LeagueMember as LeagueMemberRow,
)
from api.db.models.user import User
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser
from api.dependencies.league import LeagueCommissioner, LeagueMember
from api.models.enums import DraftStatus, DraftType, LeagueRole
from api.models.league_models import (
    LeagueCreate,
    LeagueCreateResponse,
    LeagueDelete,
    LeagueOverview,
    LeaguesByUser,
    LeagueUpdate,
    MemberRoleUpdate,
    ScoringSettings,
    SeasonSummary,
)
from api.services.activity import leagues_with_new_activity
from api.services.draft_picks import DraftPickError
from api.services.league_members import (
    LeagueRuleError,
    member_summaries,
    remove_member,
    rule_error,
    set_role,
)
from api.services.live_leagues import delete_league, live_league_ids
from api.services.playoff_field import require_draft_window_open
from api.services.round_status import season_is_finished
from api.services.seasons import current_season, start_season

router = APIRouter()


@router.get("/scoring-defaults", response_model=dict[str, float])
async def get_scoring_defaults() -> dict[str, float]:
    """Sleeper standard PPR template used to seed the league creation flow.

    Keys stay snake_case (unlike other responses) because they are the form-state keys
    the settings components bind to, and to_camel is not reversible for bands such as
    `fg_made_0_19`.
    """
    return ScoringSettings().model_dump(by_alias=False)


@router.post(
    "/create-league",
    response_model=LeagueCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_league(
    payload: LeagueCreate,
    current_user_id: CurrentUser,
    db: DbSession,
) -> LeagueCreateResponse:
    """Create a league with its first season: the creator is commissioner, plus teams and a draft."""
    user = (
        (await db.execute(select(User).where(User.supabase_uid == current_user_id)))
        .scalars()
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    number_of_teams = payload.roster_settings.number_teams
    if not payload.league_name or number_of_teams < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid league name and at least 2 teams required",
        )

    if payload.draft_start_time:
        try:
            await require_draft_window_open(
                db, get_settings().season_year, scheduled_for=payload.draft_start_time
            )
        except DraftPickError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc

    year = get_settings().season_year
    if await season_is_finished(db, year):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The {year} season is over; leagues can't be created for it",
        )

    new_league = League(name=payload.league_name)
    db.add(new_league)
    await db.flush()
    season = Season(league_id=new_league.id, year=year)
    db.add(season)
    await db.flush()

    db.add(
        LeagueMemberRow(
            league_id=new_league.id, user_id=user.id, role=LeagueRole.COMMISSIONER.value
        )
    )
    db.add(
        SeasonSettings(
            season_id=season.id,
            **payload.roster_settings.model_dump(by_alias=False),
            **payload.scoring_settings.model_dump(by_alias=False),
            **payload.postseason_settings.model_dump(by_alias=False, mode="json"),
            **payload.team_unit_settings.model_dump(by_alias=False),
        )
    )
    for i in range(number_of_teams):
        db.add(
            Team(
                name=f"Team {i + 1}",
                owner_id=user.id if i == 0 else None,
                season_id=season.id,
            )
        )
    await db.flush()

    db.add(
        Draft(
            season_id=season.id,
            status=(
                DraftStatus.SCHEDULED.value
                if payload.draft_start_time
                else DraftStatus.UNSCHEDULED.value
            ),
            start_time=payload.draft_start_time,
            draft_type=DraftType.SNAKE.value,
            rounds=payload.roster_settings.roster_total,
            time_per_pick_seconds=payload.time_per_pick_seconds,
            draft_order_team_ids=[],
        )
    )
    # The client refetches the league list as soon as this responds, and get_db
    # would only commit after the response is sent.
    await db.commit()

    return LeagueCreateResponse(
        message=f"League '{payload.league_name}' created successfully",
        league_id=new_league.id,
        season_id=season.id,
    )


@router.get("/user-leagues", response_model=list[LeaguesByUser])
async def get_user_leagues(
    current_user_id: CurrentUser,
    db: DbSession,
) -> list[LeaguesByUser]:
    """Retrieve all leagues the current user belongs to, with their latest season."""
    user = (
        (await db.execute(select(User).where(User.supabase_uid == current_user_id)))
        .scalars()
        .first()
    )
    if not user:
        return []

    members = (
        (
            await db.execute(
                select(LeagueMemberRow)
                .options(selectinload(LeagueMemberRow.league))
                .where(
                    LeagueMemberRow.user_id == user.id,
                    LeagueMemberRow.left_at.is_(None),
                    LeagueMemberRow.league_id.in_(live_league_ids()),
                )
                .order_by(LeagueMemberRow.joined_at)
            )
        )
        .scalars()
        .all()
    )
    with_new_activity = await leagues_with_new_activity(db, user.id)
    result: list[LeaguesByUser] = []
    for member in members:
        season = await current_season(db, member.league_id)
        if season is None:
            continue
        team_id = await db.scalar(
            select(Team.id).where(Team.season_id == season.id, Team.owner_id == user.id)
        )
        result.append(
            LeaguesByUser(
                id=member.league.id,
                name=member.league.name,
                season_id=season.id,
                season=season.year,
                is_commissioner=member.role == LeagueRole.COMMISSIONER.value,
                user_team_id=team_id,
                has_new_activity=member.league_id in with_new_activity,
                finished=await season_is_finished(db, season.year),
            )
        )
    return result


async def _league_overview(db: DbSession, league: League, role: str) -> LeagueOverview:
    season = await current_season(db, league.id)
    assert season is not None
    members = (
        (
            await db.execute(
                select(LeagueMemberRow)
                .options(selectinload(LeagueMemberRow.user))
                .where(
                    LeagueMemberRow.league_id == league.id,
                    LeagueMemberRow.left_at.is_(None),
                )
                .order_by(LeagueMemberRow.joined_at)
            )
        )
        .scalars()
        .all()
    )
    teams = (
        (await db.execute(select(Team).where(Team.season_id == season.id)))
        .scalars()
        .all()
    )
    summaries = [
        SeasonSummary(
            id=s.id, year=s.year, finished=await season_is_finished(db, s.year)
        )
        for s in sorted(league.seasons, key=lambda s: s.year)
    ]
    latest_finished = summaries[-1].finished
    return LeagueOverview(
        id=league.id,
        name=league.name,
        notes=league.notes,
        my_role=LeagueRole(role),
        current_season_id=season.id,
        can_start_season=latest_finished,
        next_year=season.year + 1,
        seasons=summaries,
        members=member_summaries(members, list(teams)),
    )


@router.get("/{league_id}", response_model=LeagueOverview)
async def get_league(
    league_id: int, membership: LeagueMember, db: DbSession
) -> LeagueOverview:
    """The League page in one call: notes, members and the list of seasons."""
    await db.refresh(membership.league, ["seasons"])
    return await _league_overview(db, membership.league, membership.role)


@router.patch("/{league_id}", response_model=LeagueOverview)
async def update_league(
    league_id: int,
    payload: LeagueUpdate,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    """Rename the league or edit its notes."""
    if payload.name is not None:
        membership.league.name = payload.name
    if payload.notes is not None:
        membership.league.notes = payload.notes
    await db.flush()
    return await get_league(league_id, membership, db)


@router.delete("/{league_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_league(
    league_id: int,
    payload: LeagueDelete,
    membership: LeagueCommissioner,
    db: DbSession,
) -> None:
    """Soft delete: permanent for users, covers every season, keeps all rows."""
    if payload.league_name != membership.league.name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Type the league name exactly to delete it",
        )
    try:
        await delete_league(db, membership.league, deleted_by=membership.user.id)
    except LeagueRuleError as exc:
        raise rule_error(exc) from exc


@router.patch("/{league_id}/members/{user_id}", response_model=LeagueOverview)
async def update_member_role(
    league_id: int,
    user_id: int,
    payload: MemberRoleUpdate,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    try:
        await set_role(db, league_id, user_id, payload.role)
    except LeagueRuleError as exc:
        raise rule_error(exc) from exc
    await db.flush()
    return await get_league(league_id, membership, db)


@router.delete("/{league_id}/members/{user_id}", response_model=LeagueOverview)
async def delete_member(
    league_id: int,
    user_id: int,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    """Remove a member (or leave); the row stays as history with `left_at` set."""
    try:
        await remove_member(db, league_id, user_id)
    except LeagueRuleError as exc:
        raise rule_error(exc) from exc
    await db.flush()
    return await get_league(league_id, membership, db)


@router.post(
    "/{league_id}/seasons",
    response_model=LeagueCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_next_season(
    league_id: int, membership: LeagueCommissioner, db: DbSession
) -> LeagueCreateResponse:
    """Start next year's season: same teams, owners and settings, fresh rosters."""
    try:
        season = await start_season(db, membership.league)
    except LeagueRuleError as exc:
        raise rule_error(exc) from exc
    await db.commit()
    return LeagueCreateResponse(
        message=f"The {season.year} season of '{membership.league.name}' has started",
        league_id=league_id,
        season_id=season.id,
    )
