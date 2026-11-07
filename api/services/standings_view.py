"""The standings as the league page shows them, derived from the stored snapshot.

The snapshot holds each team's round points and players left (rewritten whenever
scores or eliminations change). Rank, tie reasons and the live starter counts depend on
game state and lineups, so they are worked out on every read.
"""

from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.db.models.league import (
    LeagueMember,
    LineupSlot,
    Season,
    SeasonSettings,
    SeasonStanding,
    Team,
)
from api.db.models.nfl import NFLPlayer
from api.models.enums import LeagueRole, TieRule
from api.models.league_models import (
    Standings,
    StandingsPhase,
    StandingTieReason,
    TeamStanding,
)
from api.services.avatars import avatar_url
from api.services.lineups import BENCH, slot_layout
from api.services.ranking import RoundPoints, TieReason, rank_teams
from api.services.round_progress import starter_progress
from api.services.round_status import (
    current_round,
    games_final,
    games_in_progress,
    load_games,
)
from api.services.standings import load_ranking_facts

ROUND_NAMES = {
    1: "Wild Card",
    2: "Divisional",
    3: "Conference Championship",
    4: "Super Bowl",
}


def _number(value: Decimal) -> str:
    return f"{float(value):g}"


def _tie_reason(reason: TieReason, over_team_name: str) -> StandingTieReason:
    ahead, behind = reason.ahead_value, reason.behind_value
    if reason.rule is TieRule.ROUND_SCORE and reason.round is not None:
        why = f"higher {ROUND_NAMES[reason.round]} score ({_number(ahead)} to {_number(behind)})"
    else:
        why = (
            "more rostered players on the Super Bowl winner "
            f"({_number(ahead)} to {_number(behind)})"
        )
    return StandingTieReason(
        rule=reason.rule,
        round=reason.round,
        over_team_id=reason.over_team_id,
        over_team_name=over_team_name,
        ahead_value=float(ahead),
        behind_value=float(behind),
        detail=why,
        message=f"Ahead of {over_team_name} on the tiebreaker: {why}",
    )


async def _commissioner_ids(db: AsyncSession, season_id: int) -> set[int]:
    return set(
        await db.scalars(
            select(LeagueMember.user_id)
            .join(Season, Season.league_id == LeagueMember.league_id)
            .where(
                Season.id == season_id,
                LeagueMember.role == LeagueRole.COMMISSIONER.value,
                LeagueMember.left_at.is_(None),
            )
        )
    )


async def _team_slots(db: AsyncSession, season_id: int, round_: int) -> Standings:
    """Every team slot of a season whose standings do not exist yet."""
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
    commissioners = await _commissioner_ids(db, season_id)
    return Standings(
        phase=StandingsPhase.PRE_DRAFT,
        round=round_,
        games_in_progress=0,
        players_left=0,
        teams=[
            TeamStanding(
                team_id=team.id,
                rank=None,
                team_name=team.name or f"Team {team.id}",
                team_avatar_url=avatar_url(team.avatar_key),
                owner=team.owner.username if team.owner else None,
                is_commissioner=team.owner_id in commissioners,
                players_left=0,
                wild_card=0,
                divisional=0,
                conf_champ=0,
                super_bowl=0,
                total=0,
                progress=starter_progress([], round_, [], 0),
            )
            for team in teams
        ],
    )


async def season_standings(db: AsyncSession, season_id: int) -> Standings:
    year = await db.scalar(select(Season.year).where(Season.id == season_id))
    rows = (
        (
            await db.execute(
                select(SeasonStanding)
                .options(selectinload(SeasonStanding.team).selectinload(Team.owner))
                .where(SeasonStanding.season_id == season_id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    games = await load_games(db, year) if year is not None else []
    round_ = current_round(games)
    if not rows:
        return await _team_slots(db, season_id, round_)

    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == season_id)
        )
    ).scalar_one()
    starter_slots = {
        i for i, spec in enumerate(slot_layout(settings)) if spec.slot != BENCH
    }
    starter_teams: dict[int, list[int | None]] = defaultdict(list)
    for team_id, slot_index, nfl_team_id in (
        await db.execute(
            select(LineupSlot.team_id, LineupSlot.slot_index, NFLPlayer.team_id)
            .join(NFLPlayer, NFLPlayer.id == LineupSlot.player_id)
            .join(Team, Team.id == LineupSlot.team_id)
            .where(Team.season_id == season_id, LineupSlot.round == round_)
        )
    ).all():
        if slot_index in starter_slots:
            starter_teams[team_id].append(nfl_team_id)

    by_team = {row.team_id: row for row in rows}
    round_points: dict[int, RoundPoints] = {
        row.team_id: (
            row.wild_card or Decimal(0),
            row.divisional or Decimal(0),
            row.conf_champ or Decimal(0),
            row.super_bowl or Decimal(0),
        )
        for row in rows
    }
    ranked = rank_teams(round_points, await load_ranking_facts(db, season_id, games))
    names = {row.team_id: row.team.name or f"Team {row.team_id}" for row in rows}
    owners = {
        row.team_id: row.team.owner.username if row.team.owner else "Unclaimed"
        for row in rows
    }
    commissioners = await _commissioner_ids(db, season_id)
    return Standings(
        phase=StandingsPhase.LIVE,
        round=round_,
        games_in_progress=games_in_progress(games),
        games_final=games_final(games, round_),
        players_left=sum(row.players_left or 0 for row in rows),
        teams=[
            TeamStanding(
                team_id=team.team_id,
                rank=team.rank,
                team_name=names[team.team_id],
                team_avatar_url=avatar_url(by_team[team.team_id].team.avatar_key),
                owner=owners[team.team_id],
                is_commissioner=by_team[team.team_id].team.owner_id in commissioners,
                players_left=by_team[team.team_id].players_left or 0,
                wild_card=float(round_points[team.team_id][0]),
                divisional=float(round_points[team.team_id][1]),
                conf_champ=float(round_points[team.team_id][2]),
                super_bowl=float(round_points[team.team_id][3]),
                total=float(team.total),
                tie_reason=_tie_reason(
                    team.tie_reason, names[team.tie_reason.over_team_id]
                )
                if team.tie_reason
                else None,
                progress=starter_progress(
                    games, round_, starter_teams[team.team_id], len(starter_slots)
                ),
            )
            for team in ranked
        ],
    )
