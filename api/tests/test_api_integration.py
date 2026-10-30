from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError, OperationalError

from api.db.models.draft import Draft
from api.db.models.league import LeagueSettings
from api.db.models.nfl import NFLPlayer, NFLPlayerSeasonStats, NFLTeam
from api.db.models.user import User


@pytest.mark.asyncio
async def test_auth_login_create_and_sync(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    payload = {"email": "player@example.com", "username": "playmaker"}

    # 1. First login inserts the user (Postgres reports xmax = 0 for fresh rows)
    mock_db_session.execute.return_value = MagicMock(one=lambda: (42, True))
    response = await async_client.post(
        "/api/auth/login",
        json=payload,
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"message": "User created successfully", "userId": 42}

    # 2. Later logins hit the conflict branch of the same statement
    mock_db_session.execute.return_value = MagicMock(one=lambda: (42, False))
    response2 = await async_client.post(
        "/api/auth/login",
        json=payload,
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response2.status_code == 200
    assert response2.json() == {"message": "Login successful", "userId": 42}


@pytest.mark.asyncio
async def test_auth_login_without_profile_fields(
    async_client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    mock_db_session.execute.return_value = MagicMock(one=lambda: (7, False))
    response = await async_client.post("/api/auth/login", json={})
    assert response.status_code == 200
    assert response.json()["userId"] == 7


@pytest.mark.asyncio
async def test_auth_login_duplicate_email_conflict(
    async_client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    mock_db_session.execute.side_effect = IntegrityError("stmt", {}, Exception("dup"))
    response = await async_client.post("/api/auth/login", json={"email": "a@b.co"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_auth_login_rejects_overlong_username(
    async_client: AsyncClient,
) -> None:
    response = await async_client.post("/api/auth/login", json={"username": "x" * 21})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_league_success(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    user = User(
        id=1,
        supabase_uid="test-supabase-uid-12345",
        email="commish@example.com",
        username="commish",
    )
    mock_user_res = MagicMock()
    mock_user_res.scalars.return_value.first.return_value = user
    mock_db_session.execute.return_value = mock_user_res

    payload = {
        "leagueName": "Playoff Showdown",
        "rosterSettings": {
            "number_teams": 4,
            "roster_total": 10,
        },
        "scoringSettings": {
            "scoring_passing_td": 6,
        },
    }

    response = await async_client.post(
        "/api/leagues/create-league",
        json=payload,
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "Playoff Showdown" in data["message"]
    assert mock_db_session.flush.called


def _result(*, all_: list[object] | None = None, first: object = None) -> MagicMock:
    res = MagicMock()
    res.scalars.return_value.all.return_value = all_ or []
    res.scalars.return_value.first.return_value = first
    return res


@pytest.mark.asyncio
async def test_player_list_and_season_stats(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    team = NFLTeam(id=1, team_abv="KC", team_city="Kansas City", is_active=True)
    player = NFLPlayer(id=7, name="Pat Mahomes", position="QB", team_id=1, team=team)
    mock_db_session.execute.return_value = _result(all_=[player])

    res = await async_client.get("/api/players/player-list?position=qb&isActive=true")
    assert res.status_code == 200
    data = res.json()
    assert data[0]["name"] == "Pat Mahomes"
    assert data[0]["teamAbv"] == "KC"

    stats = NFLPlayerSeasonStats(season="2025", player_id=7)
    # Column defaults only apply on INSERT, so populate them for the unsaved row.
    for column in NFLPlayerSeasonStats.__table__.columns:
        if column.name not in ("season", "player_id"):
            setattr(
                stats,
                column.name,
                [] if column.name == "kicking_fg_yards_made" else 0,
            )
    stats.passing_yards = 4000
    stats.player = player
    season_res = MagicMock()
    season_res.scalar.return_value = "2025"
    mock_db_session.execute.side_effect = [season_res, _result(all_=[stats])]

    res2 = await async_client.get("/api/players/player-season-stats")
    assert res2.status_code == 200
    row = res2.json()[0]
    assert row["season"] == "2025"
    assert row["passingYards"] == 4000
    assert row["player"]["team"]["teamAbv"] == "KC"


@pytest.mark.asyncio
async def test_scoring_defaults_match_product_rules(async_client: AsyncClient) -> None:
    res = await async_client.get("/api/leagues/scoring-defaults")
    assert res.status_code == 200
    body = res.json()
    assert body["scoring_passing_yard"] == 0.04
    assert body["scoring_passing_td"] == 4
    assert body["scoring_receiving_reception"] == 1
    assert body["scoring_rushing_yard"] == 0.1
    assert body["scoring_carrying_fumble_lost"] == -2
    assert body["scoring_passing_interception"] == -2
    assert body["scoring_kicking_fg_yard"] == 0.1
    assert body["scoring_kicking_xp_miss"] == -1
    assert body["scoring_dst_pts_allowed_0"] == 7
    assert body["scoring_dst_yards_allowed_under_100"] == 6
    assert "scoring_special_kick_return_td" not in body
    assert "scoring_kicking_fg_made_50_plus" not in body


@pytest.mark.asyncio
async def test_create_league_without_scoring_persists_defaults(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    user = User(
        id=1, supabase_uid="test-supabase-uid-12345", email="a@b.c", username="a"
    )
    mock_db_session.execute.return_value = _result(first=user)

    res = await async_client.post(
        "/api/leagues/create-league",
        json={"leagueName": "Defaults", "rosterSettings": {"numberTeams": 4}},
    )
    assert res.status_code == 201
    added = [call.args[0] for call in mock_db_session.add.call_args_list]
    settings = next(obj for obj in added if isinstance(obj, LeagueSettings))
    assert settings.scoring_passing_yard == 0.04
    assert settings.scoring_receiving_reception == 1


@pytest.mark.asyncio
async def test_health_checks_database(
    async_client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    response = await async_client.get("/api")
    assert response.status_code == 200
    mock_db_session.execute.assert_awaited()

    mock_db_session.execute.side_effect = OperationalError("SELECT 1", {}, Exception())
    response = await async_client.get("/api")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_create_league_uses_requested_draft_timing(
    async_client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    user = User(id=1, supabase_uid="x", email=None, username="c")
    mock_db_session.execute.return_value = _result(first=user)
    response = await async_client.post(
        "/api/leagues/create-league",
        json={
            "leagueName": "Timed",
            "rosterSettings": {"numberTeams": 4},
            "draftStartTime": "2030-01-05T18:00:00Z",
            "timePerPickSeconds": 30,
        },
    )
    assert response.status_code == 201
    drafts = [
        c.args[0]
        for c in mock_db_session.add.call_args_list
        if isinstance(c.args[0], Draft)
    ]
    assert drafts[0].time_per_pick_seconds == 30
    assert drafts[0].start_time is not None
    assert drafts[0].start_time.year == 2030


def test_gzip_middleware_is_registered() -> None:
    from api.main import app

    options = [
        m.kwargs
        for m in app.user_middleware
        if getattr(m.cls, "__name__", "") == "GZipMiddleware"
    ]
    assert options == [{"minimum_size": 1000}]
