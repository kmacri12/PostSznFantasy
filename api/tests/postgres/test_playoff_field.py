"""Setting the playoff field: the admin endpoint and the owner's command-line script."""

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import NFLTeam
from api.scripts import set_playoff_field as script
from api.services.playoff_field import PlayoffFieldError
from api.tests.postgres.conftest import ClientFactory

ABBREVIATIONS = [
    "BUF", "KC", "BAL", "HOU", "PIT", "LAC", "DEN", "PHI",
    "DET", "LAR", "TB", "GB", "MIN", "WSH", "NYJ", "DAL",
]  # fmt: skip
FIELD = ABBREVIATIONS[:14]


@pytest.fixture(autouse=True)
def admin(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ADMIN_SUPABASE_UIDS", "admin-uid")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
async def teams(db: AsyncSession) -> list[NFLTeam]:
    rows = [
        NFLTeam(id=i + 1, team_abv=abv, team_city="City", team_name=f"Team {abv}")
        for i, abv in enumerate(ABBREVIATIONS)
    ]
    rows[-1].in_playoffs = True  # a stale field member that must be cleared
    db.add_all(rows)
    await db.flush()
    return rows


async def _field(db: AsyncSession) -> list[str]:
    db.expire_all()
    abvs = await db.scalars(
        select(NFLTeam.team_abv).where(NFLTeam.in_playoffs).order_by(NFLTeam.team_abv)
    )
    return [abv or "" for abv in abvs]


async def test_the_script_replaces_the_field_by_abbreviation(
    db: AsyncSession, teams: list[NFLTeam]
) -> None:
    field = await script.set_field_from_abbreviations(
        db, [abv.lower() for abv in FIELD]
    )

    assert [team.team_abv for team in field] == sorted(FIELD)
    assert await _field(db) == sorted(FIELD)


async def test_unknown_abbreviations_are_named_and_nothing_changes(
    db: AsyncSession, teams: list[NFLTeam]
) -> None:
    with pytest.raises(PlayoffFieldError, match="XYZ, ZZZ") as exc:
        await script.set_field_from_abbreviations(db, [*FIELD[:12], "ZZZ", "XYZ"])

    assert "Known: BAL, BUF" in str(exc.value)
    assert await _field(db) == ["DAL"]


@pytest.mark.parametrize(
    ("abbreviations", "count"),
    [(FIELD[:13], 13), (ABBREVIATIONS[:15], 15), ([*FIELD[:13], "buf"], 13)],
)
async def test_the_field_needs_exactly_fourteen_different_teams(
    db: AsyncSession, teams: list[NFLTeam], abbreviations: list[str], count: int
) -> None:
    with pytest.raises(PlayoffFieldError, match=f"exactly 14 teams, got {count}"):
        await script.set_field_from_abbreviations(db, abbreviations)

    assert await _field(db) == ["DAL"]


async def test_an_empty_teams_table_says_to_load_the_data_first(
    db: AsyncSession,
) -> None:
    with pytest.raises(PlayoffFieldError, match="No NFL teams are loaded"):
        await script.set_field_from_abbreviations(db, FIELD)


@pytest.fixture
def cli(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    """Point the script's own session at the test transaction."""

    @asynccontextmanager
    async def session() -> AsyncIterator[AsyncSession]:
        yield db

    async def no_op() -> None:
        return None

    monkeypatch.setattr(script, "get_session_factory", lambda: session)
    monkeypatch.setattr(script, "close_db", no_op)
    monkeypatch.setattr(script, "setup_logging", lambda: None)


async def test_the_command_prints_the_new_field(
    db: AsyncSession,
    teams: list[NFLTeam],
    cli: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("INFO")

    await script.main(FIELD)

    assert await _field(db) == sorted(FIELD)
    assert "Playoff field set (14 teams): BAL City Team BAL, BUF" in caplog.text


async def test_the_command_exits_with_the_reason_on_a_bad_field(
    db: AsyncSession, teams: list[NFLTeam], cli: None
) -> None:
    with pytest.raises(SystemExit, match="Playoff field not changed: .*XYZ"):
        await script.main([*FIELD[:13], "XYZ"])

    assert await _field(db) == ["DAL"]


async def test_the_admin_endpoint_rejects_unknown_team_ids(
    db: AsyncSession, teams: list[NFLTeam], client_as: ClientFactory
) -> None:
    async with client_as("admin-uid") as admin:
        response = await admin.put(
            "/api/admin/playoff-field", json={"teamIds": [*range(1, 14), 999]}
        )

    assert response.status_code == 422
    assert "999" in response.json()["detail"]
    assert await _field(db) == ["DAL"]


async def test_the_admin_endpoint_sets_the_field(
    db: AsyncSession, teams: list[NFLTeam], client_as: ClientFactory
) -> None:
    async with client_as("admin-uid") as admin:
        response = await admin.put(
            "/api/admin/playoff-field", json={"teamIds": list(range(1, 15))}
        )

    assert response.status_code == 200
    assert await _field(db) == sorted(FIELD)
