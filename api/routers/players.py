from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.dependencies.auth import get_current_user
from api.dependencies.db import DbSession
from api.models.players_models import (
    NFLTeamSimple,
    Player,
    PlayerSeasonStatsResponse,
)

# Every player route requires a login: the directory is cheap to scrape and not meant to be public.
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


def _to_player(player: NFLPlayer) -> Player:
    team = player.team
    return Player(
        id=player.id,
        name=player.name or "",
        position=player.position or "",
        team_abv=team.team_abv if team else None,
        espn_headshot_url=player.espn_headshot_url,
        jersey_num=player.jersey_num,
        birthday=player.birthday,
        height=player.height,
        weight=player.weight,
        exp=player.exp,
        team_id=player.team_id,
        team=NFLTeamSimple.model_validate(team) if team else None,
    )


@router.get("/player-list", response_model=list[Player])
async def get_player_list(
    db: DbSession,
    position: str | None = None,
    is_active: bool | None = None,
) -> list[Player]:
    """NFL player directory, optionally filtered by position and team activity."""
    stmt = (
        select(NFLPlayer).options(selectinload(NFLPlayer.team)).order_by(NFLPlayer.name)
    )
    if position:
        stmt = stmt.where(NFLPlayer.position == position.upper())
    if is_active is not None:
        stmt = stmt.join(NFLTeam, NFLPlayer.team_id == NFLTeam.id).where(
            NFLTeam.is_active == is_active
        )
    players = (await db.execute(stmt)).scalars().all()
    return [_to_player(p) for p in players]


@router.get("/player-season-stats", response_model=list[PlayerSeasonStatsResponse])
async def get_player_season_stats(
    db: DbSession,
    season: str | None = None,
    position: str | None = None,
) -> list[PlayerSeasonStatsResponse]:
    """Season stats joined with player and team; defaults to the latest season."""
    if season is None:
        season = (
            await db.execute(select(func.max(NFLPlayerSeasonStats.season)))
        ).scalar()
    stmt = (
        select(NFLPlayerSeasonStats)
        .join(NFLPlayer, NFLPlayerSeasonStats.player_id == NFLPlayer.id)
        .options(selectinload(NFLPlayerSeasonStats.player).selectinload(NFLPlayer.team))
        .where(NFLPlayerSeasonStats.season == season)
        .order_by(NFLPlayer.name)
    )
    if position:
        stmt = stmt.where(NFLPlayer.position == position.upper())
    rows = (await db.execute(stmt)).scalars().all()
    return [
        PlayerSeasonStatsResponse.model_validate(row).model_copy(
            update={"player": _to_player(row.player)}
        )
        for row in rows
    ]
