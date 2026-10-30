from collections.abc import Iterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import NFLGame, NFLTeam
from api.tests.postgres.conftest import ClientFactory


@pytest.fixture(autouse=True)
def admin(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "admin-uid")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def _teams(db: AsyncSession) -> None:
    db.add_all([NFLTeam(id=1, team_abv="KC"), NFLTeam(id=2, team_abv="BUF")])
    await db.flush()


async def _team(db: AsyncSession, team_id: int) -> NFLTeam:
    team = await db.get(NFLTeam, team_id)
    assert team is not None
    await db.refresh(team)
    return team


async def test_entering_a_result_creates_the_game_and_eliminates_the_loser(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await _teams(db)
    async with client_as("admin-uid") as admin:
        response = await admin.put(
            "/api/admin/games/20270109_BUF@KC/result",
            json={
                "season": 2026,
                "teamIdHome": 1,
                "teamIdAway": 2,
                "homePts": 27,
                "awayPts": 24,
            },
        )
    assert response.status_code == 200

    game = await db.get(NFLGame, "20270109_BUF@KC")
    assert game is not None
    assert (game.game_status, game.home_pts, game.away_pts) == ("Completed", 27, 24)
    assert game.season_type == "post"
    assert (await _team(db, 2)).is_active is False
    assert (await _team(db, 1)).is_active is True


async def test_correcting_a_result_flips_the_elimination(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await _teams(db)
    body = {"season": 2026, "teamIdHome": 1, "teamIdAway": 2}
    async with client_as("admin-uid") as admin:
        await admin.put(
            "/api/admin/games/g/result", json=body | {"homePts": 27, "awayPts": 24}
        )
        await admin.put(
            "/api/admin/games/g/result", json=body | {"homePts": 20, "awayPts": 24}
        )

    assert (await _team(db, 1)).is_active is False
    assert (await _team(db, 2)).is_active is True


async def test_a_non_admin_cannot_enter_results(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    async with client_as("someone") as user:
        response = await user.put(
            "/api/admin/games/g/result",
            json={
                "season": 2026,
                "teamIdHome": 1,
                "teamIdAway": 2,
                "homePts": 1,
                "awayPts": 0,
            },
        )
    assert response.status_code == 403
