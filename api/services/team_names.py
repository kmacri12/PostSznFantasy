"""Teams named after their owner instead of "Team 3".

Teams are created up front as "Team N", before anyone has claimed them. The moment a member
takes one (joining, creating the league, a commissioner assigning the owner) it becomes
"Team <first word of their display name>", with a number when another team of the season has
that name. A team somebody already renamed is left alone. Never built from the email: names are
shown to every member (`services/display_names.py`).
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import Team
from api.db.models.user import User
from api.services.display_names import placeholder_name

MAX_TEAM_NAME = 40
_DEFAULT_NAME = re.compile(r"^Team \d+$")


def is_default_name(name: str | None) -> bool:
    """The "Team N" a team is created with, as opposed to a name someone chose."""
    return bool(name) and _DEFAULT_NAME.fullmatch(name or "") is not None


def suggested_name(user: User) -> str | None:
    """ "Team Kyle" from the member's display name; None until they have chosen one."""
    username = (user.username or "").strip()
    if not username or username == placeholder_name(user.supabase_uid):
        return None
    return f"Team {username.split()[0]}"[:MAX_TEAM_NAME]


def unique_name(base: str, taken: set[str]) -> str:
    """`base`, or `base 2`, `base 3` ... when another team of the season already has it."""
    if base.casefold() not in taken:
        return base
    number = 2
    while f"{base} {number}".casefold() in taken:
        number += 1
    return f"{base} {number}"


def draft_label(team: Team) -> str:
    """How the draft room names a team: "Open team 3" while nobody owns a "Team 3"."""
    name = team.name or f"Team {team.id}"
    if team.owner_id is None and is_default_name(name):
        return f"Open team {name.split()[1]}"
    return name


async def name_after_owner(db: AsyncSession, team: Team, user: User) -> None:
    """Rename `team` (still "Team N") after the member who just took it."""
    base = suggested_name(user)
    if base is None or not is_default_name(team.name):
        return
    taken = {
        (name or "").casefold()
        for name in await db.scalars(
            select(Team.name).where(
                Team.season_id == team.season_id, Team.id != team.id
            )
        )
    }
    team.name = unique_name(base, taken)
