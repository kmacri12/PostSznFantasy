import logging
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick
from api.db.models.league import SeasonSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer, NFLTeam
from api.db.models.user import User
from api.models.activity_models import DraftCompletedPayload
from api.models.enums import DraftStatus, DraftType, PlayerPosition
from api.services import activity
from api.services.standings import recompute_season_standings
from api.services.team_units import unavailable_in_pool

logger = logging.getLogger(__name__)


class DraftPickError(Exception):
    """A pick or draft action was rejected; the message is safe to show to the drafter.

    `code` lets clients react (flag a taken player) without parsing the message.
    """

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


class PickNotDue(DraftPickError):
    """The draft moved on (a pick, pause or completion) between the clock's scan and
    its lock."""


@dataclass(frozen=True)
class PickResult:
    pick: DraftPick
    player_name: str
    next_pick_overall: int
    draft_complete: bool
    already_recorded: bool = False
    # Reserved picks recorded right after this one, in order.
    chained: tuple["PickResult", ...] = ()


def placed_order(draft: Draft) -> list[int]:
    """The order without empty slots; complete whenever a draft is running."""
    return [team_id for team_id in draft.draft_order_team_ids if team_id is not None]


def team_on_the_clock(order: list[int], pick_index: int, draft_type: str | None) -> int:
    """Team id owning the zero-based `pick_index`, honouring the draft type's reversals."""
    round_index, slot = divmod(pick_index, len(order))
    if draft_type == DraftType.SNAKE.value:
        reverse = round_index % 2 == 1
    elif draft_type == DraftType.THIRD_ROUND_REVERSAL.value:
        # Rounds 1-2 snake, round 3 repeats round 2's direction, then snake resumes.
        reverse = round_index == 1 or (round_index >= 2 and round_index % 2 == 0)
    else:
        reverse = False
    return order[len(order) - 1 - slot if reverse else slot]


def position_cap_reason(
    settings: SeasonSettings,
    drafted_positions: list[PlayerPosition | None],
    position: PlayerPosition | None,
) -> str | None:
    """Plain-language reason a team can't draft this position anymore, if it can't."""
    if position is None:
        return None
    cap: int | None = getattr(settings, f"roster_max_{position.value.lower()}")
    if cap is None or drafted_positions.count(position) < cap:
        return None
    noun = position.value if cap == 1 else f"{position.value}s"
    return f"You already have {cap} {noun}, the most your league allows"


def check_roster_limits(
    settings: SeasonSettings,
    drafted_positions: list[PlayerPosition | None],
    candidate_position: PlayerPosition | None,
) -> None:
    if len(drafted_positions) >= settings.roster_total:
        raise DraftPickError("Your roster is full", code="roster_full")
    reason = position_cap_reason(settings, drafted_positions, candidate_position)
    if reason:
        raise DraftPickError(reason, code="position_capped")


async def _in_draft_pool(db: AsyncSession, player: NFLPlayer) -> bool:
    if player.team_id is None or PlayerPosition.from_str(player.position) is None:
        return False
    return bool(
        await db.scalar(select(NFLTeam.in_playoffs).where(NFLTeam.id == player.team_id))
    )


def next_deadline(draft: Draft, now: datetime) -> datetime:
    return now + timedelta(seconds=draft.time_per_pick_seconds)


async def load_draft_for_update(db: AsyncSession, season_id: int) -> Draft:
    draft = (
        (
            await db.execute(
                select(Draft).where(Draft.season_id == season_id).with_for_update()
            )
        )
        .scalars()
        .first()
    )
    if draft is None:
        raise DraftPickError("Draft not found")
    return draft


async def load_settings(db: AsyncSession, season_id: int) -> SeasonSettings:
    settings = (
        await db.execute(
            select(SeasonSettings).where(SeasonSettings.season_id == season_id)
        )
    ).scalar_one_or_none()
    if settings is None:
        raise DraftPickError("Draft not found")
    return settings


def reservations(draft: Draft) -> dict[int, int]:
    """Commissioner-assigned players for slots still to come: overall pick -> player id."""
    return {int(slot): player_id for slot, player_id in draft.reserved_picks.items()}


