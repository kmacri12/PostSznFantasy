from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueSettings, LeagueStanding, Team
from api.db.models.user import User
from api.dependencies.auth import CurrentUser
from api.dependencies.db import DbSession
from api.models.league_models import (
    LeagueCreate,
    LeagueCreateResponse,
    LeaguesByUser,
    LeagueSettingsResponse,
)

router = APIRouter()


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


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
        status="Scheduled",
        start_time=datetime.now(UTC) + timedelta(days=7),
        draft_type="snake",
        time_per_pick_seconds=60,
        alphabetical_sort=False,
        draft_order_team_ids=[t.id for t in new_teams],
    )
    db.add(new_draft)

    await db.commit()

    return LeagueCreateResponse(
        message=f"League '{payload.league_name}' created successfully",
        league_id=new_league.id,
    )


@router.get("/user-leagues", response_model=list[LeaguesByUser])
@router.get("/get_leagues_by_user", response_model=list[LeaguesByUser])
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
    _: CurrentUser,
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


@router.get("/{league_id}/standings")
async def get_standings(
    league_id: int,
    _: CurrentUser,
    db: DbSession,
) -> list[dict[str, object]]:
    """Return stored standing rows for the league.

    players_left and weekly totals are persisted separately by the scoring engine;
    this endpoint serves the current snapshot from the standings table.
    """
    rows = (
        (
            await db.execute(
                select(LeagueStanding)
                .where(LeagueStanding.league_id == league_id)
                .order_by(LeagueStanding.rank)
            )
        )
        .scalars()
        .all()
    )

    return [
        {
            "teamId": row.team_id,
            "rank": row.rank,
            "playersLeft": row.players_left,
            "wildCard": row.wild_card,
            "divisional": row.divisional,
            "confChamp": row.conf_champ,
            "superBowl": row.super_bowl,
            "total": float(row.total) if row.total is not None else None,
        }
        for row in rows
    ]
