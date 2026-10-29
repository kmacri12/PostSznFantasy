from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from api.db.models.draft import Draft
from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLGame, NFLPlayer, NFLTeam
from api.db.session import DbSession
from api.dependencies.league import LeagueMembership, TeamMember
from api.models.enums import DraftStatus, PlayerPosition
from api.models.league_models import (
    AddDropRequest,
    NextGame,
    RosterPlayer,
    RosterSlot,
    TeamDetails,
    TeamRename,
)
from api.services.roster_slots import BENCH, assign_players, slot_layout

router = APIRouter()

GAME_COMPLETED = "Completed"


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


async def build_team_details(
    db: DbSession, team: Team, membership: LeagueMembership
) -> TeamDetails:
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == team.league_id)
        )
    ).scalar_one()
    players = list(
        (
            await db.execute(
                select(NFLPlayer)
                .options(selectinload(NFLPlayer.team))
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.team_id == team.id)
                .order_by(NFLPlayer.name)
            )
        )
        .scalars()
        .all()
    )
    upcoming = await _next_games(
        db,
        membership.league.season,
        {p.team_id for p in players if p.team_id is not None},
    )

    specs = slot_layout(settings)
    placed = assign_players(
        specs, [(p.id, PlayerPosition.from_str(p.position)) for p in players]
    )
    slot_of = {pid: specs[i].slot for i, pid in enumerate(placed) if pid is not None}

    def view(player: NFLPlayer, slot: str) -> RosterPlayer:
        return RosterPlayer(
            id=player.id,
            name=player.name or "",
            position=player.position or "",
            team_abv=player.team.team_abv if player.team else None,
            slot=slot,
            is_active=player.team.is_active if player.team else False,
            next_game=upcoming.get(player.team_id) if player.team_id else None,
        )

    by_id = {p.id: p for p in players}
    roster = [view(p, slot_of.get(p.id, BENCH)) for p in players]
    slots = [
        RosterSlot(
            slot=spec.slot,
            player=view(by_id[pid], spec.slot) if pid is not None else None,
        )
        for spec, pid in zip(specs, placed, strict=True)
    ]
    is_owner = team.owner_id == membership.user.id
    return TeamDetails(
        id=team.id,
        name=team.name or f"Team {team.id}",
        league_id=team.league_id,
        owner_name=team.owner.username if team.owner else None,
        can_edit=is_owner or membership.is_commissioner,
        can_manage_roster=is_owner,
        roster=roster,
        slots=slots,
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


@router.post("/{team_id}/roster", response_model=TeamDetails)
async def add_drop(
    team_id: int, payload: AddDropRequest, membership: TeamMember, db: DbSession
) -> TeamDetails:
    """Add a free agent and/or drop a player, subject to the league's postseason rules.

    Free agency allows any add/drop; otherwise only swapping an eliminated player for
    an active free agent is allowed (when the league enables it).
    """
    team = await _team_or_404(db, team_id)
    if team.owner_id != membership.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can change the roster",
        )
    if payload.add_player_id is None and payload.drop_player_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to add or drop"
        )
    draft_status = await db.scalar(
        select(Draft.status).where(Draft.league_id == team.league_id)
    )
    if draft_status != DraftStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster moves open once the draft is complete",
        )
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == team.league_id)
        )
    ).scalar_one()

    async def load(player_id: int) -> NFLPlayer:
        player = (
            (
                await db.execute(
                    select(NFLPlayer)
                    .options(selectinload(NFLPlayer.team))
                    .where(NFLPlayer.id == player_id)
                )
            )
            .scalars()
            .first()
        )
        if player is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
            )
        return player

    dropped = await load(payload.drop_player_id) if payload.drop_player_id else None
    added = await load(payload.add_player_id) if payload.add_player_id else None

    if dropped is not None:
        owns = await db.get(TeamPlayer, (team.id, dropped.id))
        if owns is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That player is not on your roster",
            )
    if added is not None:
        if added.team is None or not added.team.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That player's team has been eliminated",
            )
        taken = await db.scalar(
            select(TeamPlayer.team_id).where(
                TeamPlayer.league_id == team.league_id,
                TeamPlayer.player_id == added.id,
            )
        )
        if taken is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That player is already on a roster",
            )

    if not settings.free_agency_enabled:
        swap_allowed = (
            settings.allow_swap_eliminated
            and dropped is not None
            and added is not None
            and dropped.team is not None
            and not dropped.team.is_active
        )
        if not swap_allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Free agency is off: you can only swap an eliminated player for a free agent",
            )

    size = len(
        (
            await db.execute(
                select(TeamPlayer.player_id).where(TeamPlayer.team_id == team.id)
            )
        )
        .scalars()
        .all()
    )
    if dropped is not None:
        await db.delete(owns)
        size -= 1
    if added is not None:
        if size >= settings.roster_total:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your roster is full: drop a player first",
            )
        db.add(
            TeamPlayer(team_id=team.id, league_id=team.league_id, player_id=added.id)
        )
    await db.flush()
    await db.refresh(team, attribute_names=["roster"])
    return await build_team_details(db, team, membership)
