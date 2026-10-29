import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer
from api.db.models.user import User
from api.models.enums import DraftStatus, PlayerPosition

logger = logging.getLogger(__name__)

DRAFT_IN_PROGRESS = DraftStatus.IN_PROGRESS.value
DRAFT_COMPLETED = DraftStatus.COMPLETED.value


class DraftPickError(Exception):
    """A pick was rejected; the message is safe to show to the drafter."""


@dataclass(frozen=True)
class PickResult:
    pick: DraftPick
    player_name: str
    next_pick_overall: int
    draft_complete: bool


def team_on_the_clock(order: list[int], pick_index: int, draft_type: str | None) -> int:
    """Team id owning the zero-based `pick_index`, reversing odd rounds for snake drafts."""
    round_index, slot = divmod(pick_index, len(order))
    if draft_type == "snake" and round_index % 2 == 1:
        slot = len(order) - 1 - slot
    return order[slot]


def check_roster_limits(
    settings: LeagueSettings,
    drafted_positions: list[PlayerPosition | None],
    candidate_position: PlayerPosition | None,
) -> None:
    if len(drafted_positions) >= settings.roster_total:
        raise DraftPickError("Your roster is full")
    if candidate_position is None:
        return
    limit: int | None = getattr(
        settings, f"roster_max_{candidate_position.value.lower()}"
    )
    if limit is not None and drafted_positions.count(candidate_position) >= limit:
        raise DraftPickError(f"Roster limit reached for {candidate_position.value}")


async def make_pick(
    db: AsyncSession, league_id: int, user: User, player_id: int
) -> PickResult:
    """Validate and persist the next pick; the caller owns commit/rollback.

    The draft row is locked so concurrent submissions cannot claim the same slot.
    """
    draft = (
        (
            await db.execute(
                select(Draft).where(Draft.league_id == league_id).with_for_update()
            )
        )
        .scalars()
        .first()
    )
    settings = (
        (
            await db.execute(
                select(LeagueSettings).where(LeagueSettings.league_id == league_id)
            )
        )
        .scalars()
        .first()
    )
    if draft is None or settings is None:
        raise DraftPickError("Draft not found")
    order = draft.draft_order_team_ids or []
    if not order:
        raise DraftPickError("Draft order has not been set")
    if draft.status == DRAFT_COMPLETED:
        raise DraftPickError("The draft is already complete")

    picks = list(
        (await db.execute(select(DraftPick).where(DraftPick.draft_id == draft.id)))
        .scalars()
        .all()
    )
    pick_index = len(picks)
    total_picks = len(order) * settings.roster_total
    if pick_index >= total_picks:
        raise DraftPickError("The draft is already complete")

    team_id = team_on_the_clock(order, pick_index, draft.draft_type)
    team = await db.get(Team, team_id)
    if team is None or team.owner_id != user.id:
        raise DraftPickError("It is not your turn to pick")

    if any(p.player_id == player_id for p in picks):
        raise DraftPickError("Player has already been drafted")

    team_player_ids = [p.player_id for p in picks if p.team_id == team_id]
    players = {
        p.id: p
        for p in (
            await db.execute(
                select(NFLPlayer).where(NFLPlayer.id.in_([*team_player_ids, player_id]))
            )
        )
        .scalars()
        .all()
    }
    candidate = players.get(player_id)
    if candidate is None:
        raise DraftPickError("Player not found")
    check_roster_limits(
        settings,
        [
            PlayerPosition.from_str(players[pid].position)
            for pid in team_player_ids
            if pid in players
        ],
        PlayerPosition.from_str(candidate.position),
    )

    pick = DraftPick(
        draft_id=draft.id,
        team_id=team_id,
        player_id=player_id,
        number_round=pick_index // len(order) + 1,
        number_pick_overall=pick_index + 1,
        number_pick_in_round=pick_index % len(order) + 1,
        autopick=False,
    )
    db.add(pick)
    db.add(TeamPlayer(team_id=team_id, player_id=player_id))
    draft_complete = pick_index + 1 >= total_picks
    draft.status = DRAFT_COMPLETED if draft_complete else DRAFT_IN_PROGRESS
    await db.flush()

    logger.info(
        "Draft pick recorded",
        extra={"league_id": league_id, "pick": pick.number_pick_overall},
    )
    return PickResult(
        pick=pick,
        player_name=candidate.name or "",
        next_pick_overall=pick_index + 2,
        draft_complete=draft_complete,
    )
