from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import LeagueSettings
from api.db.models.nfl import IngestionStatus, NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.db.session import DbSession
from api.dependencies.auth import CurrentUser, get_current_user
from api.dependencies.league import require_league_member
from api.models.enums import DRAFTABLE_POSITION_VALUES, PlayerPosition
from api.models.players_models import (
    IngestionStatusResponse,
    NFLTeamSimple,
    Player,
    PlayerSeasonStatsResponse,
)
from api.services.scheduler import RECONCILE_KIND_PREFIX
from api.services.team_units import (
    combined_positions,
    scores_whole_team,
    unavailable_in_pool,
)
from api.utils.calculations.fantasy_points_utils import season_points
from api.utils.rapidapi.rapidapi import get_rapidapi_client

# Every player route requires a login: the directory is cheap to scrape and not meant to be public.
router = APIRouter(dependencies=[Depends(get_current_user)])


def _to_player(player: NFLPlayer, scores_whole_team: bool = False) -> Player:
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
        eliminated=team is not None and not team.is_active,
        scores_whole_team=scores_whole_team,
    )


@router.get("/sync-status", response_model=list[IngestionStatusResponse])
async def get_sync_status(db: DbSession) -> list[IngestionStatusResponse]:
    """When each kind of NFL data last synced, so the UI can show how fresh it is.

    `budgetExhausted` means the daily API cap stopped polling, so the data is going stale.
    """
    rows = (
        (
            await db.execute(
                select(IngestionStatus)
                .where(~IngestionStatus.kind.startswith(RECONCILE_KIND_PREFIX))
                .order_by(IngestionStatus.kind)
            )
        )
        .scalars()
        .all()
    )
    exhausted = get_rapidapi_client().budget_exhausted
    return [
        IngestionStatusResponse(
            kind=row.kind,
            last_synced_at=row.last_synced_at,
            budget_exhausted=exhausted,
        )
        for row in rows
    ]


@router.get("/player-list", response_model=list[Player])
async def get_player_list(
    db: DbSession,
    position: str | None = None,
    is_active: Annotated[bool | None, Query(alias="isActive")] = None,
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


@router.get("/draft-pool", response_model=list[Player])
async def get_draft_pool(
    db: DbSession,
    supabase_uid: CurrentUser,
    league_id: Annotated[int | None, Query(alias="leagueId")] = None,
) -> list[Player]:
    """Everyone who can be drafted: draftable positions on the 14 playoff teams.

    With `leagueId` (members only) the league's team QB / team K settings apply: only
    each team's starting QB (K) is listed, flagged `scoresWholeTeam`.
    """
    unavailable: dict[int, str] = {}
    combined: frozenset[PlayerPosition] = frozenset()
    if league_id is not None:
        await require_league_member(db, league_id, supabase_uid)
        settings = (
            await db.execute(
                select(LeagueSettings).where(LeagueSettings.league_id == league_id)
            )
        ).scalar_one()
        drafted = (
            await db.execute(
                select(DraftPick.player_id)
                .join(Draft, Draft.id == DraftPick.draft_id)
                .where(Draft.league_id == league_id)
            )
        ).scalars()
        unavailable = await unavailable_in_pool(db, settings, list(drafted))
        combined = combined_positions(settings)
    players = (
        (
            await db.execute(
                select(NFLPlayer)
                .join(NFLTeam, NFLPlayer.team_id == NFLTeam.id)
                .options(selectinload(NFLPlayer.team))
                .where(
                    NFLTeam.in_playoffs,
                    NFLPlayer.position.in_(DRAFTABLE_POSITION_VALUES),
                    NFLPlayer.id.not_in(unavailable),
                )
                .order_by(NFLPlayer.name)
            )
        )
        .scalars()
        .all()
    )
    return [_to_player(p, scores_whole_team(combined, p.position)) for p in players]


@router.get("/player-season-stats", response_model=list[PlayerSeasonStatsResponse])
async def get_player_season_stats(
    db: DbSession,
    supabase_uid: CurrentUser,
    season: str | None = None,
    position: str | None = None,
    league_id: Annotated[int | None, Query(alias="leagueId")] = None,
) -> list[PlayerSeasonStatsResponse]:
    """Season stats joined with player and team; defaults to the latest season.

    Without `position`, only draftable positions (QB/RB/WR/TE/K/DST) are returned.

    With `league_id`, `fantasyPoints` is scored under that league's settings (members only).
    """
    settings: LeagueSettings | None = None
    if league_id is not None:
        await require_league_member(db, league_id, supabase_uid)
        settings = (
            await db.execute(
                select(LeagueSettings).where(LeagueSettings.league_id == league_id)
            )
        ).scalar_one_or_none()
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
    else:
        stmt = stmt.where(NFLPlayer.position.in_(DRAFTABLE_POSITION_VALUES))
    rows = (await db.execute(stmt)).scalars().all()
    return [
        PlayerSeasonStatsResponse.model_validate(row).model_copy(
            update={
                "player": _to_player(row.player),
                "fantasy_points": (
                    round(float(season_points(row, settings, row.player.position)), 1)
                    if settings is not None
                    else None
                ),
            }
        )
        for row in rows
    ]
