from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    DraftPick,
    LeagueInvite,
    LeagueMember,
    LeagueSettings,
    NFLTeam,
    Team,
    User,
)
from api.services import draft_flow
from api.services.draft_picks import make_pick
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_league, make_players


async def test_overview_lists_members_and_roles(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db, draft_status="scheduled")
    async with client_as("uid-1") as member:
        body = (await member.get(f"/api/leagues/{league.id}")).json()
    assert body["season"] == 2025
    assert body["myRole"] == "member"
    assert body["draftStatus"] == "scheduled"
    assert [m["role"] for m in body["members"]] == ["commissioner", "member"]


async def test_league_can_never_lose_its_last_commissioner(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, users, _, _ = await make_league(db)
    base = f"/api/leagues/{league.id}/members"
    async with client_as("uid-0") as commissioner:
        demote = await commissioner.patch(
            f"{base}/{users[0].id}", json={"role": "member"}
        )
        remove = await commissioner.delete(f"{base}/{users[0].id}")
        promote = await commissioner.patch(
            f"{base}/{users[1].id}", json={"role": "commissioner"}
        )
        demote_self = await commissioner.patch(
            f"{base}/{users[0].id}", json={"role": "member"}
        )
    assert demote.status_code == 409
    assert remove.status_code == 409
    assert promote.status_code == 200
    assert demote_self.status_code == 200


async def test_members_cannot_manage_members_or_the_league(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, users, _, _ = await make_league(db)
    async with client_as("uid-1") as member:
        role = await member.patch(
            f"/api/leagues/{league.id}/members/{users[1].id}",
            json={"role": "commissioner"},
        )
        rename = await member.patch(f"/api/leagues/{league.id}", json={"name": "x"})
        invite = await member.post(f"/api/leagues/{league.id}/invite", json={})
    assert {role.status_code, rename.status_code, invite.status_code} == {403}


async def test_removing_a_member_frees_their_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, users, teams, _ = await make_league(db)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.delete(
            f"/api/leagues/{league.id}/members/{users[1].id}"
        )
    assert response.status_code == 200
    await db.refresh(teams[1])
    assert teams[1].owner_id is None
    assert await db.get(LeagueMember, (league.id, users[1].id)) is None


async def test_removing_a_drafter_mid_draft_keeps_picks_and_autopicks_for_the_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, users, teams, draft = await make_league(db, roster_total=3)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB", "WR", "TE"], nfl_team=kc)
    await make_pick(db, league.id, users[0], players[0].id)
    await make_pick(db, league.id, users[1], players[1].id)  # snake: B picks again next

    async with client_as("uid-0") as commissioner:
        response = await commissioner.delete(
            f"/api/leagues/{league.id}/members/{users[1].id}"
        )
    assert response.status_code == 200
    await db.refresh(teams[1])
    assert teams[1].owner_id is None

    covered = await draft_flow.auto_pick(db, league.id)
    assert covered.pick.team_id == teams[1].id
    assert covered.pick.autopick is True
    kept = (
        (await db.execute(select(DraftPick).where(DraftPick.draft_id == draft.id)))
        .scalars()
        .all()
    )
    assert sorted((p.team_id, p.autopick) for p in kept) == sorted(
        [(teams[0].id, False), (teams[1].id, False), (teams[1].id, True)]
    )


async def test_commissioner_renames_league_and_resizes_before_draft(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        grow = await commissioner.patch(
            f"/api/leagues/{league.id}", json={"name": "Renamed", "numberTeams": 4}
        )
        shrink_claimed = await commissioner.patch(
            f"/api/leagues/{league.id}", json={"numberTeams": 1}
        )
    assert grow.status_code == 200
    assert grow.json()["name"] == "Renamed"
    assert grow.json()["numberTeams"] == 4
    assert grow.json()["openSpots"] == 2
    assert shrink_claimed.status_code == 422  # below the allowed minimum


async def test_team_count_is_locked_after_draft_start(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db)  # in progress
    async with client_as("uid-0") as commissioner:
        response = await commissioner.patch(
            f"/api/leagues/{league.id}", json={"numberTeams": 4}
        )
    assert response.status_code == 409


async def _join_setup(db: AsyncSession, **kwargs: object) -> tuple[int, str]:
    league, _, _, _ = await make_league(db, teams=2, **kwargs)  # type: ignore[arg-type]
    db.add(Team(name="Open", league_id=league.id))
    db.add(User(supabase_uid="newbie", username="newbie", email="n@x.co"))
    await db.flush()
    return league.id, "newbie"


async def test_invite_link_flow(db: AsyncSession, client_as: ClientFactory) -> None:
    league_id, _ = await _join_setup(db, draft_status="scheduled")

    async with client_as("uid-0") as commissioner:
        created = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()
        current = (await commissioner.get(f"/api/leagues/{league_id}/invite")).json()
    code = created["code"]
    assert current["code"] == code

    async with client_as("newbie") as newbie:
        preview = (await newbie.get(f"/api/invites/{code.lower()}")).json()
        joined = await newbie.post(f"/api/invites/{code}/join")
        again = await newbie.post(f"/api/invites/{code}/join")
    assert preview["joinable"] is True
    assert preview["openSpots"] == 1
    assert joined.status_code == 200
    assert joined.json()["alreadyMember"] is False
    assert again.json()["alreadyMember"] is True

    invite = (
        await db.execute(select(LeagueInvite).where(LeagueInvite.code == code))
    ).scalar_one()
    assert invite.uses == 1  # the replay did not spend another use


async def test_invites_expire_after_seven_days_unless_told_otherwise(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        default = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()
        explicit = (
            await commissioner.post(
                f"/api/leagues/{league_id}/invite",
                json={"expiresAt": "2030-01-01T00:00:00Z"},
            )
        ).json()

    remaining = datetime.fromisoformat(default["expiresAt"]) - datetime.now(UTC)
    assert timedelta(days=6, hours=23) < remaining <= timedelta(days=7)
    assert explicit["expiresAt"].startswith("2030-01-01")


async def test_joining_after_the_draft_starts_is_allowed_by_default(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db, draft_status="in_progress")
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
    async with client_as("newbie") as newbie:
        preview = (await newbie.get(f"/api/invites/{code}")).json()
    assert preview["joinable"] is True


async def test_regenerating_retires_the_old_code(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        old = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
        new = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
    assert old != new
    async with client_as("newbie") as newbie:
        assert (await newbie.post(f"/api/invites/{old}/join")).status_code == 409
        assert (await newbie.post(f"/api/invites/{new}/join")).status_code == 200


async def test_revoked_full_and_started_invites_are_refused(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db)  # draft already in progress
    settings = await db.scalar(
        select(LeagueSettings).where(LeagueSettings.league_id == league_id)
    )
    assert settings is not None
    settings.allow_join_after_draft_start = False  # commissioner opted out
    await db.flush()
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
    async with client_as("newbie") as newbie:
        started = await newbie.post(f"/api/invites/{code}/join")
        preview = (await newbie.get(f"/api/invites/{code}")).json()
    assert started.status_code == 409
    assert preview["joinable"] is False
    assert "started" in preview["reason"]

    async with client_as("uid-0") as commissioner:
        assert (
            await commissioner.delete(f"/api/leagues/{league_id}/invite")
        ).status_code == 204
    async with client_as("newbie") as newbie:
        revoked = await newbie.get(f"/api/invites/{code}")
    assert revoked.json()["reason"] == "This invite has been revoked"


async def test_unknown_invite_is_404(client_as: ClientFactory) -> None:
    async with client_as("anyone") as client:
        assert (await client.get("/api/invites/NOPE1234")).status_code == 404


async def test_full_league_refuses_joins(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league, _, _, _ = await make_league(db, draft_status="scheduled")
    db.add(User(supabase_uid="late", username="late", email="l@x.co"))
    await db.flush()
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league.id}/invite", json={})
        ).json()["code"]
    async with client_as("late") as late:
        response = await late.post(f"/api/invites/{code}/join")
    assert response.status_code == 409
    assert "full" in response.json()["detail"]


async def test_public_config_exposes_the_season(client_as: ClientFactory) -> None:
    async with client_as("x") as client:
        body = (await client.get("/api/config")).json()
    assert isinstance(body["season"], int)
