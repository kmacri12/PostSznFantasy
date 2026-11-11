from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import LeagueMember as LeagueMemberRow
from api.db.models.league import SeasonSettings, Team
from api.db.session import DbSession
from api.dependencies.league import SeasonCommissioner, SeasonMember
from api.models.bracket_models import Bracket
from api.models.enums import DraftStatus, LeagueRole
from api.models.league_models import (
    SeasonOverview,
    SeasonSettingsPatch,
    SeasonSettingsResponse,
    SeasonUpdate,
    Standings,
    TeamBrief,
    TeamOwnerUpdate,
    TeamSimple,
    merged_roster_updates,
)
from api.models.recap_models import SeasonRecap
from api.services import feature_flags
from api.services.activity import Actor
from api.services.avatars import avatar_url
from api.services.bracket import build_bracket
from api.services.league_admin import (
    ROSTER_LOCKED_FIELDS,
    draft_has_started,
    set_team_count,
)
from api.services.league_members import (
    LeagueRuleError,
    member_summaries,
    rule_error,
)
from api.services.season_recap import build_recap
from api.services.settings_changes import (
    on_editable_settings_changed,
    record_settings_change,
)
from api.services.standings_view import season_standings
from api.services.team_units import newly_enabled, require_no_same_team_conflicts

router = APIRouter()


@router.get("/{season_id}/bracket", response_model=Bracket)
async def get_bracket(
    season_id: int, membership: SeasonMember, db: DbSession
) -> Bracket:
    """The NFL playoff bracket with the caller's players in each game. Open to every
    member before the draft; 404 while the owner's `bracket` flag is off."""
    if not await feature_flags.is_enabled(db, feature_flags.BRACKET):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="The bracket is turned off"
        )
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == season_id)
        )
    ).scalar_one()
    team = membership.team
    return await build_bracket(
        db, membership.season.year, settings, team.id if team else None
    )


@router.get("/{season_id}", response_model=SeasonOverview)
async def get_season(
    season_id: int, membership: SeasonMember, db: DbSession
) -> SeasonOverview:
    """Everything a season's home page needs in one call: teams, members, draft."""
    # A former member sees the season's teams but not who is in the league now.
    members = (
        (
            await db.execute(
                select(LeagueMemberRow)
                .options(selectinload(LeagueMemberRow.user))
                .where(
                    LeagueMemberRow.league_id == membership.league.id,
                    LeagueMemberRow.left_at.is_(None),
                )
                .order_by(LeagueMemberRow.joined_at)
            )
        )
        .scalars()
        .all()
    )
    teams = (
        (
            await db.execute(
                select(Team)
                .options(selectinload(Team.owner))
                .where(Team.season_id == season_id)
            )
        )
        .scalars()
        .all()
    )
    draft = (
        await db.execute(select(Draft).where(Draft.season_id == season_id))
    ).scalar_one_or_none()
    return SeasonOverview(
        id=season_id,
        league_id=membership.league.id,
        league_name=membership.league.name,
        year=membership.season.year,
        finished=membership.finished,
        can_edit=membership.can_edit,
        can_commission=membership.can_edit and membership.is_commissioner,
        is_former_member=membership.left,
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
                avatar_url=avatar_url(team.avatar_key),
                owner_user_id=team.owner_id,
                owner_name=team.owner.username if team.owner else None,
            )
            for team in sorted(teams, key=lambda t: t.id)
        ],
        members=[] if membership.left else member_summaries(members, list(teams)),
    )


@router.patch("/{season_id}", response_model=SeasonOverview)
async def update_season(
    season_id: int,
    payload: SeasonUpdate,
    membership: SeasonCommissioner,
    db: DbSession,
) -> SeasonOverview:
    """Change the season's team count (locks at draft start)."""
    if payload.number_teams is not None:
        old_count = await db.scalar(
            select(SeasonSettings.number_teams).where(
                SeasonSettings.season_id == season_id
            )
        )
        try:
            await set_team_count(db, season_id, payload.number_teams)
        except LeagueRuleError as exc:
            raise rule_error(exc) from exc
        await record_settings_change(
            db,
            season_id,
            Actor.of(membership.user),
            {"number_teams": old_count},
            {"number_teams": payload.number_teams},
        )
    await db.flush()
    return await get_season(season_id, membership, db)


