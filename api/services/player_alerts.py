"""Player and score alerts (#391): a starter ruled out before lock, a starter's touchdown,
and what a round or an elimination means for the member's team.

Every alert goes through `notifications.notify`. The scheduler tick calls the senders;
`alerts_sent` makes each event one push however many ticks see it (a restart included),
and a push waits for the member's quiet hours inside `push.send_to_users`.
"""

import logging
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import (
    League,
    LineupSlot,
    Season,
    SeasonSettings,
    SeasonStanding,
    Team,
    TeamPlayer,
)
from api.db.models.nfl import NFLGame, NFLPlayer, NFLPlayerGameStats
from api.db.models.push import AlertSent
from api.models.enums import DraftStatus, PlayerRoundStatus
from api.services import notifications, push
from api.services.lineups import BENCH, slot_layout
from api.services.live_leagues import live_season_ids
from api.services.ranking import RankingFacts, RoundPoints, rank_teams
from api.services.round_status import (
    SUPER_BOWL,
    GameFacts,
    completed_rounds,
    current_round,
    load_games,
    round_status,
)
from api.services.standings import load_ranking_facts
from api.services.standings_view import ROUND_NAMES
from api.utils.calculations.standings_utils import postseason_round_index

logger = logging.getLogger(__name__)

# What the ingestion keeps of an injury report that means "will not play"; Questionable
# is a coin flip, so it does not interrupt anyone.
OUT_STATUSES = {
    "Out": "ruled Out",
    "Doubtful": "listed Doubtful",
    "Injured Reserve": "on injured reserve",
}
# Starters of one team in one game are pushed at most this often; the touchdowns that
# land in between go out together in the next push.
SCORE_PUSH_INTERVAL = timedelta(minutes=3)


@dataclass(frozen=True)
class Starter:
    team_id: int
    owner_id: int
    season_id: int
    league_id: int
    league_name: str
    player_id: int
    player_name: str
    nfl_team_id: int | None
    injury_status: str | None


async def _starters(db: AsyncSession, year: int, round_: int) -> list[Starter]:
    """Players in a starter slot of a drafted, owned team's lineup for the round."""
    rows = (
        await db.execute(
            select(
                LineupSlot.slot_index,
                Team.id,
                Team.owner_id,
                Season.id,
                League.id,
                League.name,
                NFLPlayer.id,
                NFLPlayer.name,
                NFLPlayer.team_id,
                NFLPlayer.injury_status,
            )
            .join(Team, Team.id == LineupSlot.team_id)
            .join(Season, Season.id == Team.season_id)
            .join(League, League.id == Season.league_id)
            .join(Draft, Draft.season_id == Season.id)
            .join(NFLPlayer, NFLPlayer.id == LineupSlot.player_id)
            .where(
                LineupSlot.round == round_,
                Season.year == year,
                Season.id.in_(live_season_ids()),
                Draft.status == DraftStatus.COMPLETED.value,
                Team.owner_id.is_not(None),
            )
        )
    ).all()
    season_ids = {row[3] for row in rows}
    layouts = {
        settings.season_id: {
            i for i, spec in enumerate(slot_layout(settings)) if spec.slot != BENCH
        }
        for settings in (
            await db.execute(
                select(SeasonSettings).where(SeasonSettings.season_id.in_(season_ids))
            )
        ).scalars()
    }
    return [
        Starter(
            team_id=row[1],
            owner_id=row[2] or 0,  # never 0: the query keeps owned teams only
            season_id=row[3],
            league_id=row[4],
            league_name=row[5],
            player_id=row[6],
            player_name=row[7] or "A starter",
            nfl_team_id=row[8],
            injury_status=row[9],
        )
        for row in rows
        if row[0] in layouts.get(row[3], set())
    ]


async def _claim(
    db: AsyncSession, team_id: int, keys: Sequence[str], now: datetime
) -> set[str]:
    """Record the keys not seen before for this team; returns the new ones."""
    if not keys:
        return set()
    claimed = set(
        (
            await db.execute(
                insert(AlertSent)
                .values([{"team_id": team_id, "key": k, "sent_at": now} for k in keys])
                .on_conflict_do_nothing()
                .returning(AlertSent.key)
            )
        )
        .scalars()
        .all()
    )
    await db.commit()
    return claimed


def _can_still_move(
    games: list[GameFacts], nfl_team_id: int | None, round_: int, now: datetime
) -> bool:
    standing = round_status(games, nfl_team_id, round_)
    if standing.status is not PlayerRoundStatus.ALIVE or standing.game_state in (
        "live",
        "final",
    ):
        return False
    return standing.kickoff is None or now < standing.kickoff


def _names(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names)


