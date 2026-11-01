"""The recap of a finished season: champion(s) and final standings.

Nothing is stored. A season is finished when the Super Bowl is final, and the final
standings are the live standings, which stop changing once every game is final.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import Season, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.league_models import Standings
from api.models.recap_models import AwardWinner, RecapTeam, SeasonRecap
from api.services.awards import compute_awards
from api.services.round_points import postseason_stats, season_point_lines
from api.services.round_status import SUPER_BOWL, completed_rounds, load_games
from api.services.standings_view import season_standings

ARCHIVED_MESSAGE = "This season is over; the league is a read-only archive"


async def season_is_finished(db: AsyncSession, season: int) -> bool:
    return SUPER_BOWL in completed_rounds(await load_games(db, season))


async def season_is_archived(db: AsyncSession, season_id: int) -> bool:
    year = await db.scalar(select(Season.year).where(Season.id == season_id))
    return year is not None and await season_is_finished(db, year)


async def _awards(
    db: AsyncSession, season: Season, standings: Standings, champion_ids: set[int]
) -> list[AwardWinner]:
    lines = await season_point_lines(
        db, season.id, await postseason_stats(db, season.year)
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
                        .where(Draft.season_id == season.id)
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
                .where(Draft.season_id == season.id)
            )
        ).all()
    )
    owners = dict(
        (
            await db.execute(
                select(TeamPlayer.player_id, TeamPlayer.team_id).where(
                    TeamPlayer.season_id == season.id
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
            drafted_as=a.draft.drafted_as if a.draft else None,
            finished_as=a.draft.finished_as if a.draft else None,
            points=float(a.draft.points) if a.draft else None,
        )
        for a in compute_awards(lines, players, picks, champion_ids, owners)
        if a.team_id in teams
    ]


async def build_recap(db: AsyncSession, season: Season) -> SeasonRecap:
    standings = await season_standings(db, season.id)
    finished = await season_is_finished(db, season.year)
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
        season_id=season.id,
        league_id=season.league_id,
        year=season.year,
        finished=finished,
        champions=champions,
        standings=standings,
        next_season_id=await db.scalar(
            select(Season.id).where(
                Season.league_id == season.league_id, Season.year > season.year
            )
        ),
        awards=await _awards(db, season, standings, {c.team_id for c in champions})
        if finished
        else [],
    )