@router.put("/{season_id}/teams/{team_id}/owner", response_model=SeasonOverview)
async def assign_team_owner(
    season_id: int,
    team_id: int,
    payload: TeamOwnerUpdate,
    membership: SeasonCommissioner,
    db: DbSession,
) -> SeasonOverview:
    """Give a team to a member (moving them off any team they had) or unassign it."""
    team = await db.get(Team, team_id)
    if team is None or team.season_id != season_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    if payload.user_id is not None:
        member = await db.get(LeagueMemberRow, (membership.league.id, payload.user_id))
        if member is None or member.left_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That user is not a member of this league",
            )
        await db.execute(
            update(Team)
            .where(Team.season_id == season_id, Team.owner_id == payload.user_id)
            .values(owner_id=None)
        )
    team.owner_id = payload.user_id
    await db.flush()
    await db.refresh(team)
    return await get_season(season_id, membership, db)


@router.get("/{season_id}/settings", response_model=SeasonSettingsResponse)
async def get_season_settings(
    season_id: int,
    _: SeasonMember,
    db: DbSession,
) -> SeasonSettings:
    """Retrieve settings for a given season."""
    settings = (
        (
            await db.execute(
                select(SeasonSettings).where(SeasonSettings.season_id == season_id)
            )
        )
        .scalars()
        .first()
    )
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season settings not found",
        )
    return settings


@router.patch("/{season_id}/settings", response_model=SeasonSettingsResponse)
async def update_season_settings(
    season_id: int,
    body: dict[str, Any],
    membership: SeasonCommissioner,
    db: DbSession,
) -> SeasonSettings:
    """Partially update roster, scoring and postseason settings; commissioner only."""
    settings = await get_season_settings(season_id, membership, db)
    try:
        patch = SeasonSettingsPatch.model_validate(body)
        updates = patch.model_dump(exclude_unset=True, by_alias=False, mode="json")
        updates = {key: value for key, value in updates.items() if value is not None}
        updates = merged_roster_updates(settings, updates)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
    patch_values = dict(updates)

    started = await draft_has_started(db, season_id)
    if started:
        locked = [
            key
            for key in updates
            if key in ROSTER_LOCKED_FIELDS
            and float(getattr(settings, key)) != float(updates[key])
        ]
        if locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Roster slots, position caps and team count are locked once "
                    f"the draft starts ({', '.join(sorted(locked))})"
                ),
            )

    before = {key: getattr(settings, key) for key in updates}
    try:
        await require_no_same_team_conflicts(
            db, season_id, newly_enabled(settings, updates)
        )
    except LeagueRuleError as exc:
        raise rule_error(exc) from exc

    team_count = updates.pop("number_teams", None)
    if team_count is not None and team_count != settings.number_teams:
        try:
            await set_team_count(db, season_id, team_count)
        except LeagueRuleError as exc:
            raise rule_error(exc) from exc
    for field, value in updates.items():
        setattr(settings, field, value)
    if "roster_total" in updates:
        await db.execute(
            update(Draft)
            .where(Draft.season_id == season_id)
            .values(rounds=settings.roster_total)
        )
    await db.flush()
    await on_editable_settings_changed(
        db,
        season_id,
        actor=Actor.of(membership.user),
        before=before,
        after=patch_values,
    )
    return settings


@router.get("/{season_id}/teams", response_model=list[TeamSimple])
async def get_season_teams(
    season_id: int,
    _: SeasonMember,
    db: DbSession,
) -> list[TeamSimple]:
    """List a season's teams with owner names and number of draft picks made."""
    teams = (
        (
            await db.execute(
                select(Team)
                .options(selectinload(Team.owner))
                .where(Team.season_id == season_id)
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
            avatar_url=avatar_url(team.avatar_key),
            owner_id=team.owner_id,
            owner_name=team.owner.username if team.owner else None,
            picks_made=pick_counts.get(team.id, 0),
        )
        for team in teams
    ]


@router.get("/{season_id}/standings", response_model=Standings)
async def get_standings(
    season_id: int,
    _: SeasonMember,
    db: DbSession,
) -> Standings:
    """Ranked teams with tie reasons and live starter counts, for the season home page.

    Points and players left come from the snapshot api.services.standings rewrites
    whenever scores or eliminations change; the rest is derived on every read.
    """
    return await season_standings(db, season_id)


@router.get("/{season_id}/recap", response_model=SeasonRecap)
async def get_recap(
    season_id: int, membership: SeasonMember, db: DbSession
) -> SeasonRecap:
    """Champion(s) and final standings once the Super Bowl is final."""
    return await build_recap(db, membership.season)
