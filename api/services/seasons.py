"""A league's seasons: the current one, the first one, and starting the next.

Starting a season carries over the teams (names and owners) and settings the last one
ended with; rosters, lineups, picks, standings and the activity feed start empty and
the draft is unscheduled again. The league's members and invite do not change.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import class_mapper

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueMember, Season, SeasonSettings, Team
from api.models.enums import DraftStatus
from api.models.league_models import SeasonSummary
from api.services.league_members import LeagueRuleError
from api.services.round_status import season_is_finished

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
    summaries: list[SeasonSummary] = []
    for season in seasons:
        finished = await season_is_finished(db, season.year)
        team_id = await db.scalar(
            select(Team.id)
            .where(Team.season_id == season.id, Team.owner_id == user_id)
            .order_by(Team.id)
            .limit(1)
        )
        if former and not (finished and team_id is not None):
            continue
        status = await db.scalar(
            select(Draft.status).where(Draft.season_id == season.id)
        )
        summaries.append(
            SeasonSummary(
                id=season.id,
                year=season.year,
                finished=finished,
                draft_status=DraftStatus(status or DraftStatus.UNSCHEDULED),
                my_team_id=team_id,
            )
        )
    return summaries


async def start_season(db: AsyncSession, league: League) -> Season:
    previous = await current_season(db, league.id)
    if previous is None:
        raise LeagueRuleError("This league has no season to follow")
    if not await season_is_finished(db, previous.year):
        raise LeagueRuleError("The current season is not over yet")
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
