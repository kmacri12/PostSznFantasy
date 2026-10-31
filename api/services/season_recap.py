"""The recap of a finished season: champion(s) and final standings.

Nothing is stored. A season is finished when the Super Bowl is final, and the final
standings are the live standings, which stop changing once every game is final.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import League, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.league_models import Standings
from api.models.recap_models import AwardWinner, RecapTeam, SeasonRecap
from api.services.awards import compute_awards
from api.services.round_points import league_point_lines, postseason_stats
from api.services.round_status import SUPER_BOWL, completed_rounds, load_games
from api.services.standings_view import league_standings

ARCHIVED_MESSAGE = "This season is over; the league is a read-only archive"


async def season_is_finished(db: AsyncSession, season: int) -> bool:
    return SUPER_BOWL in completed_rounds(await load_games(db, season))


async def league_is_archived(db: AsyncSession, league_id: int) -> bool:
    season = await db.scalar(select(League.season).where(League.id == league_id))
    return season is not None and await season_is_finished(db, season)


async def _awards(
    db: AsyncSession, league: League, standings: Standings, champion_ids: set[int]
) -> list[AwardWinner]:
    lines = await league_point_lines(
        db, league.id, await postseason_stats(db, league.season)
    )
    players = {
        p.id: p
        for p in (
            await db.execute(
                select(NFLPlayer).where(
                    NFLPlayer.id.in_({ln.player_id for ln in lines})
                    | NFLPlayer.id.in_(
                        select(DraftPick.player_id)
                        .join(Draft, Draft.id == DraftPick.draft_id)
                        .where(Draft.league_id == league.id)
                    )
                )
            )
        ).scalars()
    }
    picks = dict(
        (
            await db.execute(
                select(DraftPick.player_id, DraftPick.number_pick_overall)
                .join(Draft, Draft.id == DraftPick.draft_id)
                .where(Draft.league_id == league.id)
            )
        ).all()
    )
    owners = dict(
        (
            await db.execute(
                select(TeamPlayer.player_id, TeamPlayer.team_id).where(
                    TeamPlayer.league_id == league.id
                )
            )
        ).all()
    )
    teams = {t.team_id: t for t in standings.teams}
    return [
        AwardWinner(
            key=a.key,
            title=a.title,
            team_id=a.team_id,
            team_name=teams[a.team_id].team_name,
            owner=teams[a.team_id].owner,
            player_id=a.player_id,
            player_name=players[a.player_id].name if a.player_id else None,
            position=players[a.player_id].position if a.player_id else None,
            round=a.round,
            value=float(a.value),
        )
        for a in compute_awards(lines, players, picks, champion_ids, owners)
        if a.team_id in teams
    ]


async def build_recap(db: AsyncSession, league: League) -> SeasonRecap:
    standings = await league_standings(db, league.id)
    finished = await season_is_finished(db, league.season)
    champions = (
        [
            RecapTeam(
                team_id=t.team_id,
                team_name=t.team_name,
                owner=t.owner,
                total=t.total,
            )
            for t in standings.teams
            if t.rank == 1
        ]
        if finished
        else []
    )
    return SeasonRecap(
        league_id=league.id,
        season=league.season,
        finished=finished,
        champions=champions,
        standings=standings,
        next_league_id=await db.scalar(
            select(League.id).where(League.previous_league_id == league.id)
        ),
        awards=await _awards(db, league, standings, {c.team_id for c in champions})
        if finished
        else [],
    )
