from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from api.core.config import get_settings
from api.db.models.draft import Draft, DraftPick
from api.db.models.league import (
    League,
    LeagueSettings,
    LeagueStanding,
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
    LeagueOverview,
    LeaguesByUser,
    LeagueSettingsPatch,
    LeagueSettingsResponse,
    LeagueUpdate,
    MemberRoleUpdate,
    MemberSummary,
    ScoringSettings,
    Standings,
    TeamBrief,
    TeamOwnerUpdate,
    TeamSimple,
)
from api.services.league_admin import (
    ROSTER_LOCKED_FIELDS,
    draft_has_started,
    set_team_count,
)
from api.services.league_members import LeagueRuleError, remove_member, set_role

router = APIRouter()


@router.get("/scoring-defaults", response_model=dict[str, float])
async def get_scoring_defaults() -> dict[str, float]:
    """Sleeper standard PPR template used to seed the league creation flow.

    Keys stay snake_case (unlike other responses) because they are the form-state keys
    the settings components bind to, and to_camel is not reversible for bands such as
    `fg_made_0_19`.
    """
    return ScoringSettings().model_dump(by_alias=False)


def _rule_error(exc: LeagueRuleError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


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
    """Create a league (the creator becomes commissioner), its teams and an unordered draft."""
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

    new_league = League(name=payload.league_name, season=get_settings().season_year)
    db.add(new_league)
    await db.flush()

    db.add(
        LeagueMemberRow(
            league_id=new_league.id, user_id=user.id, role=LeagueRole.COMMISSIONER.value
        )
    )
    db.add(
        LeagueSettings(
            league_id=new_league.id,
            **payload.roster_settings.model_dump(by_alias=False),
            **payload.scoring_settings.model_dump(by_alias=False),
            **payload.postseason_settings.model_dump(by_alias=False, mode="json"),
        )
    )
    for i in range(number_of_teams):
        db.add(
            Team(
                name=f"Team {i + 1}",
                owner_id=user.id if i == 0 else None,
                league_id=new_league.id,
            )
        )
    await db.flush()

    db.add(
        Draft(
            league_id=new_league.id,
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
    )


@router.get("/user-leagues", response_model=list[LeaguesByUser])
async def get_user_leagues(
    current_user_id: CurrentUser,
    db: DbSession,
) -> list[LeaguesByUser]:
    """Retrieve all leagues the current user belongs to."""
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
                .where(LeagueMemberRow.user_id == user.id)
                .order_by(LeagueMemberRow.joined_at)
            )
        )
        .scalars()
        .all()
    )
    team_ids = dict(
        (
            await db.execute(
                select(Team.league_id, Team.id).where(Team.owner_id == user.id)
            )
        ).all()
    )
    return [
        LeaguesByUser(
            id=member.league.id,
            name=member.league.name,
            season=member.league.season,
            is_commissioner=member.role == LeagueRole.COMMISSIONER.value,
            user_team_id=team_ids.get(member.league_id),
        )
        for member in members
    ]


@router.get("/{league_id}", response_model=LeagueOverview)
async def get_league(
    league_id: int,
    membership: LeagueMember,
    db: DbSession,
) -> LeagueOverview:
    """Everything the League page needs in one call: info, members and draft status."""
    members = (
        (
            await db.execute(
                select(LeagueMemberRow)
                .options(selectinload(LeagueMemberRow.user))
                .where(LeagueMemberRow.league_id == league_id)
                .order_by(LeagueMemberRow.joined_at)
            )
        )
        .scalars()
        .all()
    )
    teams = (
        (await db.execute(select(Team).where(Team.league_id == league_id)))
        .scalars()
        .all()
    )
    team_by_owner = {team.owner_id: team for team in teams if team.owner_id}
    draft = (
        await db.execute(select(Draft).where(Draft.league_id == league_id))
    ).scalar_one_or_none()
    return LeagueOverview(
        id=membership.league.id,
        name=membership.league.name,
        season=membership.league.season,
        number_teams=len(teams),
        open_spots=sum(1 for team in teams if team.owner_id is None),
        my_role=LeagueRole(membership.role),
        my_team_id=membership.team.id if membership.team else None,
        draft_status=DraftStatus(draft.status) if draft else DraftStatus.UNSCHEDULED,
        draft_start_time=draft.start_time if draft else None,
        teams=[
            TeamBrief(
                id=team.id,
                name=team.name or f"Team {team.id}",
                owner_user_id=team.owner_id,
                owner_name=next(
                    (m.user.username for m in members if m.user_id == team.owner_id),
                    None,
                ),
            )
            for team in sorted(teams, key=lambda t: t.id)
        ],
        members=[
            MemberSummary(
                user_id=m.user_id,
                username=m.user.username,
                role=LeagueRole(m.role),
                team_id=team_by_owner[m.user_id].id
                if m.user_id in team_by_owner
                else None,
                team_name=team_by_owner[m.user_id].name
                if m.user_id in team_by_owner
                else None,
            )
            for m in members
        ],
    )


