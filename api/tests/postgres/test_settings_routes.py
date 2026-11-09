from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import SeasonSettings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season


def update_body(**roster: int) -> dict[str, object]:
    return {"scoringPassingTd": 6, **roster}


async def test_only_the_commissioner_can_update_settings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    build = client_as

    async with build("uid-1") as member:
        denied = await member.patch(
            f"/api/seasons/{season.id}/settings", json=update_body()
        )
    assert denied.status_code == 403

    async with build("uid-0") as commissioner:
        ok = await commissioner.patch(
            f"/api/seasons/{season.id}/settings",
            json=update_body(rosterTotal=9, rosterNumBench=0),
        )
    assert ok.status_code == 200
    assert ok.json()["rosterTotal"] == 9

    stored = await db.scalar(
        select(SeasonSettings).where(SeasonSettings.season_id == season.id)
    )
    assert stored is not None
    assert stored.roster_total == 9
    assert float(stored.scoring_passing_td) == 6.0


async def test_outsiders_cannot_read_league_data(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    build = client_as

    async with build("uid-1") as member:
        assert (
            await member.get(f"/api/seasons/{season.id}/settings")
        ).status_code == 200
        assert (await member.get(f"/api/seasons/{season.id}/teams")).status_code == 200
    async with build("stranger") as stranger:
        assert (
            await stranger.get(f"/api/seasons/{season.id}/settings")
        ).status_code == 403


async def test_roster_shape_locks_once_the_draft_starts(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)  # in_progress
    async with client_as("uid-0") as commissioner:
        locked = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"rosterTotal": 18}
        )
        unchanged = await commissioner.patch(
            f"/api/seasons/{season.id}/settings", json={"rosterTotal": 2}
        )
        scoring = await commissioner.patch(
            f"/api/seasons/{season.id}/settings",
            json={"scoringPassingTd": 5, "multiplierSuperBowl": 3},
        )
    assert locked.status_code == 409
    assert "roster_total" in locked.json()["detail"]
    assert unchanged.status_code == 200
    assert scoring.status_code == 200
    assert scoring.json()["multiplierSuperBowl"] == 3


async def test_settings_outside_the_limits_are_refused(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    url = f"/api/seasons/{season.id}/settings"
    bad_bodies: list[dict[str, object]] = [
        {"rosterNumBench": 2_000_000_000},
        {"rosterNumBench": -1},
        {"rosterNumBench": 21, "rosterTotal": 30},
        {"rosterTotal": 41},
        {"rosterTotal": 0},
        {"rosterTotal": 12},  # slots add up to 9 + 9 bench
        {"rosterMaxQb": 0},  # below the one QB starter
        {
            "rosterNumQb": 0,
            "rosterNumRb": 0,
            "rosterNumWr": 0,
            "rosterNumTe": 0,
            "rosterNumFlexWrRbTe": 0,
            "rosterNumK": 0,
            "rosterNumDst": 0,
            "rosterTotal": 9,
        },  # no starter slot at all
        {"scoringPassingTd": 1e308},
        {"scoringPassingTd": -101},
    ]
    async with client_as("uid-0") as commissioner:
        for body in bad_bodies:
            response = await commissioner.patch(url, json=body)
            assert response.status_code == 422, body
        for raw in ('{"scoringPassingTd": NaN}', '{"scoringPassingYard": Infinity}'):
            response = await commissioner.patch(
                url, content=raw, headers={"Content-Type": "application/json"}
            )
            assert response.status_code == 422, raw
        derived = await commissioner.patch(url, json={"rosterNumBench": 3})
    assert derived.status_code == 200
    assert derived.json()["rosterTotal"] == 12


async def test_pick_clock_is_bounded(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        for seconds in (14, 601, 86400):
            response = await commissioner.patch(
                f"/api/drafts/{season.id}", json={"timePerPickSeconds": seconds}
            )
            assert response.status_code == 422, seconds
