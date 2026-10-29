import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.draft import Draft, DraftPick, DraftQueueItem
from api.db.models.league import LeagueSettings, Team, TeamPlayer
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats
from api.models.draft_models import (
    DraftPickResponse,
    DraftSetup,
    DraftSlot,
    DraftStateResponse,
)
from api.models.enums import (
    DraftStatus,
    DraftType,
    PickTimeoutAction,
    PlayerPosition,
)
from api.services.draft_picks import (
    DraftPickError,
    PickResult,
    check_roster_limits,
    load_draft_for_update,
    load_settings,
    next_deadline,
    placed_order,
    record_pick,
    team_on_the_clock,
)
from api.utils.calculations.fantasy_points_utils import season_points

STARTED = {
    DraftStatus.IN_PROGRESS.value,
    DraftStatus.PAUSED.value,
    DraftStatus.COMPLETED.value,
}
PRE_DRAFT = {
    DraftStatus.UNSCHEDULED.value,
    DraftStatus.SCHEDULED.value,
    DraftStatus.LOBBY.value,
}


async def build_state(db: AsyncSession, draft: Draft) -> DraftStateResponse:
    teams = list(
        (
            await db.execute(
                select(Team).where(Team.league_id == draft.league_id).order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    by_id = {t.id: t for t in teams}
    owner_names = await _owner_names(db, [t.owner_id for t in teams if t.owner_id])
    order = [
        DraftSlot(
            slot=index + 1,
            team_id=team_id,
            team_name=by_id[team_id].name or f"Team {team_id}",
            owner_name=owner_names.get(by_id[team_id].owner_id or -1),
        )
        for index, team_id in enumerate(draft.draft_order_team_ids)
        if team_id is not None and team_id in by_id
    ]
    pick_rows = (
        await db.execute(
            select(DraftPick, NFLPlayer.name, NFLPlayer.position)
            .join(NFLPlayer, NFLPlayer.id == DraftPick.player_id)
            .where(DraftPick.draft_id == draft.id)
            .order_by(DraftPick.number_pick_overall)
        )
    ).all()
    picks = [
        DraftPickResponse(
            id=p.id,
            draft_id=p.draft_id,
            team_id=p.team_id,
            player_id=p.player_id,
            player_name=name,
            position=position,
            number_round=p.number_round,
            number_pick_overall=p.number_pick_overall,
            number_pick_in_round=p.number_pick_in_round,
            autopick=p.autopick,
        )
        for p, name, position in pick_rows
    ]

    ids = placed_order(draft)
    total = len(ids) * draft.rounds
    live = draft.status in (DraftStatus.IN_PROGRESS.value, DraftStatus.PAUSED.value)
    current = len(picks)
    clock = deck = overall = None
    if live and ids and current < total:
        overall = current + 1
        clock = team_on_the_clock(ids, current, draft.draft_type)
        if current + 1 < total:
            deck = team_on_the_clock(ids, current + 1, draft.draft_type)

    return DraftStateResponse(
        draft_id=draft.id,
        league_id=draft.league_id,
        status=DraftStatus(draft.status),
        start_time=draft.start_time,
        draft_type=DraftType(draft.draft_type),
        rounds=draft.rounds,
        time_per_pick_seconds=draft.time_per_pick_seconds,
        pick_timeout_action=PickTimeoutAction(draft.pick_timeout_action),
        pick_started_at=draft.pick_started_at,
        current_pick_deadline=draft.current_pick_deadline,
        paused_remaining_seconds=draft.paused_remaining_seconds,
        server_time=datetime.now(UTC),
        order_locked=draft.status in STARTED,
        order=order,
        unassigned_team_ids=[t.id for t in teams if t.id not in ids],
        picks=picks,
        total_picks=total,
        current_pick_overall=overall,
        on_the_clock_team_id=clock,
        on_deck_team_id=deck,
    )


async def _owner_names(db: AsyncSession, user_ids: list[int]) -> dict[int, str]:
    from api.db.models.user import User

    if not user_ids:
        return {}
    rows = (
        await db.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
    ).all()
    return {row[0]: row[1] for row in rows}


def _require_pre_draft(draft: Draft) -> None:
    if draft.status not in PRE_DRAFT:
        raise DraftPickError("This can't be changed once the draft has started")


async def apply_setup(db: AsyncSession, league_id: int, setup: DraftSetup) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    if draft.status == DraftStatus.COMPLETED.value:
        raise DraftPickError("The draft is already complete")
    fields = setup.model_fields_set
    structural = {"draft_type", "pick_timeout_action"} & fields
    if structural or setup.start_time or setup.clear_start_time:
        _require_pre_draft(draft)
    if setup.draft_type is not None:
        draft.draft_type = setup.draft_type.value
    if setup.pick_timeout_action is not None:
        draft.pick_timeout_action = setup.pick_timeout_action.value
    if setup.time_per_pick_seconds is not None:
        # Applies from the next pick; the running pick keeps its deadline.
        draft.time_per_pick_seconds = setup.time_per_pick_seconds
    if setup.clear_start_time:
        draft.start_time = None
        draft.status = DraftStatus.UNSCHEDULED.value
    elif setup.start_time is not None:
        draft.start_time = setup.start_time
        if draft.status == DraftStatus.UNSCHEDULED.value:
            draft.status = DraftStatus.SCHEDULED.value
    await db.flush()
    return draft


async def set_order(
    db: AsyncSession, league_id: int, team_ids: list[int | None]
) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    _require_pre_draft(draft)
    league_team_ids = set(
        (await db.execute(select(Team.id).where(Team.league_id == league_id)))
        .scalars()
        .all()
    )
    placed = [team_id for team_id in team_ids if team_id is not None]
    if (
        len(set(placed)) != len(placed)
        or not set(placed) <= league_team_ids
        or len(team_ids) > len(league_team_ids)
    ):
        raise DraftPickError(
            "Draft order must list each team of this league at most once"
        )
    draft.draft_order_team_ids = list(team_ids)
    await db.flush()
    return draft


async def randomize_order(db: AsyncSession, league_id: int) -> Draft:
    team_ids = list(
        (await db.execute(select(Team.id).where(Team.league_id == league_id)))
        .scalars()
        .all()
    )
    random.shuffle(team_ids)
    return await set_order(db, league_id, [*team_ids])


async def open_lobby(db: AsyncSession, league_id: int) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    if draft.status not in (
        DraftStatus.UNSCHEDULED.value,
        DraftStatus.SCHEDULED.value,
    ):
        raise DraftPickError("The lobby can only be opened before the draft starts")
    draft.status = DraftStatus.LOBBY.value
    await db.flush()
    return draft


async def start_draft(db: AsyncSession, league_id: int) -> Draft:
    """The only way a draft starts: an explicit commissioner action, never a page visit."""
    draft = await load_draft_for_update(db, league_id)
    _require_pre_draft(draft)
    team_count = await db.scalar(
        select(func.count()).select_from(Team).where(Team.league_id == league_id)
    )
    order = draft.draft_order_team_ids
    if len(order) != team_count or None in order:
        raise DraftPickError("Assign every team to a draft slot before starting")
    now = datetime.now(UTC)
    draft.status = DraftStatus.IN_PROGRESS.value
    draft.pick_started_at = now
    draft.current_pick_deadline = next_deadline(draft, now)
    draft.paused_remaining_seconds = None
    await db.flush()
    return draft


async def pause_draft(db: AsyncSession, league_id: int) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    if draft.status != DraftStatus.IN_PROGRESS.value:
        raise DraftPickError("Only a running draft can be paused")
    remaining = 0
    if draft.current_pick_deadline is not None:
        remaining = max(
            0,
            int((draft.current_pick_deadline - datetime.now(UTC)).total_seconds()),
        )
    draft.paused_remaining_seconds = remaining
    draft.current_pick_deadline = None
    draft.status = DraftStatus.PAUSED.value
    await db.flush()
    return draft


async def resume_draft(db: AsyncSession, league_id: int) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    if draft.status != DraftStatus.PAUSED.value:
        raise DraftPickError("Only a paused draft can be resumed")
    now = datetime.now(UTC)
    seconds = draft.paused_remaining_seconds or draft.time_per_pick_seconds
    draft.current_pick_deadline = now + timedelta(seconds=seconds)
    draft.pick_started_at = now
    draft.paused_remaining_seconds = None
    draft.status = DraftStatus.IN_PROGRESS.value
    await db.flush()
    return draft


async def undo_last_pick(db: AsyncSession, league_id: int) -> Draft:
    draft = await load_draft_for_update(db, league_id)
    if draft.status not in (
        DraftStatus.IN_PROGRESS.value,
        DraftStatus.PAUSED.value,
        DraftStatus.COMPLETED.value,
    ):
        raise DraftPickError("No picks to undo")
    last = (
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
    if last is None:
        raise DraftPickError("No picks to undo")
    await db.execute(
        delete(TeamPlayer).where(
            TeamPlayer.team_id == last.team_id, TeamPlayer.player_id == last.player_id
        )
    )
    await db.delete(last)
    now = datetime.now(UTC)
    if draft.status == DraftStatus.PAUSED.value:
        draft.paused_remaining_seconds = draft.time_per_pick_seconds
    else:
        draft.status = DraftStatus.IN_PROGRESS.value
        draft.pick_started_at = now
        draft.current_pick_deadline = next_deadline(draft, now)
    await db.flush()
    return draft


async def get_queue(db: AsyncSession, draft_id: int, team_id: int) -> list[int]:
    return list(
        (
            await db.execute(
                select(DraftQueueItem.player_id)
                .where(
                    DraftQueueItem.draft_id == draft_id,
                    DraftQueueItem.team_id == team_id,
                )
                .order_by(DraftQueueItem.position)
            )
        )
        .scalars()
        .all()
    )


async def set_queue(
    db: AsyncSession, draft_id: int, team_id: int, player_ids: list[int]
) -> list[int]:
    unique = list(dict.fromkeys(player_ids))
    known = set(
        (await db.execute(select(NFLPlayer.id).where(NFLPlayer.id.in_(unique))))
        .scalars()
        .all()
    )
    if known != set(unique):
        raise DraftPickError("Queue contains unknown players")
    await db.execute(
        delete(DraftQueueItem).where(
            DraftQueueItem.draft_id == draft_id, DraftQueueItem.team_id == team_id
        )
    )
    db.add_all(
        DraftQueueItem(
            draft_id=draft_id, team_id=team_id, player_id=player_id, position=index
        )
        for index, player_id in enumerate(unique)
    )
    await db.flush()
    return unique


async def _best_available_ids(
    db: AsyncSession, draft: Draft, settings: LeagueSettings
) -> list[int]:
    """Undrafted players on live NFL teams, best last-season fantasy output first."""
    from api.db.models.nfl import NFLTeam

    drafted = select(DraftPick.player_id).where(DraftPick.draft_id == draft.id)
    players = (
        (
            await db.execute(
                select(NFLPlayer)
                .join(NFLTeam, NFLTeam.id == NFLPlayer.team_id)
                .where(NFLTeam.is_active.is_(True), NFLPlayer.id.not_in(drafted))
            )
        )
        .scalars()
        .all()
    )
    latest = await db.scalar(select(func.max(NFLPlayerSeasonStats.season)))
    stats = {}
    if latest is not None:
        stats = {
            s.player_id: s
            for s in (
                await db.execute(
                    select(NFLPlayerSeasonStats).where(
                        NFLPlayerSeasonStats.season == latest
                    )
                )
            )
            .scalars()
            .all()
        }
    scored = [
        (
            float(season_points(stats[p.id], settings, p.position))
            if p.id in stats
            else -1.0,
            p.id,
        )
        for p in players
    ]
    return [pid for _, pid in sorted(scored, key=lambda item: (-item[0], item[1]))]


async def auto_pick(db: AsyncSession, league_id: int) -> PickResult:
    """Pick for whoever is on the clock: their queue first (if configured), then best available."""
    draft = await load_draft_for_update(db, league_id)
    settings = await load_settings(db, league_id)
    if draft.status != DraftStatus.IN_PROGRESS.value:
        raise DraftPickError("The draft is not in progress")
    picks_made = await db.scalar(
        select(func.count())
        .select_from(DraftPick)
        .where(DraftPick.draft_id == draft.id)
    )
    team_id = team_on_the_clock(placed_order(draft), picks_made or 0, draft.draft_type)

    candidates: list[int] = []
    if draft.pick_timeout_action == PickTimeoutAction.QUEUE_THEN_BEST.value:
        candidates.extend(await get_queue(db, draft.id, team_id))
    candidates.extend(await _best_available_ids(db, draft, settings))

    drafted = set(
        (
            await db.execute(
                select(DraftPick.player_id).where(DraftPick.draft_id == draft.id)
            )
        )
        .scalars()
        .all()
    )
    roster_positions = await _roster_positions(db, draft.id, team_id)
    for player_id in dict.fromkeys(candidates):
        if player_id in drafted:
            continue
        player = await db.get(NFLPlayer, player_id)
        if player is None:
            continue
        try:
            check_roster_limits(
                settings, roster_positions, PlayerPosition.from_str(player.position)
            )
        except DraftPickError:
            continue
        return await record_pick(
            db, draft, settings, player_id, acting_user=None, autopick=True
        )
    raise DraftPickError("No eligible player is available to auto-pick")


async def _roster_positions(
    db: AsyncSession, draft_id: int, team_id: int
) -> list[PlayerPosition | None]:
    rows = (
        await db.execute(
            select(NFLPlayer.position)
            .join(DraftPick, DraftPick.player_id == NFLPlayer.id)
            .where(DraftPick.draft_id == draft_id, DraftPick.team_id == team_id)
        )
    ).scalars()
    return [PlayerPosition.from_str(position) for position in rows]
