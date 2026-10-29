from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLGame, NFLTeam, TeamPlayer
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players


async def test_empty_roster_still_shows_every_slot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, _, teams, _ = await make_league(
        db, roster_total=7, roster_num_qb=1, roster_num_rb=1, roster_num_wr=1,
        roster_num_te=1, roster_num_flex_wr_rb_te=1, roster_num_k=1, roster_num_dst=1,
        roster_num_bench=0,
    )  # fmt: skip
    async with client_as("uid-0") as owner:
        body = (await owner.get(f"/api/teams/{teams[0].id}")).json()
    assert [s["slot"] for s in body["slots"]] == [
        "QB", "RB", "WR", "TE", "FLEX", "K", "DEF"
    ]  # fmt: skip
    assert all(slot["player"] is None for slot in body["slots"])
    assert body["roster"] == []
    assert body["canEdit"] is True


async def test_players_fill_matching_then_flex_then_bench_slots(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, teams, _ = await make_league(
        db, roster_total=4, roster_num_qb=1, roster_num_rb=1, roster_num_wr=0,
        roster_num_te=0, roster_num_flex_wr_rb_te=1, roster_num_k=0,
        roster_num_dst=0, roster_num_bench=1,
    )  # fmt: skip
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["RB", "RB", "RB", "QB"], nfl_team=kc)
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in players
    )
    await db.flush()
    async with client_as("uid-0") as owner:
        body = (await owner.get(f"/api/teams/{teams[0].id}")).json()
    filled = {s["slot"]: s["player"]["position"] for s in body["slots"] if s["player"]}
    assert filled == {"QB": "QB", "RB": "RB", "FLEX": "RB", "BENCH": "RB"}


async def test_roster_shows_alive_status_and_next_game(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, teams, _ = await make_league(db, roster_total=2, roster_num_bench=1)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    buf = NFLTeam(id=2, team_abv="BUF", is_active=False)
    db.add_all([kc, buf])
    await db.flush()
    alive = (await make_players(db, ["QB"], nfl_team=kc))[0]
    dead = (await make_players(db, ["RB"], nfl_team=buf, first_id=2000))[0]
    db.add_all(
        [
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=alive.id),
            TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=dead.id),
            NFLGame(
                id="g1", season=2025, season_type="post", game_status="Scheduled",
                game_time_epoch="1800000000", team_id_home=1, team_id_away=3,
            ),
        ]
    )  # fmt: skip
    db.add(NFLTeam(id=3, team_abv="DEN", is_active=True))
    await db.flush()
    async with client_as("uid-0") as owner:
        roster = (await owner.get(f"/api/teams/{teams[0].id}")).json()["roster"]
    by_pos = {p["position"]: p for p in roster}
    assert by_pos["QB"]["isActive"] is True
    assert by_pos["QB"]["nextGame"]["opponentAbv"] == "DEN"
    assert by_pos["RB"]["isActive"] is False
    assert by_pos["RB"]["nextGame"] is None


async def test_owner_and_commissioner_can_rename_others_cannot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, _, teams, _ = await make_league(db)
    url = f"/api/teams/{teams[1].id}"
    async with client_as("uid-1") as owner:
        assert (await owner.patch(url, json={"name": "Mine"})).status_code == 200
        assert (
            await owner.patch(f"/api/teams/{teams[0].id}", json={"name": "Hack"})
        ).status_code == 403
    async with client_as("uid-0") as commissioner:
        renamed = await commissioner.patch(url, json={"name": "By Commish"})
    assert renamed.json()["name"] == "By Commish"
    assert (await db.get(type(teams[1]), teams[1].id)).name == "By Commish"  # type: ignore[union-attr]


async def _roster_with_eliminated_player(db: AsyncSession, **settings: bool) -> tuple:  # type: ignore[type-arg]
    league, _, teams, _ = await make_league(
        db, draft_status="completed", roster_total=2, roster_num_bench=2
    )
    from api.db.models import LeagueSettings

    row = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league.id)
        )
    ).scalar_one()
    for key, value in settings.items():
        setattr(row, key, value)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    out = NFLTeam(id=2, team_abv="BUF", is_active=False)
    db.add_all([kc, out])
    await db.flush()
    dead = (await make_players(db, ["RB"], nfl_team=out))[0]
    free_active = (await make_players(db, ["WR"], nfl_team=kc, first_id=2000))[0]
    free_dead = (await make_players(db, ["TE"], nfl_team=out, first_id=3000))[0]
    keeper = (await make_players(db, ["QB"], nfl_team=kc, first_id=4000))[0]
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in (dead, keeper)
    )
    await db.flush()
    return teams[0], dead, free_active, free_dead, keeper


async def test_swapping_an_eliminated_player_is_allowed_without_free_agency(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    team, dead, free_active, free_dead, keeper = await _roster_with_eliminated_player(
        db, free_agency_enabled=False, allow_swap_eliminated=True
    )
    url = f"/api/teams/{team.id}/roster"
    async with client_as("uid-0") as owner:
        pure_add = await owner.post(url, json={"addPlayerId": free_active.id})
        drop_alive = await owner.post(
            url, json={"dropPlayerId": keeper.id, "addPlayerId": free_active.id}
        )
        add_eliminated = await owner.post(
            url, json={"dropPlayerId": dead.id, "addPlayerId": free_dead.id}
        )
        swap = await owner.post(
            url, json={"dropPlayerId": dead.id, "addPlayerId": free_active.id}
        )
    assert pure_add.status_code == 409
    assert drop_alive.status_code == 409
    assert add_eliminated.status_code == 409
    assert swap.status_code == 200
    assert {p["id"] for p in swap.json()["roster"]} == {keeper.id, free_active.id}


async def test_free_agency_allows_any_add_drop_but_not_someone_elses_player(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    team, dead, free_active, _, keeper = await _roster_with_eliminated_player(
        db, free_agency_enabled=True
    )
    url = f"/api/teams/{team.id}/roster"
    async with client_as("uid-0") as owner:
        full = await owner.post(url, json={"addPlayerId": free_active.id})
        ok = await owner.post(
            url, json={"dropPlayerId": keeper.id, "addPlayerId": free_active.id}
        )
        taken = await owner.post(url, json={"addPlayerId": dead.id})
    assert full.status_code == 409  # roster is at its limit; a drop is required
    assert ok.status_code == 200
    assert taken.status_code == 409
    async with client_as("uid-1") as other_owner:
        denied = await other_owner.post(url, json={"addPlayerId": free_active.id})
    assert denied.status_code == 403
