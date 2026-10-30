"""A fantasy team's points round by round: every starter slot and the bench's points."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.activity_models import ScoreChange
from api.models.league_models import (
    BreakdownPlayer,
    BreakdownRound,
    BreakdownSlot,
    TeamBreakdown,
)
from api.services import activity
from api.services.lineups import BENCH, slot_layout, team_lineups
from api.services.round_points import (
    PointsLine,
    league_point_lines,
    postseason_stats,
    sum_points,
)
from api.services.round_status import ROUNDS
from api.utils.calculations.standings_utils import ROUND_MULTIPLIER_FIELDS


def _scaled(change: ScoreChange | None, multiplier: float) -> ScoreChange | None:
    """A correction in raw points, restated as counted points like the breakdown's."""
    if change is None:
        return None
    return ScoreChange(
        previous_points=round(change.previous_points * multiplier, 2),
        new_points=round(change.new_points * multiplier, 2),
        changed_at=change.changed_at,
    )


def _player(
    player: NFLPlayer,
    line: PointsLine,
    slots: list[str],
    change: ScoreChange | None,
) -> BreakdownPlayer:
    return BreakdownPlayer(
        player_id=player.id,
        name=player.name or "",
        position=player.position or "",
        team_abv=player.team.team_abv if player.team else None,
        slot=slots[line.slot_index] if line.slot_index is not None else None,
        points=float(line.points),
        score_change=change,
    )


async def team_breakdown(
    db: AsyncSession, team: Team, season: int, now: datetime
) -> TeamBreakdown:
    """Computed on read from lineups, game stats and league settings; nothing is stored."""
    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == team.league_id)
        )
    ).scalar_one()
    specs = slot_layout(settings)
    slot_names = [spec.slot for spec in specs]
    players = {
        p.id: p
        for p in (
            await db.execute(
                select(NFLPlayer)
                .options(selectinload(NFLPlayer.team))
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.team_id == team.id)
            )
        ).scalars()
    }
    lines = [
        ln
        for ln in await league_point_lines(
            db, team.league_id, await postseason_stats(db, season)
        )
        if ln.team_id == team.id
    ]
    # Slot markers are the lineup's, so the asterisk goes when the player locks.
    marks = {
        (lineup.round, slot.index): slot.mark
        for lineup in await team_lineups(
            db, team, settings, list(players.values()), season, now
        )
        for slot in lineup.slots
    }
    changes = await activity.score_changes(db, team.id)
    counted = sum_points(lines, counted=True)
    bench = sum_points(lines, counted=False)

    rounds = []
    for round_ in ROUNDS:
        multiplier = float(getattr(settings, ROUND_MULTIPLIER_FIELDS[round_ - 1]))

        def change_for(
            player_id: int, round_: int = round_, m: float = multiplier
        ) -> ScoreChange | None:
            return _scaled(changes.get((player_id, round_)), m)

        in_round = [ln for ln in lines if ln.round == round_]
        starters_by_slot = {
            ln.slot_index: ln
            for ln in in_round
            if ln.starter and ln.player_id in players
        }
        rounds.append(
            BreakdownRound(
                round=round_,
                multiplier=multiplier,
                counted=float(counted.get((team.id, round_), Decimal(0))),
                starters=[
                    BreakdownSlot(
                        index=index,
                        slot=spec.slot,
                        player=_player(
                            players[starters_by_slot[index].player_id],
                            starters_by_slot[index],
                            slot_names,
                            change_for(starters_by_slot[index].player_id),
                        )
                        if index in starters_by_slot
                        else None,
                        points=float(starters_by_slot[index].points)
                        if index in starters_by_slot
                        else 0.0,
                        mark=marks.get((round_, index)),
                    )
                    for index, spec in enumerate(specs)
                    if spec.slot != BENCH
                ],
                bench=[
                    _player(
                        players[ln.player_id],
                        ln,
                        slot_names,
                        change_for(ln.player_id),
                    )
                    for ln in sorted(
                        (
                            ln
                            for ln in in_round
                            if not ln.starter and ln.player_id in players
                        ),
                        key=lambda ln: (-ln.points, ln.player_id),
                    )
                ],
                bench_points=float(bench.get((team.id, round_), Decimal(0))),
            )
        )
    return TeamBreakdown(
        team_id=team.id,
        league_id=team.league_id,
        team_name=team.name or f"Team {team.id}",
        total=float(sum(counted.values(), Decimal(0))),
        points_left_on_bench=float(sum(bench.values(), Decimal(0))),
        rounds=rounds,
    )