def store_reservations(draft: Draft, reserved: dict[int, int]) -> None:
    draft.reserved_picks = {str(slot): pid for slot, pid in sorted(reserved.items())}


async def reserved_positions(
    db: AsyncSession,
    draft: Draft,
    order: list[int],
    team_id: int,
    *,
    skip_slot: int | None = None,
) -> list[PlayerPosition | None]:
    """Positions the team is already due to receive from reserved slots, so a pick or
    another reservation cannot overfill a roster the reservation would later break."""
    slots = [
        player_id
        for slot, player_id in reservations(draft).items()
        if slot != skip_slot
        and team_on_the_clock(order, slot - 1, draft.draft_type) == team_id
    ]
    if not slots:
        return []
    rows = (
        await db.execute(select(NFLPlayer.position).where(NFLPlayer.id.in_(slots)))
    ).scalars()
    return [PlayerPosition.from_str(position) for position in rows]


async def validate_candidate(
    db: AsyncSession,
    draft: Draft,
    settings: SeasonSettings,
    *,
    team_id: int,
    player_id: int,
    picks: list[DraftPick],
    skip_slot: int | None,
    replacing_player_id: int | None = None,
) -> NFLPlayer:
    """Every rule a player must pass to join `team_id`: not drafted or reserved, in the
    pool, under the position caps and roster size. `skip_slot` is the slot being filled
    (its own reservation does not count against it); `replacing_player_id` is the
    player a replacement removes from the team."""
    if any(p.player_id == player_id for p in picks):
        raise DraftPickError("Player has already been drafted", code="player_taken")
    reserved = reservations(draft)
    if any(slot != skip_slot and pid == player_id for slot, pid in reserved.items()):
        raise DraftPickError(
            "Player is reserved for another pick", code="player_reserved"
        )

    team_player_ids = [
        p.player_id
        for p in picks
        if p.team_id == team_id and p.player_id != replacing_player_id
    ]
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
    if not await _in_draft_pool(db, candidate):
        raise DraftPickError(
            f"{candidate.name} is not on a playoff team", code="not_in_pool"
        )
    taken = [p.player_id for p in picks if p.player_id != replacing_player_id] + [
        pid for slot, pid in reserved.items() if slot != skip_slot
    ]
    refusal = (await unavailable_in_pool(db, settings, taken)).get(player_id)
    if refusal:
        raise DraftPickError(refusal, code="not_in_pool")
    check_roster_limits(
        settings,
        [
            *(
                PlayerPosition.from_str(players[pid].position)
                for pid in team_player_ids
                if pid in players
            ),
            *await reserved_positions(
                db, draft, placed_order(draft), team_id, skip_slot=skip_slot
            ),
        ],
        PlayerPosition.from_str(candidate.position),
    )
    return candidate


async def _record_one(
    db: AsyncSession,
    draft: Draft,
    settings: SeasonSettings,
    player_id: int,
    *,
    acting_user: User | None,
    autopick: bool,
) -> PickResult:
    order = placed_order(draft)
    if not order:
        raise DraftPickError("Draft order has not been set")
    if draft.status == DraftStatus.COMPLETED.value:
        raise DraftPickError("The draft is already complete")
    if draft.status != DraftStatus.IN_PROGRESS.value:
        raise DraftPickError("The draft is not in progress")

    picks = list(
        (await db.execute(select(DraftPick).where(DraftPick.draft_id == draft.id)))
        .scalars()
        .all()
    )
    pick_index = len(picks)
    total_picks = len(order) * draft.rounds
    if pick_index >= total_picks:
        raise DraftPickError("The draft is already complete")

    team_id = team_on_the_clock(order, pick_index, draft.draft_type)
    team = await db.get(Team, team_id)
    if team is None or (acting_user is not None and team.owner_id != acting_user.id):
        raise DraftPickError("It is not your turn to pick", code="not_your_turn")

    candidate = await validate_candidate(
        db,
        draft,
        settings,
        team_id=team_id,
        player_id=player_id,
        picks=picks,
        skip_slot=pick_index + 1,
    )

    pick = DraftPick(
        draft_id=draft.id,
        team_id=team_id,
        player_id=player_id,
        number_round=pick_index // len(order) + 1,
        number_pick_overall=pick_index + 1,
        number_pick_in_round=pick_index % len(order) + 1,
        autopick=autopick,
    )
    db.add(pick)
    db.add(TeamPlayer(team_id=team_id, season_id=draft.season_id, player_id=player_id))
    store_reservations(
        draft, {s: p for s, p in reservations(draft).items() if s != pick_index + 1}
    )

    draft_complete = pick_index + 1 >= total_picks
    now = datetime.now(UTC)
    if draft_complete:
        draft.status = DraftStatus.COMPLETED.value
        draft.pick_started_at = None
        draft.current_pick_deadline = None
    else:
        draft.pick_started_at = now
        draft.current_pick_deadline = next_deadline(draft, now)
    await db.flush()
    if draft_complete:
        await activity.append(
            db, draft.season_id, DraftCompletedPayload(picks=pick_index + 1)
        )
        await recompute_season_standings(db, draft.season_id)

    logger.info(
        "Draft pick recorded",
        extra={"season_id": draft.season_id, "pick": pick.number_pick_overall},
    )
    return PickResult(
        pick=pick,
        player_name=candidate.name or "",
        next_pick_overall=pick_index + 2,
        draft_complete=draft_complete,
    )


