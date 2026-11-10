"""A league's seasons: the current one, the first one, and starting the next.

Starting a season carries over the teams (names and owners) and settings the last one
ended with; rosters, lineups, picks, standings and the activity feed start empty and
the draft is unscheduled again. The league's members and invite do not change.
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import class_mapper

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueMember, Season, SeasonSettings, Team
from api.models.enums import DraftStatus
from api.models.league_models import SeasonSummary
from api.services.league_members import LeagueRuleError
from api.services.round_status import SUPER_BOWL, load_games, season_is_finished

# Draft columns that describe this draft's progress rather than how it is set up.
_DRAFT_STATE = {
    "id",
    "season_id",
    "status",
    "start_time",
    "pick_started_at",
    "current_pick_deadline",
    "paused_remaining_seconds",
    "draft_order_team_ids",
}


def _copy_columns(
    source: object, target_type: type, skip: set[str]
) -> dict[str, object]:
    return {
        column.key: getattr(source, column.key)
        for column in class_mapper(target_type).columns
        if column.key not in skip
    }


async def current_season(db: AsyncSession, league_id: int) -> Season | None:
    """The league's latest season: the one open season, or the last finished one."""
    return (
        (
            await db.execute(
                select(Season)
                .where(Season.league_id == league_id)
                .order_by(Season.year.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )


async def season_summaries(
    db: AsyncSession, league_id: int, user_id: int, *, former: bool = False
) -> list[SeasonSummary]:
    """The league's seasons, oldest first, with the caller's team in each.

    A former member gets only the finished seasons in which they owned a team.
    """
    seasons = (
        (
            await db.execute(
                select(Season)
                .where(Season.league_id == league_id)
                .order_by(Season.year)
            )
        )
        .scalars()
        .all()
    )
    season_ids = [season.id for season in seasons]
    team_rows = await db.execute(
        select(Team.season_id, func.min(Team.id))
        .where(Team.season_id.in_(season_ids), Team.owner_id == user_id)
        .group_by(Team.season_id)
    )
    team_ids: dict[int, int | None] = {row[0]: row[1] for row in team_rows}
    status_rows = await db.execute(
        select(Draft.season_id, Draft.status).where(Draft.season_id.in_(season_ids))
    )
    draft_statuses = {row[0]: row[1] for row in status_rows}
    summaries: list[SeasonSummary] = []
    for season in seasons:
        finished = await season_is_finished(db, season.year)
        team_id = team_ids.get(season.id)
        if former and not (finished and team_id is not None):
            continue
        summaries.append(
            SeasonSummary(
                id=season.id,
                year=season.year,
                finished=finished,
                current=season is seasons[-1],
                draft_status=DraftStatus(
                    draft_statuses.get(season.id) or DraftStatus.UNSCHEDULED
                ),
                my_team_id=team_id,
            )
        )
    return summaries


async def next_season_opens_on(db: AsyncSession, year: int) -> date:
    """December 1 of the calendar year the season's Super Bowl is played in.

    The Super Bowl is played in February of `year + 1`, which is also the fallback
    when its kickoff time is not known.
    """
    kickoffs = [g.kickoff for g in await load_games(db, year) if g.round == SUPER_BOWL]
    super_bowl_year = max((k.year for k in kickoffs if k), default=year + 1)
    return date(super_bowl_year, 12, 1)


async def can_start_season(db: AsyncSession, season: Season, today: date) -> bool:
    return await season_is_finished(
        db, season.year
    ) and today >= await next_season_opens_on(db, season.year)


async def start_season(db: AsyncSession, league: League, today: date) -> Season:
    previous = await current_season(db, league.id)
    if previous is None:
        raise LeagueRuleError("This league has no season to follow")
    if not await season_is_finished(db, previous.year):
        raise LeagueRuleError("The current season is not over yet")
    opens = await next_season_opens_on(db, previous.year)
    if today < opens:
        raise LeagueRuleError(
            f"The next season can be started from {opens:%B} {opens.day}, {opens.year}"
        )
    # Serializes concurrent starts, so the check above cannot race the unique
    # (league, year) constraint into a 500 on a double click.
    await db.execute(select(League.id).where(League.id == league.id).with_for_update())
    if await current_season(db, league.id) != previous:
        raise LeagueRuleError("The next season has already been started")

    season = Season(league_id=league.id, year=previous.year + 1)
    db.add(season)
    await db.flush()

    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == previous.id)
        )
    ).scalar_one()
    db.add(
        SeasonSettings(
            season_id=season.id,
            **_copy_columns(settings, SeasonSettings, {"id", "season_id"}),
        )
    )
    active = set(
        (
            await db.scalars(
                select(LeagueMember.user_id).where(
                    LeagueMember.league_id == league.id,
                    LeagueMember.left_at.is_(None),
                )
            )
        ).all()
    )
    teams = (
        await db.execute(
            select(Team).where(Team.season_id == previous.id).order_by(Team.id)
        )
    ).scalars()
    db.add_all(
        Team(
            name=t.name,
            owner_id=t.owner_id if t.owner_id in active else None,
            season_id=season.id,
        )
        for t in teams
    )
    old_draft = (
        await db.execute(select(Draft).where(Draft.season_id == previous.id))
    ).scalar_one_or_none()
    db.add(
        Draft(
            season_id=season.id,
            status=DraftStatus.UNSCHEDULED.value,
            draft_order_team_ids=[],
            **(
                _copy_columns(old_draft, Draft, _DRAFT_STATE)
                if old_draft
                else {"rounds": settings.roster_total}
            ),
        )
    )
    await db.flush()
    return season
