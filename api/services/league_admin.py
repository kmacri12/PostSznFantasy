from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft
from api.db.models.league import LeagueSettings, Team
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


async def draft_has_started(db: AsyncSession, league_id: int) -> bool:
    status = await db.scalar(select(Draft.status).where(Draft.league_id == league_id))
    return status in STARTED_STATUSES


async def set_team_count(db: AsyncSession, league_id: int, count: int) -> None:
    """Grow with empty teams, or shrink by dropping unclaimed ones (never claimed ones)."""
    if await draft_has_started(db, league_id):
        raise LeagueRuleError("The number of teams is locked once the draft starts")
    teams = list(
        (
            await db.execute(
                select(Team).where(Team.league_id == league_id).order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    for index in range(len(teams), count):
        db.add(Team(name=f"Team {index + 1}", league_id=league_id))

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
            await db.execute(select(Draft).where(Draft.league_id == league_id))
        ).scalar_one_or_none()
        if draft is not None:
            gone = {team.id for team in dropped}
            draft.draft_order_team_ids = [
                None if team_id in gone else team_id
                for team_id in draft.draft_order_team_ids
            ]

    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league_id)
        )
    ).scalar_one()
    settings.number_teams = count
    await db.flush()
