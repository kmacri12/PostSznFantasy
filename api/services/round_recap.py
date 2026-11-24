"""The week recap: a few notable things about the round on display once it is over.

Only the extremes make the list (best and worst team, the top starter, a big bench
score, big moves in the standings, heavy or no losses), so it stays short. Nothing is
stored: it is computed from the lineups and box scores on read, like the awards.
"""

from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.activity import ActivityEvent
from api.db.models.draft import Draft
from api.db.models.league import Season, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.models.activity_models import RoundHighlight, RoundRecapPayload, TeamScore
from api.models.enums import ActivityKind, DraftStatus
from api.models.recap_models import RoundRecap
from api.services import activity, notifications
from api.services.live_leagues import live_season_ids
from api.services.ranking import RoundPoints, ranks_through
from api.services.round_points import (
    PointsLine,
    postseason_stats,
    season_point_lines,
    sum_points,
)
from api.services.round_status import (
    ROUNDS,
    SUPER_BOWL,
    GameFacts,
    completed_rounds,
    display_round,
    load_games,
    recap_ready,
)
from api.services.standings import load_ranking_facts

MOVE_NOTABLE = 2
LOSSES_NOTABLE = 3
MAX_NAMED = 2


def _points(value: Decimal) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _ordinal(n: int) -> str:
    suffix = (
        "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    )
    return f"{n}{suffix}"


def _spots(n: int) -> str:
    return "1 spot" if n == 1 else f"{n} spots"


def _names(names: list[str]) -> str:
    if len(names) <= MAX_NAMED:
        return " and ".join(names)
    return f"{len(names)} teams"


def round_highlights(
    *,
    team_names: Mapping[int, str],
    lines: list[PointsLine],
    player_names: Mapping[int, str],
    rank_before: Mapping[int, int] | None,
    rank_after: Mapping[int, int],
    players_lost: Mapping[int, int],
) -> list[RoundHighlight]:
    """`lines` are one round's lines; `rank_before` is None for the first round."""
    lines = [ln for ln in lines if ln.team_id in team_names]
    scores = {team_id: Decimal(0) for team_id in team_names}
    for ln in lines:
        if ln.starter:
            scores[ln.team_id] += ln.points
    out: list[RoundHighlight] = []
    if len(scores) < 2:
        return out

    best = max(scores, key=lambda t: (scores[t], -t))
    worst = min(scores, key=lambda t: (scores[t], t))
    out.append(
        RoundHighlight(
            kind="top_team",
            text=f"{team_names[best]} led the week with {_points(scores[best])}.",
            team_id=best,
            stat=_points(scores[best]),
        )
    )
    if len(scores) >= 3 and scores[worst] != scores[best]:
        out.append(
            RoundHighlight(
                kind="low_team",
                text=f"{team_names[worst]} had the toughest week with {_points(scores[worst])}.",
                team_id=worst,
                stat=_points(scores[worst]),
            )
        )

    starters = [ln for ln in lines if ln.starter and ln.played]
    if starters:
        top = max(starters, key=lambda ln: (ln.points, -ln.player_id))
        out.append(
            RoundHighlight(
                kind="top_starter",
                text=(
                    f"{player_names.get(top.player_id, 'A player')} was the top starter "
                    f"with {_points(top.points)} for {team_names[top.team_id]}."
                ),
                team_id=top.team_id,
                stat=_points(top.points),
            )
        )
    bench = [ln for ln in lines if not ln.starter and ln.played]
    if bench:
        left = max(bench, key=lambda ln: (ln.points, -ln.player_id))
        if left.points > 0:
            out.append(
                RoundHighlight(
                    kind="top_bench",
                    text=(
                        f"{player_names.get(left.player_id, 'A player')} scored "
                        f"{_points(left.points)} on {team_names[left.team_id]}'s bench."
                    ),
                    team_id=left.team_id,
                    stat=_points(left.points),
                )
            )

    if rank_before is not None:
        moves = {
            t: rank_before[t] - rank_after[t]
            for t in team_names
            if t in rank_before and t in rank_after
        }
        if moves:
            riser = max(moves, key=lambda t: (moves[t], -t))
            faller = min(moves, key=lambda t: (moves[t], t))
            if moves[riser] >= MOVE_NOTABLE:
                out.append(
                    RoundHighlight(
                        kind="climber",
                        text=(
                            f"{team_names[riser]} climbed {_spots(moves[riser])} "
                            f"to {_ordinal(rank_after[riser])}."
                        ),
                        team_id=riser,
                        stat=f"+{moves[riser]}",
                    )
                )
            if -moves[faller] >= MOVE_NOTABLE:
                out.append(
                    RoundHighlight(
                        kind="faller",
                        text=(
                            f"{team_names[faller]} dropped {_spots(-moves[faller])} "
                            f"to {_ordinal(rank_after[faller])}."
                        ),
                        team_id=faller,
                        stat=f"-{-moves[faller]}",
                    )
                )

    lost = {t: players_lost.get(t, 0) for t in team_names}
    most = max(lost, key=lambda t: (lost[t], -t))
    if lost[most] >= LOSSES_NOTABLE:
        out.append(
            RoundHighlight(
                kind="most_lost",
                text=f"{team_names[most]} had {lost[most]} players eliminated.",
                team_id=most,
                stat=str(lost[most]),
            )
        )
    fewest = min(lost.values())
    survivors = sorted(t for t in lost if lost[t] == fewest)
    if len(survivors) < len(lost):
        names = _names([team_names[t] for t in survivors])
        out.append(
            RoundHighlight(
                kind="fewest_lost",
                text=f"{names} had the fewest players eliminated ({fewest}).",
                team_id=survivors[0] if len(survivors) == 1 else None,
                stat=str(fewest),
            )
        )
    return out


def _round_points(
    counted: Mapping[tuple[int, int], Decimal], team_id: int
) -> RoundPoints:
    zero = Decimal(0)
    a, b, c, d = (counted.get((team_id, r), zero) for r in ROUNDS)
    return (a, b, c, d)


def team_scores(
    team_names: Mapping[int, str], lines: list[PointsLine]
) -> list[TeamScore]:
    """Every team's counted points in the round, best first."""
    scores = {team_id: Decimal(0) for team_id in team_names}
    for ln in lines:
        if ln.starter and ln.team_id in scores:
            scores[ln.team_id] += ln.points
    order = sorted(scores, key=lambda t: (-scores[t], t))
    return [
        TeamScore(team_id=t, team_name=team_names[t], points=float(scores[t]))
        for t in order
    ]


def _losses(
    games: list[GameFacts], round_: int, roster: Mapping[int, list[int | None]]
) -> dict[int, int]:
    losers = {g.loser_id for g in games if g.round == round_ and g.completed} - {None}
    return {
        team_id: sum(1 for nfl_team in nfl_teams if nfl_team in losers)
        for team_id, nfl_teams in roster.items()
    }


async def build_round_recap(
    db: AsyncSession, season: Season, now: datetime | None = None
) -> RoundRecap | None:
    """None unless the round on display is over; the Super Bowl has the season recap."""
    games = await load_games(db, season.year)
    round_ = display_round(games, now or datetime.now(UTC))
    if round_ not in completed_rounds(games) or round_ == SUPER_BOWL:
        return None

    teams = {
        team.id: team.name or f"Team {team.id}"
        for team in (
            await db.execute(
                select(Team).where(
                    Team.season_id == season.id, Team.owner_id.is_not(None)
                )
            )
        ).scalars()
    }
    lines = await season_point_lines(
        db, season.id, await postseason_stats(db, season.year)
    )
    counted = sum_points(lines, counted=True)
    facts = await load_ranking_facts(db, season.id, games)

    points = {t: _round_points(counted, t) for t in teams}

    roster: dict[int, list[int | None]] = {t: [] for t in teams}
    for team_id, nfl_team_id in (
        await db.execute(
            select(TeamPlayer.team_id, NFLPlayer.team_id)
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .where(TeamPlayer.season_id == season.id)
        )
    ).all():
        if team_id in roster:
            roster[team_id].append(nfl_team_id)

    round_lines = [ln for ln in lines if ln.round == round_]
    player_names = {
        pid: name
        for pid, name in (
            await db.execute(
                select(NFLPlayer.id, NFLPlayer.name).where(
                    NFLPlayer.id.in_({ln.player_id for ln in round_lines})
                )
            )
        ).all()
        if name
    }
    return RoundRecap(
        round=round_,
        highlights=round_highlights(
            team_names=teams,
            lines=round_lines,
            player_names=player_names,
            rank_before=ranks_through(points, facts, round_ - 1)
            if round_ > 1
            else None,
            rank_after=ranks_through(points, facts, round_),
            players_lost=_losses(games, round_, roster),
        ),
        team_scores=team_scores(teams, round_lines),
    )


async def post_round_recaps(db: AsyncSession, year: int, now: datetime) -> int:
    """Post each drafted league's weekly recap to its Feed and notify its members, once
    per round (the Feed event is the memory, so a restart never repeats it). Returns
    how many leagues got one."""
    games = await load_games(db, year)
    round_ = recap_ready(games, now)
    if round_ is None or round_ == SUPER_BOWL:
        return 0
    posted = 0
    seasons = (
        (
            await db.execute(
                select(Season)
                .join(Draft, Draft.season_id == Season.id)
                .where(
                    Season.year == year,
                    Season.id.in_(live_season_ids()),
                    Draft.status == DraftStatus.COMPLETED.value,
                )
            )
        )
        .scalars()
        .all()
    )
    for season in seasons:
        earlier = (
            await db.execute(
                select(ActivityEvent.payload).where(
                    ActivityEvent.season_id == season.id,
                    ActivityEvent.kind == ActivityKind.ROUND_RECAP.value,
                )
            )
        ).scalars()
        if any(payload.get("round") == round_ for payload in earlier):
            continue
        recap = await build_round_recap(db, season, now)
        if recap is None or not recap.highlights:
            continue
        await activity.append(
            db,
            season.id,
            RoundRecapPayload(
                round=recap.round,
                highlights=recap.highlights,
                team_scores=recap.team_scores,
            ),
            at=now,
        )
        await db.commit()
        await notifications.notify_round_recap(
            db, season.league_id, season.id, recap.round
        )
        posted += 1
    return posted
