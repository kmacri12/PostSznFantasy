from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    Draft,
    League,
    LeagueInvite,
    LeagueMember,
    LeagueSettings,
    Team,
    TeamPlayer,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league


async def _run_back(client_as: ClientFactory, league_id: int, uid: str = "uid-0"):  # type: ignore[no-untyped-def]
    async with client_as(uid) as client:
        return await client.post(f"/api/leagues/{league_id}/run-it-back")


async def test_run_it_back_copies_members_teams_and_settings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, teams, _ = await finished_league(db)
    league.notes = "Buy-in is $20"
    await db.flush()

    response = await _run_back(client_as, league.id)

    assert response.status_code == 201
    new_id = response.json()["leagueId"]
    new = await db.get(League, new_id)
    assert new is not None
    assert (new.name, new.season, new.notes) == ("Test League", 2026, "Buy-in is $20")
    assert new.previous_league_id == league.id

    members = (
        await db.execute(select(LeagueMember).where(LeagueMember.league_id == new_id))
    ).scalars()
    assert {(m.user_id, m.role) for m in members} == {
        (teams[0].owner_id, "commissioner"),
        (teams[1].owner_id, "member"),
    }
    new_teams = (
        (await db.execute(select(Team).where(Team.league_id == new_id))).scalars().all()
    )
    assert sorted((t.name, t.owner_id) for t in new_teams) == sorted(
        (t.name, t.owner_id) for t in teams
    )
    assert {t.id for t in new_teams}.isdisjoint({t.id for t in teams})

    old_settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == league.id)
        )
    ).scalar_one()
    new_settings = (
        await db.execute(
            select(LeagueSettings).where(LeagueSettings.league_id == new_id)
        )
    ).scalar_one()
    columns = [
        c.name
        for c in LeagueSettings.__table__.columns
        if c.name not in ("id", "league_id")
    ]
    assert [getattr(new_settings, c) for c in columns] == [
        getattr(old_settings, c) for c in columns
    ]


async def test_the_new_league_has_fresh_rosters_and_an_empty_draft(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db)

    new_id = (await _run_back(client_as, league.id)).json()["leagueId"]

    draft = (
        await db.execute(select(Draft).where(Draft.league_id == new_id))
    ).scalar_one()
    assert (draft.status, draft.draft_order_team_ids) == ("unscheduled", [])
    assert draft.rounds == 2
    rostered = (
        (await db.execute(select(TeamPlayer).where(TeamPlayer.league_id == new_id)))
        .scalars()
        .all()
    )
    assert rostered == []


async def test_a_fresh_invite_carries_over_and_the_old_one_is_retired(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db)
    db.add(LeagueInvite(code="OLDCODE1", league_id=league.id))
    await db.flush()

    new_id = (await _run_back(client_as, league.id)).json()["leagueId"]

    invites = (
        (await db.execute(select(LeagueInvite).where(LeagueInvite.league_id == new_id)))
        .scalars()
        .all()
    )
    assert len(invites) == 1 and not invites[0].revoked
    old = (
        await db.execute(select(LeagueInvite).where(LeagueInvite.code == "OLDCODE1"))
    ).scalar_one()
    assert old.revoked


async def test_only_a_commissioner_of_a_finished_league_can_run_it_back_once(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db)
    assert (await _run_back(client_as, league.id, "uid-1")).status_code == 403
    assert (await _run_back(client_as, league.id)).status_code == 201
    again = await _run_back(client_as, league.id)
    assert again.status_code == 409
    assert "already" in again.json()["detail"]


async def test_a_league_still_playing_cannot_be_run_back(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _ = await finished_league(db, finished_through=3)
    response = await _run_back(client_as, league.id)
    assert response.status_code == 409
