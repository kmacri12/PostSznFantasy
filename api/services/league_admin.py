from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import SeasonSettings, Team
from api.models.enums import DraftStatus
from api.services.league_members import LeagueRuleError

# Once the draft starts these shape the draft itself and can no longer change.
ROSTER_LOCKED_FIELDS = frozenset(
    {
        "number_teams",
        "roster_total",
        "roster_num_qb",
        "roster_num_rb",
        "roster_num_wr",
        "roster_num_te",
        "roster_num_flex_wr_rb_te",
        "roster_num_flex_wr_rb",
        "roster_num_flex_wr_te",
        "roster_num_flex_qb_wr_rb_te",
        "roster_num_k",
        "roster_num_dst",
        "roster_num_bench",
        "roster_max_qb",
        "roster_max_rb",
        "roster_max_wr",
        "roster_max_te",
        "roster_max_k",
        "roster_max_dst",
    }
)
STARTED_STATUSES = frozenset(
    {
        DraftStatus.IN_PROGRESS.value,
        DraftStatus.PAUSED.value,
        DraftStatus.COMPLETED.value,
    }
)


async def draft_has_started(db: AsyncSession, season_id: int) -> bool:
    status = await db.scalar(select(Draft.status).where(Draft.season_id == season_id))
    return status in STARTED_STATUSES


def _free_default_name(number: int, taken: set[str]) -> str:
    """ "Team N", or the next number up when someone already renamed a team to it."""
    while f"Team {number}".casefold() in taken:
        number += 1
    return f"Team {number}"


async def team_name_taken(db: AsyncSession, team: Team, name: str) -> bool:
    """Another team of the same season already has this name (case-insensitive)."""
    return bool(
        await db.scalar(
            select(Team.id)
            .where(
                Team.season_id == team.season_id,
                Team.id != team.id,
                func.lower(Team.name) == name.lower(),
            )
            .limit(1)
        )
    )


async def set_team_count(db: AsyncSession, season_id: int, count: int) -> None:
    """Grow with empty teams, or shrink by dropping unclaimed ones (never claimed ones)."""
    if await draft_has_started(db, season_id):
        raise LeagueRuleError("The number of teams is locked once the draft starts")
    teams = list(
        (
            await db.execute(
                select(Team).where(Team.season_id == season_id).order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    taken = {(team.name or "").casefold() for team in teams}
    for index in range(len(teams), count):
        name = _free_default_name(index + 1, taken)
        taken.add(name.casefold())
        db.add(Team(name=name, season_id=season_id))

    if count < len(teams):
        removable = [team for team in reversed(teams) if team.owner_id is None]
        surplus = len(teams) - count
        if len(removable) < surplus:
            raise LeagueRuleError(
                "Remove members from the extra teams before reducing the team count"
            )
        dropped = removable[:surplus]
        for team in dropped:
            await db.delete(team)
        draft = (
            await db.execute(select(Draft).where(Draft.season_id == season_id))
        ).scalar_one_or_none()
        if draft is not None:
            gone = {team.id for team in dropped}
            draft.draft_order_team_ids = [
                None if team_id in gone else team_id
                for team_id in draft.draft_order_team_ids
            ]

    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == season_id)
        )
    ).scalar_one()
    settings.number_teams = count
    await db.flush()
