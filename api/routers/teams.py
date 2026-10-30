from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLTeam
from api.db.session import DbSession
from api.dependencies.league import LeagueMembership, TeamMember
from api.models.league_models import (
    LineupMove,
    NextGame,
    RosterPlayer,
    TeamDetails,
    TeamRename,
)
from api.services.lineups import LineupError, move_in_lineup, team_lineups
from api.services.round_status import GAME_COMPLETED

router = APIRouter()


async def _team_or_404(db: DbSession, team_id: int) -> Team:
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
    return team


async def _next_games(
    db: DbSession, season: int, nfl_team_ids: set[int]
) -> dict[int, NextGame]:
    """Earliest unfinished postseason game per NFL team."""
    if not nfl_team_ids:
        return {}
    games = (
        (
            await db.execute(
                select(NFLGame)
                .where(
                    NFLGame.season == season,
                    NFLGame.season_type == "post",
                    NFLGame.game_status != GAME_COMPLETED,
                    or_(
                        NFLGame.team_id_home.in_(nfl_team_ids),
                        NFLGame.team_id_away.in_(nfl_team_ids),
                    ),
                )
                .order_by(NFLGame.game_time_epoch)
            )
        )
        .scalars()
        .all()
    )
    abv = {
        team_id: team_abv
        for team_id, team_abv in (
            await db.execute(select(NFLTeam.id, NFLTeam.team_abv))
        ).all()
    }
    upcoming: dict[int, NextGame] = {}
    for game in games:
        for own, other in (
            (game.team_id_home, game.team_id_away),
            (game.team_id_away, game.team_id_home),
        ):
            if own in nfl_team_ids and own not in upcoming:
                upcoming[own] = NextGame(
                    opponent_abv=abv.get(other) if other is not None else None,
                    game_time_epoch=game.game_time_epoch,
                    status=game.game_status,
                )
    return upcoming


async def _roster(db: DbSession, team_id: int) -> list[NFLPlayer]:
    return list(
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


async def build_team_details(
    db: DbSession, team: Team, membership: LeagueMembership
) -> TeamDetails:
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == team.league_id)
        )
    ).scalar_one()
    players = await _roster(db, team.id)
    upcoming = await _next_games(
        db,
        membership.league.season,
        {p.team_id for p in players if p.team_id is not None},
    )

    is_owner = team.owner_id == membership.user.id
    return TeamDetails(
        id=team.id,
        name=team.name or f"Team {team.id}",
        league_id=team.league_id,
        owner_name=team.owner.username if team.owner else None,
        can_edit=is_owner or membership.is_commissioner,
        can_set_lineup=is_owner,
        roster=[
            RosterPlayer(
                id=p.id,
                name=p.name or "",
                position=p.position or "",
                team_abv=p.team.team_abv if p.team else None,
                is_active=p.team.is_active if p.team else False,
                next_game=upcoming.get(p.team_id) if p.team_id else None,
            )
            for p in players
        ],
        lineups=await team_lineups(
            db, team, settings, players, membership.league.season, datetime.now(UTC)
        ),
    )


@router.get("/{team_id}", response_model=TeamDetails)
async def get_team(team_id: int, membership: TeamMember, db: DbSession) -> TeamDetails:
    """Roster in slot layout (empty slots included) with alive/eliminated and next game."""
    return await build_team_details(db, await _team_or_404(db, team_id), membership)


@router.patch("/{team_id}", response_model=TeamDetails)
async def rename_team(
    team_id: int, payload: TeamRename, membership: TeamMember, db: DbSession
) -> TeamDetails:
    """The owner or any commissioner may rename a team."""
    team = await _team_or_404(db, team_id)
    if team.owner_id != membership.user.id and not membership.is_commissioner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner or a commissioner can rename this team",
        )
    team.name = payload.name.strip()
    await db.flush()
    return await build_team_details(db, team, membership)


@router.post("/{team_id}/lineup", response_model=TeamDetails)
async def move_in_round_lineup(
    team_id: int, payload: LineupMove, membership: TeamMember, db: DbSession
) -> TeamDetails:
    """Place, move or clear a player in one round's lineup; the owner only.

    Rejects any move that touches a player locked by their game's scheduled kickoff.
    """
    team = await _team_or_404(db, team_id)
    if team.owner_id != membership.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can set the lineup",
        )
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == team.league_id)
        )
    ).scalar_one()
    players = await _roster(db, team.id)
    try:
        await move_in_lineup(
            db,
            team,
            settings,
            players,
            membership.league.season,
            payload.round,
            payload.player_id,
            payload.slot_index,
            datetime.now(UTC),
        )
    except LineupError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return await build_team_details(db, team, membership)
