from unittest.mock import AsyncMock

import pytest

from api.services.eliminations import mark_eliminated_teams


@pytest.mark.asyncio
async def test_mark_eliminated_teams_updates_only_given_ids() -> None:
    db = AsyncMock()
    await mark_eliminated_teams(db, [3, 9])

    statement = db.execute.await_args.args[0]
    assert "UPDATE nfl.nfl_teams" in str(statement)
    params = statement.compile().params
    assert params["is_active"] is False
    assert params["id_1"] == [3, 9]


@pytest.mark.asyncio
async def test_mark_eliminated_teams_noop_for_empty_list() -> None:
    db = AsyncMock()
    await mark_eliminated_teams(db, [])
    db.execute.assert_not_called()