async def send_starter_out_alerts(db: AsyncSession, year: int, now: datetime) -> int:
    """Tell owners whose starter is Out, Doubtful or on IR before his game starts.

    One push per team and round that collects every newly hurt starter; returns how
    many teams were told.
    """
    games = await load_games(db, year)
    round_ = current_round(games)
    if not any(g.round == round_ for g in games):
        return 0
    hurt: dict[int, list[Starter]] = defaultdict(list)
    for starter in await _starters(db, year, round_):
        if starter.injury_status in OUT_STATUSES and _can_still_move(
            games, starter.nfl_team_id, round_, now
        ):
            hurt[starter.team_id].append(starter)
    told = 0
    for team_id, starters in hurt.items():
        new = await _claim(
            db, team_id, [f"out:{round_}:{s.player_id}" for s in starters], now
        )
        fresh = [s for s in starters if f"out:{round_}:{s.player_id}" in new]
        if not fresh:
            continue
        first = fresh[0]
        if len(fresh) == 1:
            title = f"{first.player_name} is {OUT_STATUSES[first.injury_status or '']}"
        else:
            title = f"{len(fresh)} of your starters are hurt"
        await notifications.notify(
            db,
            [first.owner_id],
            notifications.Notice(
                kind="starter_out",
                league_id=first.league_id,
                payload={
                    "seasonId": first.season_id,
                    "teamId": team_id,
                    "round": round_,
                },
                push=push.PushMessage(
                    title=title,
                    body=(
                        f"{_names([s.player_name for s in fresh])}: set your "
                        f"lineup before it locks ({first.league_name})."
                    ),
                    url=f"/leagues/{first.league_id}/teams/{team_id}",
                    tag=f"starter-out-{team_id}-{round_}",
                    urgency="high",
                ),
            ),
        )
        told += 1
    return told


def _touchdowns(stats: NFLPlayerGameStats) -> int:
    return sum(
        value or 0
        for value in (
            stats.passing_touchdowns,
            stats.rushing_touchdowns,
            stats.receiving_touchdowns,
            stats.punt_return_td,
            stats.kick_return_td,
            stats.dst_def_td,
        )
    )


async def send_score_alerts(
    db: AsyncSession, year: int, game_ids: Iterable[str], now: datetime
) -> int:
    """Tell owners their starters scored touchdowns in the games just polled.

    A burst collapses into one push per team and game (`SCORE_PUSH_INTERVAL` apart at
    most); returns how many teams were told.
    """
    told = 0
    for game in (
        await db.execute(select(NFLGame).where(NFLGame.id.in_(set(game_ids))))
    ).scalars():
        index = postseason_round_index(game.game_week or 0)
        if index is None:
            continue
        game_id = game.id
        scorers = {
            row.player_id: _touchdowns(row)
            for row in (
                await db.execute(
                    select(NFLPlayerGameStats).where(
                        NFLPlayerGameStats.game_id == game_id
                    )
                )
            ).scalars()
            if _touchdowns(row) > 0
        }
        if not scorers:
            continue
        round_ = index + 1
        by_team: dict[int, list[Starter]] = defaultdict(list)
        for starter in await _starters(db, year, round_):
            if starter.player_id in scorers:
                by_team[starter.team_id].append(starter)
        for team_id, starters in by_team.items():
            told += await _score_alert(
                db, game_id, round_, team_id, starters, scorers, now
            )
    return told


async def _score_alert(
    db: AsyncSession,
    game_id: str,
    round_: int,
    team_id: int,
    starters: list[Starter],
    scorers: dict[int, int],
    now: datetime,
) -> int:
    last = await db.scalar(
        select(AlertSent.sent_at).where(
            AlertSent.team_id == team_id, AlertSent.key == f"tdpush:{game_id}"
        )
    )
    if last is not None and now - last < SCORE_PUSH_INTERVAL:
        return 0  # left unclaimed, so the next push carries these touchdowns too
    keys = {
        f"td:{game_id}:{s.player_id}:{n}": s
        for s in starters
        for n in range(1, scorers[s.player_id] + 1)
    }
    new = await _claim(db, team_id, list(keys), now)
    if not new:
        return 0
    counts: dict[str, int] = defaultdict(int)
    for key in new:
        counts[keys[key].player_name] += 1
    first = starters[0]
    total = sum(counts.values())
    scorers_text = ", ".join(
        name if n == 1 else f"{name} (x{n})" for name, n in sorted(counts.items())
    )
    await notifications.notify(
        db,
        [first.owner_id],
        notifications.Notice(
            kind="player_scored",
            league_id=first.league_id,
            payload={
                "seasonId": first.season_id,
                "teamId": team_id,
                "round": round_,
            },
            push=push.PushMessage(
                title="Touchdown!" if total == 1 else f"{total} touchdowns!",
                body=f"{scorers_text} scored for your team in {first.league_name}.",
                url=f"/leagues/{first.league_id}/teams/{team_id}",
                tag=f"td-{team_id}-{game_id}",
            ),
        ),
    )
    await db.execute(
        insert(AlertSent)
        .values(team_id=team_id, key=f"tdpush:{game_id}", sent_at=now)
        .on_conflict_do_update(
            index_elements=[AlertSent.team_id, AlertSent.key], set_={"sent_at": now}
        )
    )
    await db.commit()
    return 1


