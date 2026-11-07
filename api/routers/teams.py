from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from api.db.models.league import SeasonSettings, Team, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLTeam
from api.db.session import DbSession
from api.dependencies.league import SeasonMembership, TeamMember
from api.models.league_models import (
    LineupMove,
    NextGame,
    RosterPlayer,
    TeamBreakdown,
    TeamDetails,
    TeamRename,
)
from api.services.avatars import avatar_url
from api.services.lineups import (
    LineupActor,
    LineupError,
    OverrideConfirmationRequired,
    move_in_lineup,
    team_lineups,
)
from api.services.round_status import GAME_COMPLETED
from api.services.standings import refresh_standings_if_drafted
from api.services.team_breakdown import team_breakdown
from api.services.team_units import combined_positions, scores_whole_team

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
    db: DbSession, team: Team, membership: SeasonMembership
) -> TeamDetails:
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == team.season_id)
        )
    ).scalar_one()
    players = await _roster(db, team.id)
    upcoming = await _next_games(
        db,
        membership.season.year,
        {p.team_id for p in players if p.team_id is not None},
    )

    combined = combined_positions(settings)
    is_owner = team.owner_id == membership.user.id
    return TeamDetails(
        id=team.id,
        name=team.name or f"Team {team.id}",
        avatar_url=avatar_url(team.avatar_key),
        season_id=team.season_id,
        owner_name=team.owner.username if team.owner else None,
        can_edit=membership.can_edit and (is_owner or membership.is_commissioner),
        can_set_lineup=membership.can_edit and (is_owner or membership.is_commissioner),
        can_override=membership.can_edit and membership.is_commissioner,
        roster=[
            RosterPlayer(
                id=p.id,
                name=p.name or "",
                position=p.position or "",
                team_abv=p.team.team_abv if p.team else None,
                is_active=p.team.is_active if p.team else False,
                injury_status=p.injury_status,
                next_game=upcoming.get(p.team_id) if p.team_id else None,
                scores_whole_team=scores_whole_team(combined, p.position),
            )
            for p in players
        ],
        lineups=await team_lineups(
            db, team, settings, players, membership.season.year, datetime.now(UTC)
        ),
    )


@router.get("/{team_id}", response_model=TeamDetails)
async def get_team(team_id: int, membership: TeamMember, db: DbSession) -> TeamDetails:
    """Roster in slot layout (empty slots included) with alive/eliminated and next game."""
    return await build_team_details(db, await _team_or_404(db, team_id), membership)


@router.get("/{team_id}/breakdown", response_model=TeamBreakdown)
async def get_team_breakdown(
    team_id: int, membership: TeamMember, db: DbSession
) -> TeamBreakdown:
    """Each round's counted points per starter slot and the bench's points, all computed
    on read; round scores equal the standings values."""
    return await team_breakdown(
        db, await _team_or_404(db, team_id), membership.season.year, datetime.now(UTC)
    )


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
) -> TeamDetails | JSONResponse:
    """Place, move or clear a player in one round's lineup.

    The owner can move anyone whose game hasn't kicked off. A commissioner can also
    edit other teams, and may move locked players or edit a past round once they
    confirm it (`confirmOverride`); that is posted to the league feed.
    """
    team = await _team_or_404(db, team_id)
    if team.owner_id != membership.user.id and not membership.is_commissioner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner or a commissioner can set the lineup",
        )
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == team.season_id)
        )
    ).scalar_one()
    players = await _roster(db, team.id)
    try:
        await move_in_lineup(
            db,
            team,
            settings,
            players,
            membership.season.year,
            payload.round,
            payload.player_id,
            payload.slot_index,
            datetime.now(UTC),
            actor=LineupActor(
                membership.user, membership.is_commissioner, payload.confirm_override
            ),
        )
    except OverrideConfirmationRequired as exc:
        # `detail` stays a string like every other error; `code` tells the client to
        # ask the commissioner to confirm and resend with `confirmOverride`.
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": str(exc),
                "code": "override_confirmation_required",
            },
        )
    except LineupError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    await refresh_standings_if_drafted(db, team.season_id)
    return await build_team_details(db, team, membership)
