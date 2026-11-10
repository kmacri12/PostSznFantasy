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
                "create": True,
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
    body = {"season": 2026, "teamIdHome": 1, "teamIdAway": 2, "create": True}
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


async def test_bad_results_are_refused_and_change_nothing(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await _teams(db)
    good = {"season": 2026, "teamIdHome": 1, "teamIdAway": 2, "homePts": 27}
    good["awayPts"] = 24
    async with client_as("admin-uid") as admin:
        url = "/api/admin/games/real/result"
        assert (await admin.put(url, json=good | {"create": True})).status_code == 200
        bad = {
            "unknown team": good | {"teamIdAway": 99},
            "same team twice": good | {"teamIdAway": 1},
            "negative score": good | {"homePts": -1},
            "absurd score": good | {"awayPts": 1000},
            "far-off season": good | {"season": 1850},
            "other season": good | {"season": 2025},
        }
        for label, body in bad.items():
            assert (await admin.put(url, json=body)).status_code == 422, label
        unknown_game = await admin.put("/api/admin/games/typo/result", json=good)
        eliminate = await admin.post(
            "/api/admin/update/eliminate_teams", json={"teamIds": [1, 4242]}
        )
    assert unknown_game.status_code == 404
    assert await db.get(NFLGame, "typo") is None
    assert eliminate.status_code == 422
    assert "4242" in eliminate.json()["detail"]
    assert (await _team(db, 1)).is_active is True


async def test_admin_actions_are_logged_with_who_and_what(
    db: AsyncSession, client_as: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    await _teams(db)
    body = {"season": 2026, "teamIdHome": 1, "teamIdAway": 2, "homePts": 3}
    body["awayPts"] = 0
    with caplog.at_level("INFO", logger="api.routers.admin"):
        async with client_as("admin-uid") as admin:
            await admin.put("/api/admin/games/x/result", json=body | {"create": True})
    record = next(r for r in caplog.records if r.getMessage() == "Admin action")
    assert record.__dict__["admin_uid"] == "admin-uid"
    assert record.__dict__["path"] == "/api/admin/games/x/result"
    assert "homePts" in record.__dict__["body"]
