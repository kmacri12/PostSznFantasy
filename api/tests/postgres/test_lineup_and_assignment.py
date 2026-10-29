from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import NFLTeam, TeamPlayer
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players

LAYOUT: dict[str, Any] = dict(
    roster_total=5, roster_num_qb=1, roster_num_rb=1, roster_num_wr=0, roster_num_te=0,
    roster_num_flex_wr_rb_te=1, roster_num_k=0, roster_num_dst=0, roster_num_bench=2,
)  # fmt: skip


async def _team_with_players(db: AsyncSession):  # type: ignore[no-untyped-def]
    league, users, teams, _ = await make_league(db, **LAYOUT)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB", "RB", "WR"], nfl_team=kc)
    db.add_all(
        TeamPlayer(team_id=teams[0].id, league_id=league.id, player_id=p.id)
        for p in players
    )
    await db.flush()
    return league, users, teams, players


def starters(body: dict) -> dict[str, str]:  # type: ignore[type-arg]
    return {
        f"{s['index']}:{s['slot']}": s["player"]["name"]
        for s in body["slots"]
        if s["player"]
    }


async def test_drag_between_bench_and_starter_persists(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, _, teams, players = await _team_with_players(db)
    url = f"/api/teams/{teams[0].id}"
    async with client_as("uid-0") as owner:
        before = (await owner.get(url)).json()
        bench_index = next(
            s["index"] for s in before["slots"] if s["slot"] == "BENCH" and s["player"]
        )
        bench_player = next(
            s["player"]["id"] for s in before["slots"] if s["index"] == bench_index
        )
        flex_index = next(s["index"] for s in before["slots"] if s["slot"] == "FLEX")
        moved = await owner.post(
            f"{url}/lineup", json={"playerId": bench_player, "slotIndex": flex_index}
        )
        again = (await owner.get(url)).json()
    assert moved.status_code == 200
    flex = next(s for s in again["slots"] if s["index"] == flex_index)
    assert flex["player"]["id"] == bench_player
    # The player who held FLEX swapped down to the bench spot.
    assert (
        next(s for s in again["slots"] if s["index"] == bench_index)["player"]
        is not None
    )
    assert len(players) == len(again["roster"])


async def test_lineup_rules_are_enforced(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    _, _, teams, players = await _team_with_players(db)
    url = f"/api/teams/{teams[0].id}/lineup"
    qb_slot = 0
    async with client_as("uid-0") as owner:
        wrong_position = await owner.post(
            url, json={"playerId": players[3].id, "slotIndex": qb_slot}
        )
        stranger = await owner.post(url, json={"playerId": 999999, "slotIndex": 3})
    async with client_as("uid-1") as other:
        not_owner = await other.post(
            url, json={"playerId": players[0].id, "slotIndex": 3}
        )
    assert wrong_position.status_code == 409
    assert stranger.status_code == 400
    assert not_owner.status_code == 403


async def test_commissioner_assigns_and_moves_team_owners(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, users, teams, _ = await make_league(db)
    base = f"/api/leagues/{league.id}/teams"
    async with client_as("uid-0") as commissioner:
        unassign = await commissioner.put(
            f"{base}/{teams[1].id}/owner", json={"userId": None}
        )
        # Member 1 takes team 0's seat: they leave nothing behind, team 0's owner is replaced.
        take = await commissioner.put(
            f"{base}/{teams[0].id}/owner", json={"userId": users[1].id}
        )
        outsider = await commissioner.put(
            f"{base}/{teams[0].id}/owner", json={"userId": 424242}
        )
        wrong_league = await commissioner.put(
            f"{base}/999999/owner", json={"userId": None}
        )
    assert unassign.json()["openSpots"] == 1
    owners = {t["id"]: t["ownerUserId"] for t in take.json()["teams"]}
    assert owners[teams[0].id] == users[1].id
    assert owners[teams[1].id] is None
    assert outsider.status_code == 409
    assert wrong_league.status_code == 404
    async with client_as("uid-1") as member:
        denied = await member.put(f"{base}/{teams[0].id}/owner", json={"userId": None})
    assert denied.status_code == 403
