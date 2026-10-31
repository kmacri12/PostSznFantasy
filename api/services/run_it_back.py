"""Run it back: next season's league from a finished one.

Members, their roles, teams (names and owners), league notes and every setting carry
over. Rosters, lineups, picks, standings and the activity feed start empty, the draft
is unscheduled again, and a fresh invite replaces the old league's.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import class_mapper

from api.db.models.draft import Draft
from api.db.models.league import League, LeagueMember, LeagueSettings, Team
from api.db.models.user import User
from api.models.enums import DraftStatus
from api.services import invites
from api.services.league_members import LeagueRuleError
from api.services.season_recap import season_is_finished

# Draft columns that describe this draft's progress rather than how it is set up.
_DRAFT_STATE = {
    "id",
    "league_id",
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


async def run_it_back(db: AsyncSession, league: League, commissioner: User) -> League:
    if not await season_is_finished(db, league.season):
        raise LeagueRuleError("The season is not over yet")
    already = await db.scalar(
        select(League.id).where(League.previous_league_id == league.id)
    )
    if already is not None:
        raise LeagueRuleError("This league has already been run back")

    new = League(
        name=league.name,
        season=league.season + 1,
        notes=league.notes,
        previous_league_id=league.id,
    )
    db.add(new)
    await db.flush()

    settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league.id)
        )
    ).scalar_one()
    db.add(
        LeagueSettings(
            league_id=new.id,
            **_copy_columns(settings, LeagueSettings, {"id", "league_id"}),
        )
    )
    members = (
        (
            await db.execute(
                select(LeagueMember).where(LeagueMember.league_id == league.id)
            )
        )
        .scalars()
        .all()
    )
    db.add_all(
        LeagueMember(league_id=new.id, user_id=m.user_id, role=m.role) for m in members
    )
    teams = (
        (
            await db.execute(
                select(Team).where(Team.league_id == league.id).order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    db.add_all(Team(name=t.name, owner_id=t.owner_id, league_id=new.id) for t in teams)
    old_draft = (
        await db.execute(select(Draft).where(Draft.league_id == league.id))
    ).scalar_one_or_none()
    db.add(
        Draft(
            league_id=new.id,
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

    await invites.revoke_invites(db, league.id)
    await invites.create_invite(db, new.id, commissioner.id, None, None)
    return new
