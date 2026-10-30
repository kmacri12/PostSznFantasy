"""The one QB and one K per playoff NFL team that the team unit draft pool lists.

The depth chart's first name is trusted only while he is still on that team at that
position. Otherwise (no entry, a stale one, or no sync yet) the player with the most
pass attempts (QB) or kicks (K) in the latest season stats starts. That is a weaker
signal: a returning starter trails his backup's totals, so each use is logged.
"""

import logging
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.nfl import (
    DepthChartStarter,
    NFLPlayer,
    NFLPlayerSeasonStats,
    NFLTeam,
)
from api.models.enums import PlayerPosition

logger = logging.getLogger(__name__)

UNIT_POSITIONS = (PlayerPosition.QB, PlayerPosition.K)
_warned: set[tuple[int, PlayerPosition, int]] = set()


@dataclass(frozen=True)
class Starter:
    player_id: int
    from_depth_chart: bool


def _workload(stats: NFLPlayerSeasonStats | None, position: PlayerPosition) -> int:
    if stats is None:
        return 0
    if position is PlayerPosition.QB:
        return stats.passing_attempts or 0
    return (
        (stats.kicking_fg_made or 0)
        + (stats.kicking_fg_missed or 0)
        + (stats.kicking_xp_made or 0)
        + (stats.kicking_xp_missed or 0)
    )


async def resolve_starters(
    db: AsyncSession,
) -> dict[tuple[int, PlayerPosition], Starter]:
    """Starter per (playoff NFL team, QB or K); a team with no such player has none."""
    teams = {
        team_id: abv
        for team_id, abv in (
            await db.execute(
                select(NFLTeam.id, NFLTeam.team_abv).where(NFLTeam.in_playoffs)
            )
        ).all()
    }
    candidates: dict[tuple[int, PlayerPosition], list[int]] = {}
    for player_id, team_id, raw_position in (
        await db.execute(
            select(NFLPlayer.id, NFLPlayer.team_id, NFLPlayer.position)
            .where(NFLPlayer.team_id.in_(teams))
            .order_by(NFLPlayer.id)
        )
    ).all():
        position = PlayerPosition.from_str(raw_position)
        if team_id is not None and position in UNIT_POSITIONS:
            assert position is not None
            candidates.setdefault((team_id, position), []).append(player_id)

    listed = {
        (team_id, PlayerPosition(position)): player_id
        for team_id, position, player_id in (
            await db.execute(
                select(
                    DepthChartStarter.team_id,
                    DepthChartStarter.position,
                    DepthChartStarter.player_id,
                )
            )
        ).all()
    }
    latest = await db.scalar(select(func.max(NFLPlayerSeasonStats.season)))
    stats = (
        {
            s.player_id: s
            for s in (
                await db.execute(
                    select(NFLPlayerSeasonStats).where(
                        NFLPlayerSeasonStats.season == latest
                    )
                )
            ).scalars()
        }
        if latest is not None
        else {}
    )

    starters: dict[tuple[int, PlayerPosition], Starter] = {}
    for unit, player_ids in candidates.items():
        team_id, position = unit
        if listed.get(unit) in player_ids:
            starters[unit] = Starter(listed[unit], from_depth_chart=True)
            continue
        chosen = max(
            player_ids, key=lambda pid: (_workload(stats.get(pid), position), -pid)
        )
        starters[unit] = Starter(chosen, from_depth_chart=False)
        if (team_id, position, chosen) not in _warned:
            _warned.add((team_id, position, chosen))
            logger.warning(
                "No usable depth chart %s for %s; falling back to the most %s",
                position.value,
                teams[team_id],
                "pass attempts" if position is PlayerPosition.QB else "kicks",
                extra={"team_id": team_id, "player_id": chosen},
            )
    return starters
