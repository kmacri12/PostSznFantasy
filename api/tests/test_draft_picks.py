from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.db.models.league import LeagueSettings
from api.models.enums import PlayerPosition
from api.services.draft_picks import (
    DraftPickError,
    check_roster_limits,
    make_pick,
    team_on_the_clock,
)


def scalars(rows: list[Any]) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.first.return_value = rows[0] if rows else None
    result.scalars.return_value.all.return_value = rows
    return result


@pytest.mark.parametrize(
    ("pick_index", "expected"),
    [(0, 10), (1, 20), (2, 30), (3, 30), (4, 20), (5, 10), (6, 10)],
)
def test_snake_order_reverses_odd_rounds(pick_index: int, expected: int) -> None:
    assert team_on_the_clock([10, 20, 30], pick_index, "snake") == expected


def test_linear_order_repeats() -> None:
    assert team_on_the_clock([10, 20, 30], 3, "linear") == 10


def make_settings(**overrides: Any) -> LeagueSettings:
    settings = LeagueSettings()
    settings.roster_total = 3
    settings.roster_max_qb = 1
    settings.roster_max_rb = 99
    for key, value in overrides.items():
        setattr(settings, key, value)
    return settings


def test_roster_limits_reject_position_overflow() -> None:
    with pytest.raises(DraftPickError, match="QB"):
        check_roster_limits(make_settings(), [PlayerPosition.QB], PlayerPosition.QB)


def test_roster_limits_reject_full_roster() -> None:
    with pytest.raises(DraftPickError, match="full"):
        check_roster_limits(make_settings(), [PlayerPosition.RB] * 3, PlayerPosition.WR)


def test_roster_limits_allow_unlimited_position() -> None:
    check_roster_limits(make_settings(), [PlayerPosition.RB] * 2, PlayerPosition.RB)


def build_db(
    *,
    picks: list[Any] | None = None,
    team_owner_id: int = 1,
    players: list[Any] | None = None,
    status: str = "Scheduled",
) -> AsyncMock:
    draft = SimpleNamespace(
        id=2, draft_order_team_ids=[5, 6], draft_type="snake", status=status
    )
    team = SimpleNamespace(id=5, owner_id=team_owner_id)
    db = AsyncMock()
    db.add = MagicMock()
    db.get = AsyncMock(return_value=team)
    db.execute = AsyncMock(
        side_effect=[
            scalars([draft]),
            scalars([make_settings(roster_total=2)]),
            scalars(picks or []),
            scalars(players if players is not None else []),
        ]
    )
    return db


QB = SimpleNamespace(id=9, name="QB One", position="QB")
USER = SimpleNamespace(id=1)


@pytest.mark.asyncio
async def test_make_pick_persists_and_advances_draft() -> None:
    db = build_db(players=[QB])
    result = await make_pick(db, 7, USER, 9)  # type: ignore[arg-type]

    assert result.pick.number_pick_overall == 1
    assert result.pick.team_id == 5
    assert result.next_pick_overall == 2
    assert result.player_name == "QB One"
    assert not result.draft_complete
    assert db.add.call_count == 2  # the pick and the roster entry


@pytest.mark.asyncio
async def test_make_pick_rejects_wrong_turn() -> None:
    db = build_db(team_owner_id=99, players=[QB])
    with pytest.raises(DraftPickError, match="not your turn"):
        await make_pick(db, 7, USER, 9)  # type: ignore[arg-type]
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_make_pick_rejects_already_drafted_player() -> None:
    taken = SimpleNamespace(player_id=9, team_id=6)
    db = build_db(picks=[taken], players=[QB])
    # Pick 2 belongs to team 6 in a snake draft, so move the turn to the caller.
    db.get.return_value = SimpleNamespace(id=6, owner_id=1)
    with pytest.raises(DraftPickError, match="already been drafted"):
        await make_pick(db, 7, USER, 9)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_make_pick_rejects_unknown_player() -> None:
    db = build_db(players=[])
    with pytest.raises(DraftPickError, match="Player not found"):
        await make_pick(db, 7, USER, 12345)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_make_pick_rejects_completed_draft() -> None:
    db = build_db(status="Completed")
    with pytest.raises(DraftPickError, match="already complete"):
        await make_pick(db, 7, USER, 9)  # type: ignore[arg-type]
