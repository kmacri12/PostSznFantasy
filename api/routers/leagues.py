from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import (
    League,
    LeagueSettings,
    LeagueStanding,
    Team,
    TeamPlayer,
)
from api.db.models.nfl import NFLPlayer
from api.db.models.user import User
from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession
from api.dependencies.league import LeagueMember, TeamMember
from api.models.enums import DraftStatus, DraftType
from api.models.league_models import (
    LeagueCreate,
    LeagueCreateResponse,
    LeaguesByUser,
    LeagueSettingsResponse,
    LeagueSettingsUpdate,
    RosterPlayer,
    ScoringSettings,
    Standings,
    TeamDetails,
    TeamSimple,
)

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
    """Create a new league, its settings, default teams, and a scheduled snake draft."""
    user_stmt = select(User).where(User.supabase_uid == current_user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
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

    # 1. Create League
    new_league = League(name=payload.league_name, commissioner_id=user.id)
    db.add(new_league)
    await db.flush()

    # 2. Create LeagueSettings
    roster_dict = payload.roster_settings.model_dump(by_alias=False)
    scoring_dict = payload.scoring_settings.model_dump(by_alias=False)
    settings = LeagueSettings(
        league_id=new_league.id,
        **roster_dict,
        **scoring_dict,
    )
    db.add(settings)

    # 3. Create Teams
    new_teams: list[Team] = []
    for i in range(number_of_teams):
        team = Team(
            name=f"Team {i + 1}",
            owner_id=user.id if i == 0 else None,
            league_id=new_league.id,
        )
        new_teams.append(team)
        db.add(team)
    await db.flush()

    # 4. Create Draft
    new_draft = Draft(
        league_id=new_league.id,
        status=DraftStatus.SCHEDULED.value,
        start_time=payload.draft_start_time,
        draft_type=DraftType.SNAKE.value,
        time_per_pick_seconds=payload.time_per_pick_seconds,
        alphabetical_sort=False,
        draft_order_team_ids=[t.id for t in new_teams],
    )
    db.add(new_draft)

    return LeagueCreateResponse(
        message=f"League '{payload.league_name}' created successfully",
        league_id=new_league.id,
    )


@router.get("/user-leagues", response_model=list[LeaguesByUser])
async def get_user_leagues(
    current_user_id: CurrentUser,
    db: DbSession,
) -> list[LeaguesByUser]:
    """Retrieve all leagues the current user participates in."""
    user_stmt = select(User).where(User.supabase_uid == current_user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user:
        return []

    stmt = (
        select(Team).options(selectinload(Team.league)).where(Team.owner_id == user.id)
    )
    res = await db.execute(stmt)
    teams = res.scalars().all()

    return [
        LeaguesByUser(
            id=team.league.id,
            name=team.league.name,
            commissioner_id=team.league.commissioner_id,
            user_team_id=team.id,
        )
        for team in teams
    ]


@router.get("/{league_id}/settings", response_model=LeagueSettingsResponse)
async def get_league_settings(
    league_id: int,
    _: LeagueMember,
    db: DbSession,
) -> LeagueSettings:
    """Retrieve settings for a given league."""
    stmt = select(LeagueSettings).where(LeagueSettings.league_id == league_id)
    res = await db.execute(stmt)
    settings = res.scalars().first()
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League settings not found",
        )
    return settings


@router.put("/{league_id}/settings", response_model=LeagueSettingsResponse)
async def update_league_settings(
    league_id: int,
    payload: LeagueSettingsUpdate,
    current_user_id: CurrentUser,
    db: DbSession,
) -> LeagueSettings:
    """Update roster and scoring settings; commissioner only."""
    league = (
        (await db.execute(select(League).where(League.id == league_id)))
        .scalars()
        .first()
    )
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="League not found"
        )
    user = (
        (await db.execute(select(User).where(User.supabase_uid == current_user_id)))
        .scalars()
        .first()
    )
    if not user or user.id != league.commissioner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the commissioner can update league settings",
        )

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

    # Teams are created with the league, so the team count is immutable here.
    updates = {
        **payload.roster_settings.model_dump(by_alias=False, exclude={"number_teams"}),
        **payload.scoring_settings.model_dump(by_alias=False),
    }
    for field, value in updates.items():
        setattr(settings, field, value)
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
        )
        .tuples()
        .all()
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


@router.get("/teams/{team_id}", response_model=TeamDetails)
async def get_team(
    team_id: int,
    _: TeamMember,
    db: DbSession,
) -> TeamDetails:
    """Team roster with each player's playoff survival (NFL team still active)."""
    team = (
        (
            await db.execute(
                select(Team).options(selectinload(Team.owner)).where(Team.id == team_id)
            )
        )
        .scalars()
        .first()
    )
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )

    players = (
        (
            await db.execute(
                select(NFLPlayer)
                .options(selectinload(NFLPlayer.team))
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.team_id == team_id)
                .order_by(NFLPlayer.name)
            )
        )
        .scalars()
        .all()
    )
    # Lineup slot assignment is not persisted per player yet, so everything is BENCH.
    return TeamDetails(
        id=team.id,
        name=team.name or f"Team {team.id}",
        league_id=team.league_id,
        owner_name=team.owner.username if team.owner else None,
        roster=[
            RosterPlayer(
                id=p.id,
                name=p.name or "",
                position=p.position or "",
                team_abv=p.team.team_abv if p.team else None,
                slot="BENCH",
                is_active=p.team.is_active if p.team else False,
            )
            for p in players
        ],
    )


@router.get("/{league_id}/standings", response_model=list[Standings])
async def get_standings(
    league_id: int,
    _: LeagueMember,
    db: DbSession,
) -> list[Standings]:
    """Return the stored standings snapshot enriched with team and owner names.

    players_left and weekly totals are persisted separately by the scoring engine.
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
            wild_card=row.wild_card or 0,
            divisional=row.divisional or 0,
            conf_champ=row.conf_champ or 0,
            super_bowl=row.super_bowl or 0,
            total=float(row.total or 0),
        )
        for row in rows
    ]