def _number(value: Decimal) -> str:
    return f"{float(value):g}"


def _ordinal(n: int) -> str:
    suffix = (
        "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    )
    return f"{n}{suffix}"


def _movement(before: int | None, after: int) -> str:
    if before is None or before == after:
        return ""
    return f", {'up' if after < before else 'down'} {abs(before - after)}"


def _ranks_before(
    points: dict[int, RoundPoints], facts: RankingFacts, round_: int
) -> dict[int, int]:
    """Where the teams ranked before `round_` was played."""
    zero = Decimal(0)
    earlier = {
        team_id: tuple(p if i + 1 < round_ else zero for i, p in enumerate(rounds))
        for team_id, rounds in points.items()
    }
    ranked = rank_teams(
        earlier,  # type: ignore[arg-type]
        RankingFacts(frozenset(r for r in facts.completed_rounds if r < round_)),
    )
    return {team.team_id: team.rank for team in ranked}


async def send_round_alerts(db: AsyncSession, year: int, now: datetime) -> int:
    """After a standings recompute: tell an owner their team is out of players, and
    when the latest round is final, how it went and where they moved.

    A team whose last player's team just lost gets the elimination push instead of
    the round summary (except after the Super Bowl, when everyone gets the result).
    Returns how many pushes went out.
    """
    games = await load_games(db, year)
    done = completed_rounds(games)
    latest = max(done, default=None)
    if not any(g.completed for g in games):
        return 0
    sent = 0
    seasons = (
        await db.execute(
            select(Season.id, League.id, League.name)
            .join(League, League.id == Season.league_id)
            .join(Draft, Draft.season_id == Season.id)
            .where(
                Season.year == year,
                Season.id.in_(live_season_ids()),
                Draft.status == DraftStatus.COMPLETED.value,
            )
        )
    ).all()
    for season_id, league_id, league_name in seasons:
        rows = (
            await db.execute(
                select(SeasonStanding, Team.owner_id)
                .join(Team, Team.id == SeasonStanding.team_id)
                .where(SeasonStanding.season_id == season_id)
                .execution_options(populate_existing=True)
            )
        ).all()
        zero = Decimal(0)
        points: dict[int, RoundPoints] = {
            row.team_id: (
                row.wild_card or zero,
                row.divisional or zero,
                row.conf_champ or zero,
                row.super_bowl or zero,
            )
            for row, _ in rows
        }
        facts = await load_ranking_facts(db, season_id, games)
        ranks = {t.team_id: t for t in rank_teams(points, facts)}
        before = (
            _ranks_before(points, facts, latest)
            if latest is not None and latest > 1
            else {}
        )
        rostered = set(
            await db.scalars(
                select(TeamPlayer.team_id).where(TeamPlayer.season_id == season_id)
            )
        )
        for row, owner_id in rows:
            if owner_id is None or row.team_id not in rostered:
                continue
            sent += await _team_round_alert(
                db,
                now,
                row,
                owner_id,
                (season_id, league_id, league_name),
                latest,
                ranks[row.team_id].rank,
                before.get(row.team_id),
                SUPER_BOWL in done,
            )
    return sent


async def _team_round_alert(
    db: AsyncSession,
    now: datetime,
    row: SeasonStanding,
    owner_id: int,
    league: tuple[int, int, str],
    latest: int | None,
    rank: int,
    rank_before: int | None,
    season_over: bool,
) -> int:
    season_id, league_id, league_name = league
    team_id = row.team_id
    total = _number(row.total or Decimal(0))
    out = row.players_left == 0 and not season_over
    if out:
        key, kind = "eliminated", "team_eliminated"
        title = "Your last player's team lost"
        body = (
            f"You're out of players in {league_name}. "
            f"Currently {_ordinal(rank)} with {total} points."
        )
    elif latest is not None and (row.players_left or season_over):
        key, kind = f"round:{latest}", "round_result"
        points_this_round = _number(
            (row.wild_card, row.divisional, row.conf_champ, row.super_bowl)[latest - 1]
            or Decimal(0)
        )
        title = f"{ROUND_NAMES[latest]} is final"
        body = (
            f"{league_name}: you're {_ordinal(rank)}{_movement(rank_before, rank)} with "
            f"{total} points ({points_this_round} this round)."
        )
    else:
        return 0
    if not await _claim(db, team_id, [key], now):
        return 0
    await notifications.notify(
        db,
        [owner_id],
        notifications.Notice(
            kind=kind,  # type: ignore[arg-type]
            league_id=league_id,
            payload={"seasonId": season_id, "teamId": team_id}
            | ({"round": latest} if kind == "round_result" and latest else {}),
            push=push.PushMessage(
                title=title,
                body=body,
                url=f"/leagues/{league_id}",
                tag=f"{key.replace(':', '-')}-{team_id}",
            ),
        ),
    )
    return 1
