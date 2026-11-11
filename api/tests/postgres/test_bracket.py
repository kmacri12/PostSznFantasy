from collections.abc import Iterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLPlayerSeasonStats,
    NFLTeam,
    TeamPlayer,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


@pytest.fixture(autouse=True)
def admin(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "uid-0")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def _field(db: AsyncSession) -> None:
    """KC (1) beat BUF (2) in the Wild Card; HOU (3) had the bye; KC plays HOU."""
    db.add_all(
        NFLTeam(id=i, team_abv=abv, team_city=abv, team_name=abv, in_playoffs=True)
        for i, abv in [(1, "KC"), (2, "BUF"), (3, "HOU"), (4, "UNUSED")]
    )
    await db.flush()
    db.add_all(
        [
            NFLGame(
                id="wc",
                season=2025,
                season_type="post",
                game_week=19,
                game_status="Completed",
                game_time_epoch="1767000000",
                team_id_home=1,
                team_id_away=2,
                home_pts=27,
                away_pts=24,
            ),
            NFLGame(
                id="div",
                season=2025,
                season_type="post",
                game_week=20,
                game_status="Scheduled",
                game_time_epoch="1767600000",
                team_id_home=3,
                team_id_away=1,
            ),
        ]
    )
    db.add_all(
        [
            NFLPlayer(id=10, name="Qb One", position="QB", team_id=1),
            NFLPlayer(id=11, name="Wr One", position="WR", team_id=1),
            NFLPlayer(id=12, name="Wr Two", position="WR", team_id=2),
        ]
    )
    await db.flush()
    db.add_all(
        [
            NFLPlayerSeasonStats(season="2025", player_id=10, passing_yards=4000),
            NFLPlayerSeasonStats(season="2025", player_id=11, receiving_yards=900),
            NFLPlayerSeasonStats(season="2025", player_id=12, receiving_yards=500),
        ]
    )
    await db.flush()


async def test_bracket_shows_games_byes_and_top_players_before_the_draft(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="unscheduled")
    await _field(db)

    async with client_as("uid-1") as client:
        response = await client.get(f"/api/seasons/{season.id}/bracket")
    assert response.status_code == 200
    body = response.json()

    assert body["currentRound"] == 2
    wild_card, divisional, conference, super_bowl = body["rounds"]
    assert [g["id"] for g in wild_card["games"]] == ["wc"]
    assert [g["id"] for g in divisional["games"]] == ["div"]
    assert conference["games"] == [] and super_bowl["games"] == []
    final = wild_card["games"][0]
    assert (final["state"], final["homePoints"], final["awayPoints"]) == (
        "final",
        27,
        24,
    )
    assert final["winnerTeamId"] == 1
    assert [p["name"] for p in final["home"]["topPlayers"]] == ["Qb One", "Wr One"]
    # Not played yet: no score, no winner.
    assert divisional["games"][0]["homePoints"] is None
    assert divisional["games"][0]["winnerTeamId"] is None
    assert [t["abbreviation"] for t in body["byes"]] == ["HOU", "UNUSED"]
    assert final["myPlayers"] == []


async def test_my_players_are_starters_or_bench_in_each_games_round(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(
        db, draft_status="completed", roster_num_qb=1, roster_num_bench=2
    )
    await _field(db)
    db.add_all(
        TeamPlayer(season_id=season.id, team_id=teams[1].id, player_id=pid)
        for pid in (10, 11, 12)
    )
    # Round 1 only: the QB starts in slot 0 (the first QB slot).
    db.add(LineupSlot(team_id=teams[1].id, round=1, player_id=10, slot_index=0))
    await db.flush()

    async with client_as("uid-1") as client:
        body = (await client.get(f"/api/seasons/{season.id}/bracket")).json()
    wild_card, divisional, *_ = body["rounds"]
    assert [(p["name"], p["role"]) for p in wild_card["games"][0]["myPlayers"]] == [
        ("Qb One", "starter"),
        ("Wr One", "bench"),
        ("Wr Two", "bench"),
    ]
    assert [(p["name"], p["role"]) for p in divisional["games"][0]["myPlayers"]] == [
        ("Qb One", "bench"),
        ("Wr One", "bench"),
    ]

    async with client_as("uid-0") as other:
        body = (await other.get(f"/api/seasons/{season.id}/bracket")).json()
    assert body["rounds"][0]["games"][0]["myPlayers"] == []


async def test_a_stranger_cannot_read_the_bracket(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("nobody") as client:
        assert (
            await client.get(f"/api/seasons/{season.id}/bracket")
        ).status_code == 403


async def test_the_owner_can_turn_the_bracket_off_and_on(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    url = f"/api/seasons/{season.id}/bracket"

    async with client_as("uid-0") as admin:
        assert (await admin.get("/api/features")).json() == {"bracket": True}
        off = await admin.put(
            "/api/admin/feature-flags/bracket", json={"enabled": False}
        )
        assert off.json() == {"bracket": False}
        assert (await admin.get(url)).status_code == 404
        assert (await admin.get("/api/features")).json() == {"bracket": False}
        on = await admin.put("/api/admin/feature-flags/bracket", json={"enabled": True})
        assert on.json() == {"bracket": True}
        assert (await admin.get(url)).status_code == 200


async def test_unknown_flags_are_refused_and_members_cannot_flip_flags(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db)
    async with client_as("uid-0") as admin:
        response = await admin.put("/api/admin/feature-flags/nope", json={"enabled": 0})
        assert response.status_code == 404
    async with client_as("uid-1") as member:
        response = await member.put(
            "/api/admin/feature-flags/bracket", json={"enabled": False}
        )
        assert response.status_code == 403
