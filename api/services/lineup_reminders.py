"""Reminders before a round locks, to owners with an unfilled starter slot.

Two go out: about a day ahead (`send_day_before_reminders`, so Friday afternoon reaches
someone before a Saturday game) and an hour ahead (`send_lock_reminders`). Each reaches
every such owner's inbox, and the devices of those with push on.

Called from the scheduler loop on every tick. A `lineup_reminders` row (hour) or an
`alerts_sent` key (day) per team and round makes each send once.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import League, Season, SeasonSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.db.models.push import AlertSent, LineupReminder
from api.models.enums import DraftStatus
from api.services import notifications
from api.services.lineups import _placements, fillable_starter_slots, slot_layout
from api.services.live_leagues import live_season_ids
from api.services.round_status import ROUNDS, GameFacts, load_games

logger = logging.getLogger(__name__)

REMINDER_LEAD = timedelta(minutes=60)
DAY_BEFORE_LEAD = timedelta(hours=24)


def _first_kickoff(games: list[GameFacts], round_: int) -> datetime | None:
    return min(
        (g.kickoff for g in games if g.round == round_ and g.kickoff), default=None
    )


async def _owners_to_remind(
    db: AsyncSession,
    year: int,
    games: list[GameFacts],
    round_: int,
    not_yet: ColumnElement[bool],
) -> list[tuple[Team, str, int]]:
    """Teams of drafted live leagues with an owner and a fillable empty starter slot that
    `not_yet` (an `~exists()` clause on the sent record) has not covered."""
    rows = (
        await db.execute(
            select(Team, League.name, League.id)
            .join(Season, Season.id == Team.season_id)
            .join(League, League.id == Season.league_id)
            .join(Draft, Draft.season_id == Season.id)
            .where(
                Season.year == year,
                Season.id.in_(live_season_ids()),
                Draft.status == DraftStatus.COMPLETED.value,
                Team.owner_id.is_not(None),
                not_yet,
            )
        )
    ).all()
    return [
        (team, league_name, league_id)
        for team, league_name, league_id in rows
        if await _unfilled(db, team, games, round_) > 0
    ]


async def send_lock_reminders(db: AsyncSession, year: int, now: datetime) -> int:
    """Send the hour-ahead reminders due at `now`; returns how many teams were reminded."""
    games = await load_games(db, year)
    reminded = 0
    for round_ in ROUNDS:
        first = _first_kickoff(games, round_)
        if first is None or not first - REMINDER_LEAD <= now < first:
            continue
        for team, league_name, league_id in await _owners_to_remind(
            db,
            year,
            games,
            round_,
            ~select(LineupReminder.team_id)
            .where(LineupReminder.team_id == Team.id, LineupReminder.round == round_)
            .exists(),
        ):
            claimed = await db.scalar(
                insert(LineupReminder)
                .values(team_id=team.id, round=round_, sent_at=now)
                .on_conflict_do_nothing()
                .returning(LineupReminder.team_id)
            )
            await db.commit()
            if claimed is None:
                continue
            await notifications.notify_lineup_lock(
                db, team, league_id, league_name, round_
            )
            reminded += 1
    return reminded


async def send_day_before_reminders(db: AsyncSession, year: int, now: datetime) -> int:
    """About 24 hours before a round's first kickoff, and until the hour reminder takes
    over, tell owners with an empty starter slot; once per team and round."""
    games = await load_games(db, year)
    reminded = 0
    for round_ in ROUNDS:
        first = _first_kickoff(games, round_)
        if first is None or not first - DAY_BEFORE_LEAD <= now < first - REMINDER_LEAD:
            continue
        key = f"lineup-day:{round_}"
        for team, league_name, league_id in await _owners_to_remind(
            db,
            year,
            games,
            round_,
            ~select(AlertSent.team_id)
            .where(AlertSent.team_id == Team.id, AlertSent.key == key)
            .exists(),
        ):
            claimed = await db.scalar(
                insert(AlertSent)
                .values(team_id=team.id, key=key, sent_at=now)
                .on_conflict_do_nothing()
                .returning(AlertSent.team_id)
            )
            await db.commit()
            if claimed is None:
                continue
            await notifications.notify_lineup_tomorrow(
                db, team, league_id, league_name, round_
            )
            reminded += 1
    return reminded


async def _unfilled(
    db: AsyncSession, team: Team, games: list[GameFacts], round_: int
) -> int:
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == team.season_id)
        )
    ).scalar_one()
    players = list(
        (
            await db.execute(
                select(NFLPlayer)
                .join(TeamPlayer, TeamPlayer.player_id == NFLPlayer.id)
                .where(TeamPlayer.team_id == team.id)
            )
        )
        .scalars()
        .all()
    )
    stored = (await _placements(db, team.id, {p.id for p in players}))[round_]
    return fillable_starter_slots(slot_layout(settings), players, games, stored, round_)
