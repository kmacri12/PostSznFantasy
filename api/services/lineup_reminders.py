"""Push reminder an hour before a round locks, to owners with an unfilled starter slot.

Called from the scheduler loop on every tick. The window is [first kickoff - lead,
first kickoff); a `lineup_reminders` row per team and round makes it send once.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models.draft import Draft
from api.db.models.league import League, Season, SeasonSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.db.models.push import LineupReminder, PushSubscription
from api.models.enums import DraftStatus
from api.services import push
from api.services.lineups import _placements, fillable_starter_slots, slot_layout
from api.services.live_leagues import live_season_ids
from api.services.round_status import ROUNDS, GameFacts, load_games

logger = logging.getLogger(__name__)

REMINDER_LEAD = timedelta(minutes=60)


async def send_lock_reminders(db: AsyncSession, year: int, now: datetime) -> int:
    """Send the reminders due at `now`; returns how many teams were reminded."""
    if not get_settings().push_enabled:
        return 0
    games = await load_games(db, year)
    due_rounds = []
    for round_ in ROUNDS:
        first = min(
            (g.kickoff for g in games if g.round == round_ and g.kickoff), default=None
        )
        if first is not None and first - REMINDER_LEAD <= now < first:
            due_rounds.append(round_)
    reminded = 0
    for round_ in due_rounds:
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
                    Team.owner_id.in_(select(PushSubscription.user_id)),
                    ~select(LineupReminder.team_id)
                    .where(
                        LineupReminder.team_id == Team.id,
                        LineupReminder.round == round_,
                    )
                    .exists(),
                )
            )
        ).all()
        for team, league_name, league_id in rows:
            if team.owner_id is None or await _unfilled(db, team, games, round_) == 0:
                continue
            claimed = await db.scalar(
                insert(LineupReminder)
                .values(team_id=team.id, round=round_, sent_at=now)
                .on_conflict_do_nothing()
                .returning(LineupReminder.team_id)
            )
            await db.commit()
            if claimed is None:
                continue
            await push.send_to_users(
                db,
                [team.owner_id],
                push.PushMessage(
                    title="Lineup locks in about an hour",
                    body=f"You have an empty starter slot in {league_name}.",
                    url=f"/leagues/{league_id}/teams/{team.id}",
                    tag=f"lineup-lock-{team.id}-{round_}",
                    urgency="high",
                ),
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
    stored = (await _placements(db, team.id))[round_]
    return fillable_starter_slots(slot_layout(settings), players, games, stored, round_)
