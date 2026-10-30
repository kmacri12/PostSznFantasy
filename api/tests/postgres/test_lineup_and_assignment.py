from sqlalchemy.ext.asyncio import AsyncSession

from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league


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
