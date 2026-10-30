"""Team QB and team K: the rules for QBs and Ks that score as their NFL team's unit.

With a position's setting on, a drafted QB (or K) scores every player whose official
roster position is that position on his NFL team (docs/product-rules.md section 4).
DST is always a unit and needs none of this: its stats already belong to the team.
"""

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer, NFLTeam
from api.models.enums import PlayerPosition
from api.services.league_members import LeagueRuleError

TEAM_UNIT_SETTING_FIELDS: dict[PlayerPosition, str] = {
    PlayerPosition.QB: "team_qb",
    PlayerPosition.K: "team_k",
}


def combined_positions(settings: LeagueSettings) -> frozenset[PlayerPosition]:
    """Positions whose drafted player scores his whole NFL team's players."""
    return frozenset(
        position
        for position, field in TEAM_UNIT_SETTING_FIELDS.items()
        if getattr(settings, field)
    )


def newly_enabled(
    settings: LeagueSettings, updates: dict[str, object]
) -> frozenset[PlayerPosition]:
    """Positions an update would switch from off to on."""
    return frozenset(
        position
        for position, field in TEAM_UNIT_SETTING_FIELDS.items()
        if updates.get(field) is True and not getattr(settings, field)
    )


@dataclass(frozen=True)
class SameTeamConflict:
    """A fantasy team holding two players of one position from one NFL team."""

    position: PlayerPosition
    fantasy_team: str
    nfl_team: str
    players: tuple[str, ...]

    def __str__(self) -> str:
        names = " and ".join(self.players)
        return f"{self.fantasy_team}: {names} ({self.nfl_team} {self.position.value}s)"


async def same_team_conflicts(
    db: AsyncSession, league_id: int, positions: frozenset[PlayerPosition]
) -> list[SameTeamConflict]:
    rows = (
        await db.execute(
            select(Team.id, Team.name, NFLTeam.id, NFLTeam.team_abv, NFLPlayer)
            .select_from(TeamPlayer)
            .join(Team, Team.id == TeamPlayer.team_id)
            .join(NFLPlayer, NFLPlayer.id == TeamPlayer.player_id)
            .join(NFLTeam, NFLTeam.id == NFLPlayer.team_id)
            .where(TeamPlayer.league_id == league_id)
            .order_by(Team.id, NFLPlayer.name)
        )
    ).all()
    held: dict[tuple[int, int, PlayerPosition], list[tuple[str, str, str]]] = (
        defaultdict(list)
    )
    for fantasy_id, fantasy_name, nfl_id, nfl_abv, player in rows:
        position = PlayerPosition.from_str(player.position)
        if position in positions:
            held[(fantasy_id, nfl_id, position)].append(
                (fantasy_name or f"Team {fantasy_id}", nfl_abv or "", player.name or "")
            )
    return [
        SameTeamConflict(
            position, group[0][0], group[0][1], tuple(name for _, _, name in group)
        )
        for (_, _, position), group in held.items()
        if len(group) > 1
    ]


async def require_no_same_team_conflicts(
    db: AsyncSession, league_id: int, positions: frozenset[PlayerPosition]
) -> None:
    """Turning a position on is refused while any fantasy team holds two from one NFL team."""
    conflicts = await same_team_conflicts(db, league_id, positions)
    if not conflicts:
        return
    label = " and ".join(
        f"team {position.value}"
        for position in sorted(positions, key=lambda p: p.value)
    )
    raise LeagueRuleError(
        f"Can't turn on {label}: these fantasy teams hold two players of one "
        "position from the same NFL team, which would draft that unit twice. "
        + "; ".join(str(conflict) for conflict in conflicts)
    )