@router.patch("/{league_id}", response_model=LeagueOverview)
async def update_league(
    league_id: int,
    payload: LeagueUpdate,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    """Rename the league or change its team count (the season is read-only)."""
    if payload.name is not None:
        membership.league.name = payload.name
    if payload.number_teams is not None:
        try:
            await set_team_count(db, league_id, payload.number_teams)
        except LeagueRuleError as exc:
            raise _rule_error(exc) from exc
    await db.flush()
    return await get_league(league_id, membership, db)


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
        raise _rule_error(exc) from exc
    await db.flush()
    return await get_league(league_id, membership, db)


@router.put("/{league_id}/teams/{team_id}/owner", response_model=LeagueOverview)
async def assign_team_owner(
    league_id: int,
    team_id: int,
    payload: TeamOwnerUpdate,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    """Give a team to a member (moving them off any team they had) or unassign it."""
    team = await db.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    if payload.user_id is not None:
        if await db.get(LeagueMemberRow, (league_id, payload.user_id)) is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That user is not a member of this league",
            )
        await db.execute(
            update(Team)
            .where(Team.league_id == league_id, Team.owner_id == payload.user_id)
            .values(owner_id=None)
        )
    team.owner_id = payload.user_id
    await db.flush()
    await db.refresh(team)
    return await get_league(league_id, membership, db)


@router.delete("/{league_id}/members/{user_id}", response_model=LeagueOverview)
async def delete_member(
    league_id: int,
    user_id: int,
    membership: LeagueCommissioner,
    db: DbSession,
) -> LeagueOverview:
    try:
        await remove_member(db, league_id, user_id)
    except LeagueRuleError as exc:
        raise _rule_error(exc) from exc
    await db.flush()
    return await get_league(league_id, membership, db)


@router.get("/{league_id}/settings", response_model=LeagueSettingsResponse)
async def get_league_settings(
    league_id: int,
    _: LeagueMember,
    db: DbSession,
) -> LeagueSettings:
    """Retrieve settings for a given league."""
    settings = (
        (
            await db.execute(
                select(LeagueSettings).where(LeagueSettings.league_id == league_id)
            )
        )
        .scalars()
        .first()
    )
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League settings not found",
        )
    return settings


@router.patch("/{league_id}/settings", response_model=LeagueSettingsResponse)
async def update_league_settings(
    league_id: int,
    body: dict[str, Any],
    _: LeagueCommissioner,
    db: DbSession,
) -> LeagueSettings:
    """Partially update roster, scoring and postseason settings; commissioner only."""
    settings = await get_league_settings(league_id, _, db)
    try:
        patch = LeagueSettingsPatch.model_validate(body)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
    updates = patch.model_dump(exclude_unset=True, by_alias=False, mode="json")
    updates = {key: value for key, value in updates.items() if value is not None}

    if await draft_has_started(db, league_id):
        locked = [
            key
            for key in updates
            if key in ROSTER_LOCKED_FIELDS
            and float(getattr(settings, key)) != float(updates[key])
        ]
        if locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Locked once the draft starts: {', '.join(sorted(locked))}",
            )

    team_count = updates.pop("number_teams", None)
    if team_count is not None and team_count != settings.number_teams:
        try:
            await set_team_count(db, league_id, team_count)
        except LeagueRuleError as exc:
            raise _rule_error(exc) from exc
    for field, value in updates.items():
        setattr(settings, field, value)
    if "roster_total" in updates:
        await db.execute(
            update(Draft)
            .where(Draft.league_id == league_id)
            .values(rounds=settings.roster_total)
        )
    await db.flush()
    return settings


@router.get("/{league_id}/teams", response_model=list[TeamSimple])
async def get_league_teams(
    league_id: int,
    _: LeagueMember,
    db: DbSession,
) -> list[TeamSimple]:
    """List a league's teams with owner names and number of draft picks made."""
    teams = (
        (
            await db.execute(
                select(Team)
                .options(selectinload(Team.owner))
                .where(Team.league_id == league_id)
                .order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    pick_counts = dict(
        (
            await db.execute(
                select(DraftPick.team_id, func.count(DraftPick.id))
                .where(DraftPick.team_id.in_([t.id for t in teams]))
                .group_by(DraftPick.team_id)
            )
        ).all()
    )
    return [
        TeamSimple(
            id=team.id,
            name=team.name or f"Team {team.id}",
            owner_id=team.owner_id,
            owner_name=team.owner.username if team.owner else None,
            picks_made=pick_counts.get(team.id, 0),
        )
        for team in teams
    ]


@router.get("/{league_id}/standings", response_model=list[Standings])
async def get_standings(
    league_id: int,
    _: LeagueMember,
    db: DbSession,
) -> list[Standings]:
    """Return the stored standings snapshot enriched with team and owner names.

    Rows are rewritten by api.services.standings whenever scores or eliminations change.
    """
    rows = (
        (
            await db.execute(
                select(LeagueStanding)
                .options(selectinload(LeagueStanding.team).selectinload(Team.owner))
                .where(LeagueStanding.league_id == league_id)
                .order_by(LeagueStanding.rank)
            )
        )
        .scalars()
        .all()
    )

    return [
        Standings(
            team_id=row.team_id,
            rank=row.rank,
            team_name=row.team.name or f"Team {row.team_id}",
            owner=row.team.owner.username if row.team.owner else "Unclaimed",
            players_left=row.players_left or 0,
            wild_card=float(row.wild_card or 0),
            divisional=float(row.divisional or 0),
            conf_champ=float(row.conf_champ or 0),
            super_bowl=float(row.super_bowl or 0),
            total=float(row.total or 0),
        )
        for row in rows
    ]
