"""A team takes its owner's name the moment it is claimed: "Team Kyle", not "Team 3"."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import Team, User
from api.services.display_names import placeholder_name
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


async def _league_with_open_teams(
    db: AsyncSession, open_names: list[str]
) -> tuple[int, int]:
    season, _, _, _ = await make_season(db, teams=2, draft_status="scheduled")
    for name in open_names:
        db.add(Team(name=name, season_id=season.id))
    await db.flush()
    return season.league_id, season.id


async def _invite(client_as: ClientFactory, league_id: int) -> str:
    async with client_as("uid-0") as commissioner:
        created = await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
    return str(created.json()["code"])


async def _team_of(db: AsyncSession, season_id: int, username: str) -> Team:
    return (
        await db.execute(
            select(Team)
            .join(User, User.id == Team.owner_id)
            .where(Team.season_id == season_id, User.username == username)
        )
    ).scalar_one()


async def test_joining_renames_the_claimed_team_after_the_member(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id = await _league_with_open_teams(db, ["Team 3", "Team 4"])
    db.add(User(supabase_uid="kyle1", username="Kyle Macri", email="a@x.co"))
    db.add(User(supabase_uid="kyle2", username="Kyle Hamel", email="b@x.co"))
    await db.flush()
    code = await _invite(client_as, league_id)

    for uid in ("kyle1", "kyle2"):
        async with client_as(uid) as member:
            assert (await member.post(f"/api/invites/{code}/join")).status_code == 200

    assert (await _team_of(db, season_id, "Kyle Macri")).name == "Team Kyle"
    assert (await _team_of(db, season_id, "Kyle Hamel")).name == "Team Kyle 2"


async def test_a_team_someone_already_renamed_keeps_its_name(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id = await _league_with_open_teams(db, ["The Closers"])
    db.add(User(supabase_uid="kyle1", username="Kyle", email="a@x.co"))
    await db.flush()
    code = await _invite(client_as, league_id)
    async with client_as("kyle1") as member:
        await member.post(f"/api/invites/{code}/join")
    assert (await _team_of(db, season_id, "Kyle")).name == "The Closers"


async def test_a_member_with_no_name_yet_leaves_it_for_the_name_dialog(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id = await _league_with_open_teams(db, ["Team 3"])
    uid = "abcdef123456"
    db.add(User(supabase_uid=uid, username=placeholder_name(uid), email="a@x.co"))
    await db.flush()
    code = await _invite(client_as, league_id)
    async with client_as(uid) as member:
        await member.post(f"/api/invites/{code}/join")
    assert (await _team_of(db, season_id, placeholder_name(uid))).name == "Team 3"


async def test_the_creator_of_a_league_gets_a_team_named_after_them(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    db.add(User(supabase_uid="creator", username="Kyle Macri", email="c@x.co"))
    await db.flush()
    async with client_as("creator") as creator:
        created = await creator.post(
            "/api/leagues/create-league",
            json={
                "leagueName": "Mine",
                "rosterSettings": {"numberTeams": 3},
                "teamUnitSettings": {"teamQb": False, "teamK": False},
            },
        )
    assert created.status_code == 201, created.text
    names = (
        (
            await db.execute(
                select(Team.name)
                .where(Team.season_id == created.json()["seasonId"])
                .order_by(Team.id)
            )
        )
        .scalars()
        .all()
    )
    assert list(names) == ["Team Kyle", "Team 2", "Team 3"]


async def test_a_commissioner_assigning_an_owner_names_the_team_too(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, season_id = await _league_with_open_teams(db, ["Team 3"])
    member = User(supabase_uid="sam1", username="Sam", email="s@x.co")
    db.add(member)
    await db.flush()
    code = await _invite(client_as, league_id)
    async with client_as("sam1") as joiner:
        await joiner.post(f"/api/invites/{code}/join")
    open_team = Team(name="Team 9", season_id=season_id)
    db.add(open_team)
    await db.flush()
    async with client_as("uid-0") as commissioner:
        response = await commissioner.put(
            f"/api/seasons/{season_id}/teams/{open_team.id}/owner",
            json={"userId": member.id},
        )
    assert response.status_code == 200, response.text
    await db.refresh(open_team)
    assert open_team.name == "Team Sam 2"  # "Team Sam" is the team Sam joined onto
