"""Epic 13.1: team QB and team K are explicit league choices with a conflict rule."""

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLPlayer, NFLTeam, Team, TeamPlayer, User
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


async def hold(db: AsyncSession, team: Team, *players: NFLPlayer) -> None:
    db.add_all(
        TeamPlayer(team_id=team.id, season_id=team.season_id, player_id=p.id)
        for p in players
    )
    await db.flush()


async def nfl_team_with(
    db: AsyncSession, abv: str, team_id: int, *named_positions: tuple[str, str]
) -> list[NFLPlayer]:
    db.add(NFLTeam(id=team_id, team_abv=abv, is_active=True, in_playoffs=True))
    await db.flush()
    players = [
        NFLPlayer(id=team_id * 100 + i, name=name, position=pos, team_id=team_id)
        for i, (name, pos) in enumerate(named_positions)
    ]
    db.add_all(players)
    await db.flush()
    return players


async def test_creating_a_league_needs_an_explicit_choice_for_both(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    db.add(User(supabase_uid="creator", username="creator", email="c@x.co"))
    await db.flush()
    base = {"leagueName": "Mine", "rosterSettings": {"numberTeams": 4}}
    async with client_as("creator") as creator:
        none = await creator.post("/api/leagues/create-league", json=base)
        only_qb = await creator.post(
            "/api/leagues/create-league",
            json={**base, "teamUnitSettings": {"teamQb": True}},
        )
        nulls = await creator.post(
            "/api/leagues/create-league",
            json={**base, "teamUnitSettings": {"teamQb": None, "teamK": False}},
        )
        both = await creator.post(
            "/api/leagues/create-league",
            json={**base, "teamUnitSettings": {"teamQb": True, "teamK": False}},
        )
        season_id = both.json()["seasonId"]
        settings = (await creator.get(f"/api/seasons/{season_id}/settings")).json()

    assert (none.status_code, only_qb.status_code, nulls.status_code) == (422, 422, 422)
    assert both.status_code == 201
    assert (settings["teamQb"], settings["teamK"]) == (True, False)


async def test_turning_on_is_blocked_while_a_team_holds_two_from_one_nfl_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jalen Hurts", "QB"), ("Tanner McKee", "QB")
    )
    await hold(db, teams[0], *phi)

    async with client_as("uid-0") as commissioner:
        blocked = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )
        settings = (await commissioner.get(f"/api/seasons/{season.id}/settings")).json()

    assert blocked.status_code == 409
    detail = blocked.json()["detail"]
    for expected in ("Team 0", "Jalen Hurts", "Tanner McKee", "PHI"):
        assert expected in detail
    assert settings["teamQb"] is False


async def test_every_conflict_is_listed_not_just_the_first(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jalen Hurts", "QB"), ("Tanner McKee", "QB")
    )
    kc = await nfl_team_with(
        db, "KC", 22, ("Patrick Mahomes", "QB"), ("Gardner Minshew", "QB")
    )
    await hold(db, teams[0], *phi)
    await hold(db, teams[1], *kc)

    async with client_as("uid-0") as commissioner:
        blocked = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )

    detail = blocked.json()["detail"]
    assert all(name in detail for name in ("Team 0", "Team 1", "PHI", "KC"))


async def test_the_two_settings_are_checked_independently(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jake Elliott", "PK"), ("Backup Kicker", "PK")
    )
    await hold(db, teams[0], *phi)

    async with client_as("uid-0") as commissioner:
        qb_ok = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )
        k_blocked = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamK": True}
        )
        both_blocked = await commissioner.patch(
            f"/api/seasons/{season.id}/settings",
            json={"teamQb": False, "teamK": True},
        )
        settings = (await commissioner.get(f"/api/seasons/{season.id}/settings")).json()

    assert qb_ok.status_code == 200
    assert k_blocked.status_code == 409
    assert "Jake Elliott" in k_blocked.json()["detail"]
    assert both_blocked.status_code == 409
    # A rejected change applies none of it.
    assert (settings["teamQb"], settings["teamK"]) == (True, False)


async def test_one_qb_from_each_nfl_team_is_not_a_conflict(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jalen Hurts", "QB"), ("Tanner McKee", "QB")
    )
    kc = await nfl_team_with(db, "KC", 22, ("Patrick Mahomes", "QB"))
    # Same NFL team on two different fantasy teams is allowed; so is a QB and a WR.
    await hold(db, teams[0], phi[0], kc[0])
    await hold(db, teams[1], phi[1])

    async with client_as("uid-0") as commissioner:
        ok = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )
    assert ok.status_code == 200
    assert ok.json()["teamQb"] is True


async def test_turning_off_is_always_allowed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, team_qb=True, team_k=True)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jalen Hurts", "QB"), ("Tanner McKee", "QB")
    )
    await hold(db, teams[0], *phi)

    async with client_as("uid-0") as commissioner:
        off = await commissioner.patch(
            f"/api/seasons/{season.id}/settings",
            json={"teamQb": False, "teamK": False},
        )
        back_on = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )

    assert off.status_code == 200
    assert (off.json()["teamQb"], off.json()["teamK"]) == (False, False)
    assert back_on.status_code == 409


async def test_leaving_a_setting_as_it_is_never_conflicts(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db, team_qb=True)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jalen Hurts", "QB"), ("Tanner McKee", "QB")
    )
    await hold(db, teams[0], *phi)

    async with client_as("uid-0") as commissioner:
        same = await commissioner.patch(
            f"/api/seasons/{season.id}/settings",
            json={"teamQb": True, "scoringPassingTd": 5},
        )
    assert same.status_code == 200


async def test_only_the_commissioner_can_change_them(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        denied = await member.patch(
            f"/api/seasons/{season.id}/settings", json={"teamK": True}
        )
    assert denied.status_code == 403


async def test_switching_a_setting_is_logged_but_a_refused_switch_is_not(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, teams, _ = await make_season(db)
    phi = await nfl_team_with(
        db, "PHI", 21, ("Jake Elliott", "PK"), ("Backup Kicker", "PK")
    )
    await hold(db, teams[0], *phi)

    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamQb": True}
        )
        refused = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"teamK": True}
        )
        feed = (await commissioner.get(f"/api/seasons/{season.id}/activity")).json()

    assert refused.status_code == 409
    (event,) = feed["events"]
    assert event["payload"]["changes"] == [
        {"field": "teamQb", "before": False, "after": True}
    ]
