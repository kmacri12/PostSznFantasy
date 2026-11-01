from types import SimpleNamespace

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from api.db.models import IngestionStatus, NFLTeam
from api.services.ingestion import ingest_nfl_teams
from api.services.ingestion.guard import LOCK_NAMESPACE, IngestionBusy, IngestionKind
from api.tests.postgres.conftest import TEST_DATABASE_URL, ClientFactory
from api.tests.postgres.factories import make_season

TEAMS = [{"teamID": "1", "teamAbv": "KC"}]


async def test_a_successful_run_records_when_it_synced(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db)
    assert await ingest_nfl_teams(db, raw_data=TEAMS) == 1
    assert await ingest_nfl_teams(db, raw_data=TEAMS) == 1  # upserts the same row

    statuses = (await db.execute(select(IngestionStatus))).scalars().all()
    assert [s.kind for s in statuses] == ["teams"]

    async with client_as("uid-0") as member:
        response = await member.get("/api/players/sync-status")
    assert [row["kind"] for row in response.json()] == ["teams"]
    assert response.json()[0]["lastSyncedAt"]


@pytest.mark.parametrize("exhausted", [False, True])
async def test_sync_status_says_whether_the_daily_api_budget_is_spent(
    db: AsyncSession,
    client_as: ClientFactory,
    monkeypatch: pytest.MonkeyPatch,
    exhausted: bool,
) -> None:
    await make_season(db)
    await ingest_nfl_teams(db, raw_data=TEAMS)
    monkeypatch.setattr(
        "api.routers.players.get_rapidapi_client",
        lambda: SimpleNamespace(budget_exhausted=exhausted),
    )
    async with client_as("uid-0") as member:
        response = await member.get("/api/players/sync-status")
    assert [row["budgetExhausted"] for row in response.json()] == [exhausted]


async def test_an_overlapping_run_of_the_same_kind_is_skipped(
    db: AsyncSession,
) -> None:
    other = create_async_engine(TEST_DATABASE_URL)
    try:
        async with other.connect() as holder:
            await holder.execute(
                text("SELECT pg_advisory_xact_lock(:ns, :kind)"),
                {"ns": LOCK_NAMESPACE, "kind": IngestionKind.TEAMS.value},
            )
            with pytest.raises(IngestionBusy, match="teams"):
                await ingest_nfl_teams(db, raw_data=TEAMS)
            assert (await db.execute(select(NFLTeam))).scalars().all() == []
            await holder.rollback()
    finally:
        await other.dispose()

    assert await ingest_nfl_teams(db, raw_data=TEAMS) == 1  # lock released
