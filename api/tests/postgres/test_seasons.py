"""Starting a season, and what membership history lets a former member read."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    Draft,
    LeagueInvite,
    LeagueMember,
    Season,
    SeasonSettings,
    Team,
    TeamPlayer,
)
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.recap_support import finished_league

SETTINGS_SKIPPED = ("id", "season_id")


async def _start(client_as: ClientFactory, league_id: int, uid: str = "uid-0"):  # type: ignore[no-untyped-def]
    async with client_as(uid) as client:
        return await client.post(f"/api/leagues/{league_id}/seasons")


async def test_starting_a_season_copies_teams_and_settings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)

    response = await _start(client_as, season.league_id)

    assert response.status_code == 201
    new_id = response.json()["seasonId"]
    assert response.json()["leagueId"] == season.league_id
    new = await db.get(Season, new_id)
    assert new is not None
    assert (new.league_id, new.year) == (season.league_id, 2026)

    new_teams = (
        (await db.execute(select(Team).where(Team.season_id == new_id))).scalars().all()
    )
    assert sorted((t.name, t.owner_id) for t in new_teams) == sorted(
        (t.name, t.owner_id) for t in teams
    )
    assert {t.id for t in new_teams}.isdisjoint({t.id for t in teams})

    async def settings_of(season_id: int) -> SeasonSettings:
        return (
            await db.execute(
                select(SeasonSettings).where(SeasonSettings.season_id == season_id)
            )
        ).scalar_one()

    old = await settings_of(season.id)
    fresh = await settings_of(new_id)
    columns = [
        c.name
        for c in SeasonSettings.__table__.columns
        if c.name not in SETTINGS_SKIPPED
    ]
    assert [getattr(fresh, c) for c in columns] == [getattr(old, c) for c in columns]


async def test_the_new_season_has_fresh_rosters_and_an_empty_draft(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)

    new_id = (await _start(client_as, season.league_id)).json()["seasonId"]

    draft = (
        await db.execute(select(Draft).where(Draft.season_id == new_id))
    ).scalar_one()
    assert (draft.status, draft.draft_order_team_ids) == ("unscheduled", [])
    assert draft.rounds == 2
    rostered = (
        (await db.execute(select(TeamPlayer).where(TeamPlayer.season_id == new_id)))
        .scalars()
        .all()
    )
    assert rostered == []


async def test_the_league_keeps_its_members_and_invite_code(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    db.add(LeagueInvite(code="KEEPCODE", league_id=season.league_id))
    await db.flush()

    await _start(client_as, season.league_id)

    members = (
        await db.execute(
            select(LeagueMember).where(LeagueMember.league_id == season.league_id)
        )
    ).scalars()
    assert {(m.user_id, m.role) for m in members} == {
        (teams[0].owner_id, "commissioner"),
        (teams[1].owner_id, "member"),
    }
    invite = (
        await db.execute(select(LeagueInvite).where(LeagueInvite.code == "KEEPCODE"))
    ).scalar_one()
    assert not invite.revoked


async def test_only_a_commissioner_can_start_a_season_and_only_once(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    assert (await _start(client_as, season.league_id, "uid-1")).status_code == 403
    assert (await _start(client_as, season.league_id)).status_code == 201
    again = await _start(client_as, season.league_id)
    assert again.status_code == 409
    assert "not over" in again.json()["detail"]


async def test_a_season_still_playing_cannot_be_followed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db, finished_through=3)
    response = await _start(client_as, season.league_id)
    assert response.status_code == 409


async def test_the_recap_points_at_the_following_season(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    new_id = (await _start(client_as, season.league_id)).json()["seasonId"]
    async with client_as("uid-1") as member:
        body = (await member.get(f"/api/seasons/{season.id}/recap")).json()
    assert body["nextSeasonId"] == new_id


async def test_the_league_overview_lists_seasons_and_the_current_one(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    async with client_as("uid-0") as commissioner:
        before = (await commissioner.get(f"/api/leagues/{season.league_id}")).json()
        new_id = (await _start(client_as, season.league_id)).json()["seasonId"]
        after = (await commissioner.get(f"/api/leagues/{season.league_id}")).json()
    assert before["canStartSeason"] is True and before["nextYear"] == 2026
    assert [(s["year"], s["finished"]) for s in after["seasons"]] == [
        (2025, True),
        (2026, False),
    ]
    assert after["currentSeasonId"] == new_id
    assert after["canStartSeason"] is False


async def test_a_member_who_left_before_the_next_season_frees_their_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    leaver = teams[1].owner_id
    async with client_as("uid-0") as commissioner:
        removed = await commissioner.delete(
            f"/api/leagues/{season.league_id}/members/{leaver}"
        )
    assert removed.status_code == 200
    new_id = (await _start(client_as, season.league_id)).json()["seasonId"]

    new_teams = (
        (await db.execute(select(Team).where(Team.season_id == new_id))).scalars().all()
    )
    assert sorted(t.owner_id is None for t in new_teams) == [False, True]
    # The finished season still credits them.
    old = await db.get(Team, teams[1].id)
    assert old is not None and old.owner_id == leaver


async def test_a_former_member_reads_only_the_seasons_they_finished(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    leaver = teams[1].owner_id
    async with client_as("uid-0") as commissioner:
        await commissioner.delete(f"/api/leagues/{season.league_id}/members/{leaver}")
    new_id = (await _start(client_as, season.league_id)).json()["seasonId"]

    async with client_as("uid-1") as former:
        finished = await former.get(f"/api/seasons/{season.id}/standings")
        recap = await former.get(f"/api/seasons/{season.id}/recap")
        current = await former.get(f"/api/seasons/{new_id}/standings")
        league = await former.get(f"/api/leagues/{season.league_id}")
        invite = await former.get(f"/api/leagues/{season.league_id}/invite")
        rename = await former.patch(
            f"/api/teams/{teams[1].id}", json={"name": "Still here"}
        )
    assert finished.status_code == 200
    assert recap.status_code == 200
    assert current.status_code == 403
    assert league.status_code == 403
    assert invite.status_code == 403
    assert rename.status_code == 403


async def test_a_former_member_can_rejoin_with_the_invite(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, teams, _ = await finished_league(db)
    leaver = teams[1].owner_id
    async with client_as("uid-0") as commissioner:
        await commissioner.delete(f"/api/leagues/{season.league_id}/members/{leaver}")
        code = (
            await commissioner.post(f"/api/leagues/{season.league_id}/invite", json={})
        ).json()["code"]
    async with client_as("uid-1") as former:
        joined = await former.post(f"/api/invites/{code}/join")
        league = await former.get(f"/api/leagues/{season.league_id}")
    assert joined.status_code == 200
    assert joined.json()["alreadyMember"] is False
    assert league.status_code == 200
    member = (
        await db.execute(
            select(LeagueMember).where(
                LeagueMember.league_id == season.league_id,
                LeagueMember.user_id == leaver,
            )
        )
    ).scalar_one()
    assert member.left_at is None
