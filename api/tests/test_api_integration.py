from unittest.mock import AsyncMock, MagicMock

import pytest
from api.db.models.draft import Draft, DraftPick
from api.db.models.league import League, LeagueSettings, LeagueStanding, Team
from api.db.models.user import User
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_login_create_and_sync(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    # 1. Test creating new user
    mock_result_empty = MagicMock()
    mock_result_empty.scalars.return_value.first.return_value = None
    mock_db_session.execute.return_value = mock_result_empty

    payload = {"email": "player@example.com", "username": "playmaker"}
    response = await async_client.post(
        "/api/auth/login",
        json=payload,
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User created successfully"
    assert mock_db_session.add.called
    assert mock_db_session.commit.called

    # 2. Test existing user login
    existing_user = User(
        id=42,
        supabase_uid="test-supabase-uid-12345",
        email="old@example.com",
        username="olduser",
    )
    mock_result_existing = MagicMock()
    mock_result_existing.scalars.return_value.first.return_value = existing_user
    mock_db_session.execute.return_value = mock_result_existing

    response2 = await async_client.post(
        "/api/auth/login",
        json=payload,
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["message"] == "Login successful"
    assert data2["userId"] == 42


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
    assert mock_db_session.commit.called


@pytest.mark.asyncio
async def test_get_user_leagues(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    user = User(
        id=1,
        supabase_uid="test-supabase-uid-12345",
        email="commish@example.com",
        username="commish",
    )
    league = League(id=99, name="Champions League", commissioner_id=1)
    team = Team(id=101, name="Team 1", owner_id=1, league_id=99)
    team.league = league

    mock_user_res = MagicMock()
    mock_user_res.scalars.return_value.first.return_value = user

    mock_teams_res = MagicMock()
    mock_teams_res.scalars.return_value.all.return_value = [team]

    mock_db_session.execute.side_effect = [mock_user_res, mock_teams_res]

    response = await async_client.get(
        "/api/leagues/user-leagues",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Champions League"
    assert data[0]["userTeamId"] == 101


@pytest.mark.asyncio
async def test_get_league_settings_and_standings(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    settings = LeagueSettings(
        id=1,
        league_id=99,
        number_teams=8,
        roster_total=14,
        roster_num_qb=1,
        roster_num_rb=2,
        roster_num_wr=2,
        roster_num_te=1,
        roster_num_flex_wr_rb_te=1,
        roster_num_flex_wr_rb=0,
        roster_num_flex_wr_te=0,
        roster_num_flex_qb_wr_rb_te=0,
        roster_num_k=1,
        roster_num_dst=1,
        roster_num_bench=5,
    )
    mock_settings_res = MagicMock()
    mock_settings_res.scalars.return_value.first.return_value = settings

    mock_db_session.execute.return_value = mock_settings_res

    response = await async_client.get(
        "/api/leagues/99/settings",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    assert response.json()["numberTeams"] == 8

    # Standings
    standing = LeagueStanding(
        id=1,
        league_id=99,
        team_id=10,
        rank=1,
        players_left=5,
        total=120.5,
    )
    mock_standings_res = MagicMock()
    mock_standings_res.scalars.return_value.all.return_value = [standing]
    mock_db_session.execute.return_value = mock_standings_res

    response2 = await async_client.get(
        "/api/leagues/99/standings",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response2.status_code == 200
    standings_data = response2.json()
    assert len(standings_data) == 1
    assert standings_data[0]["rank"] == 1
    assert standings_data[0]["playersLeft"] == 5


@pytest.mark.asyncio
async def test_draft_endpoints(
    async_client: AsyncClient,
    mock_db_session: AsyncMock,
) -> None:
    draft = Draft(
        id=5,
        league_id=99,
        status="In_Progress",
        draft_type="snake",
        time_per_pick_seconds=60,
    )
    mock_draft_res = MagicMock()
    mock_draft_res.scalars.return_value.first.return_value = draft
    mock_db_session.execute.return_value = mock_draft_res

    res = await async_client.get(
        "/api/drafts/draft-info/99",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "In_Progress"

    pick = DraftPick(
        id=1,
        draft_id=5,
        team_id=10,
        player_id=1001,
        number_round=1,
        number_pick_overall=1,
        number_pick_in_round=1,
        autopick=False,
    )
    mock_picks_res = MagicMock()
    mock_picks_res.scalars.return_value.all.return_value = [pick]
    mock_db_session.execute.return_value = mock_picks_res

    picks_res = await async_client.get(
        "/api/drafts/draft-picks/5",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert picks_res.status_code == 200
    picks = picks_res.json()
    assert len(picks) == 1
    assert picks[0]["playerId"] == 1001
