"""Generated team pictures: a colour no other team of the season has, kept for good."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Team, User
from api.services import team_pictures
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league


async def _colors(db: AsyncSession, season_id: int) -> list[int]:
    return list(
        (
            await db.execute(
                select(Team.picture_color).where(Team.season_id == season_id)
            )
        )
        .scalars()
        .all()
    )


async def test_a_new_league_gives_every_team_its_own_colour(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    db.add(User(supabase_uid="creator", username="creator", email="c@x.co"))
    await db.flush()
    async with client_as("creator") as creator:
        created = await creator.post(
            "/api/leagues/create-league",
            json={
                "leagueName": "Mine",
                "rosterSettings": {"numberTeams": 10},
                "teamUnitSettings": {"teamQb": False, "teamK": False},
            },
        )
        assert created.status_code == 201, created.text
        season_id = created.json()["seasonId"]
        standings = (await creator.get(f"/api/seasons/{season_id}/standings")).json()
        team_id = standings["teams"][0]["teamId"]
        detail = (await creator.get(f"/api/teams/{team_id}")).json()

    colors = await _colors(db, season_id)
    assert len(colors) == 10 and len(set(colors)) == 10
    assert all(0 <= c < team_pictures.COLORS for c in colors)
    # Standings (and the team page) carry the picture, so the SPA can draw it.
    assert {t["teamPicture"]["color"] for t in standings["teams"]} == set(colors)
    assert detail["picture"].keys() == {"color", "icon"}


async def test_growing_the_league_never_repeats_a_colour(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    db.add(User(supabase_uid="creator", username="creator", email="c@x.co"))
    await db.flush()
    async with client_as("creator") as creator:
        created = await creator.post(
            "/api/leagues/create-league",
            json={
                "leagueName": "Mine",
                "rosterSettings": {"numberTeams": 4},
                "teamUnitSettings": {"teamQb": False, "teamK": False},
            },
        )
        assert created.status_code == 201, created.text
        season_id = created.json()["seasonId"]
        grown = await creator.patch(
            f"/api/seasons/{season_id}", json={"numberTeams": 10}
        )
    assert grown.status_code == 200, grown.text
    colors = await _colors(db, season_id)
    assert len(colors) == 10 and len(set(colors)) == 10


async def test_the_next_season_keeps_each_teams_picture(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    for index, team in enumerate(teams):
        team.picture_color, team.picture_icon = index + 3, index + 5
    await db.flush()

    async with client_as("uid-0") as commissioner:
        started = await commissioner.post(f"/api/leagues/{season.league_id}/seasons")
    new_id = started.json()["seasonId"]
    new_teams = (
        (await db.execute(select(Team).where(Team.season_id == new_id))).scalars().all()
    )
    by_name = {t.name: (t.picture_color, t.picture_icon) for t in new_teams}
    assert by_name == {t.name: (t.picture_color, t.picture_icon) for t in teams}


def test_assign_avoids_taken_colours_and_wraps_when_the_palette_runs_out() -> None:
    picks = team_pictures.assign([0, 1, 2], 9)
    assert sorted(color for color, _ in picks) == list(range(3, 12))
    more = team_pictures.assign(range(team_pictures.COLORS), 3)
    assert len(more) == 3 and len({color for color, _ in more}) == 3
    assert all(0 <= icon < team_pictures.ICONS for _, icon in picks + more)