async def settle_reservations(
    db: AsyncSession, draft: Draft, settings: SeasonSettings
) -> list[PickResult]:
    """Record the reserved picks that are now due, one after another, so a slot a
    commissioner filled by hand is skipped when it comes up. A reservation that no
    longer passes the rules is dropped and its slot falls back to the clock."""
    settled: list[PickResult] = []
    while draft.status == DraftStatus.IN_PROGRESS.value:
        made = await db.scalar(
            select(func.count())
            .select_from(DraftPick)
            .where(DraftPick.draft_id == draft.id)
        )
        slot = (made or 0) + 1
        player_id = reservations(draft).get(slot)
        if player_id is None:
            break
        try:
            settled.append(
                await _record_one(
                    db,
                    draft,
                    settings,
                    player_id,
                    acting_user=None,
                    autopick=False,
                )
            )
        except DraftPickError as exc:
            logger.warning(
                "Dropped a reserved pick that is no longer valid",
                extra={"season_id": draft.season_id, "pick": slot, "error": str(exc)},
            )
            store_reservations(
                draft, {s: p for s, p in reservations(draft).items() if s != slot}
            )
            break
    return settled


async def record_pick(
    db: AsyncSession,
    draft: Draft,
    settings: SeasonSettings,
    player_id: int,
    *,
    acting_user: User | None,
    autopick: bool = False,
) -> PickResult:
    """Validate and persist the next pick, then advance the server-side clock.

    `acting_user` is None for server-initiated picks (auto-pick, forced pick, a
    commissioner's assignment), which skip the ownership check but obey every other
    rule. Reserved picks that fall due right after it are recorded too (`chained`).
    The draft row must be locked.
    """
    first = await _record_one(
        db, draft, settings, player_id, acting_user=acting_user, autopick=autopick
    )
    chained = await settle_reservations(db, draft, settings)
    if not chained:
        return first
    return replace(
        first,
        chained=tuple(chained),
        draft_complete=chained[-1].draft_complete,
    )


async def make_pick(
    db: AsyncSession, season_id: int, user: User, player_id: int
) -> PickResult:
    """A drafter's pick. Replaying the pick just made returns it instead of failing."""
    draft = await load_draft_for_update(db, season_id)
    settings = await load_settings(db, season_id)

    latest = (
        (
            await db.execute(
                select(DraftPick)
                .where(DraftPick.draft_id == draft.id)
                .order_by(DraftPick.number_pick_overall.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )
    if latest is not None and latest.player_id == player_id and not latest.autopick:
        owner = await db.scalar(select(Team.owner_id).where(Team.id == latest.team_id))
        if owner == user.id:
            player = await db.get(NFLPlayer, player_id)
            return PickResult(
                pick=latest,
                player_name=(player.name if player else "") or "",
                next_pick_overall=latest.number_pick_overall + 1,
                draft_complete=draft.status == DraftStatus.COMPLETED.value,
                already_recorded=True,
            )
    return await record_pick(db, draft, settings, player_id, acting_user=user)
