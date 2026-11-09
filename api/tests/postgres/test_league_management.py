from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    DraftPick,
    LeagueInvite,
    LeagueMember,
    NFLGame,
    NFLTeam,
    Season,
    SeasonSettings,
    Team,
    User,
)
from api.services import draft_flow
from api.services.draft_picks import make_pick
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_season


async def test_overview_lists_members_and_roles(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-1") as member:
        body = (await member.get(f"/api/leagues/{season.league_id}")).json()
    assert body["currentSeasonId"] == season.id
    assert [s["year"] for s in body["seasons"]] == [2025]
    assert body["myRole"] == "member"
    assert [m["role"] for m in body["members"]] == ["commissioner", "member"]
    async with client_as("uid-1") as member:
        overview = (await member.get(f"/api/seasons/{season.id}")).json()
    assert overview["draftStatus"] == "scheduled"
    assert overview["year"] == 2025


async def test_league_can_never_lose_its_last_commissioner(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    base = f"/api/leagues/{season.league_id}/members"
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
    season, users, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        role = await member.patch(
            f"/api/leagues/{season.league_id}/members/{users[1].id}",
            json={"role": "commissioner"},
        )
        rename = await member.patch(
            f"/api/leagues/{season.league_id}", json={"name": "x"}
        )
        invite = await member.post(f"/api/leagues/{season.league_id}/invite", json={})
    assert {role.status_code, rename.status_code, invite.status_code} == {403}


async def test_removing_a_member_frees_their_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, teams, _ = await make_season(db)
    async with client_as("uid-0") as commissioner:
        response = await commissioner.delete(
            f"/api/leagues/{season.league_id}/members/{users[1].id}"
        )
    assert response.status_code == 200
    await db.refresh(teams[1])
    assert teams[1].owner_id is None
    member = await db.get(LeagueMember, (season.league_id, users[1].id))
    assert member is not None and member.left_at is not None


async def test_removing_a_drafter_mid_draft_keeps_picks_and_autopicks_for_the_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, teams, draft = await make_season(db, roster_total=3)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    players = await make_players(db, ["QB", "RB", "WR", "TE"], nfl_team=kc)
    await make_pick(db, season.id, users[0], players[0].id)
    await make_pick(db, season.id, users[1], players[1].id)  # snake: B picks again next

    async with client_as("uid-0") as commissioner:
        response = await commissioner.delete(
            f"/api/leagues/{season.league_id}/members/{users[1].id}"
        )
    assert response.status_code == 200
    await db.refresh(teams[1])
    assert teams[1].owner_id is None

    covered = await draft_flow.auto_pick(db, season.id)
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
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        renamed = await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"name": "Renamed"}
        )
        grow = await commissioner.patch(
            f"/api/seasons/{season.id}", json={"numberTeams": 4}
        )
        shrink_claimed = await commissioner.patch(
            f"/api/seasons/{season.id}", json={"numberTeams": 1}
        )
    assert renamed.json()["name"] == "Renamed"
    assert grow.status_code == 200
    assert grow.json()["numberTeams"] == 4
    assert grow.json()["openSpots"] == 2
    assert shrink_claimed.status_code == 422  # below the allowed minimum


async def test_team_count_is_locked_after_draft_start(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)  # in progress
    async with client_as("uid-0") as commissioner:
        response = await commissioner.patch(
            f"/api/seasons/{season.id}", json={"numberTeams": 4}
        )
    assert response.status_code == 409


async def _join_setup(db: AsyncSession, **kwargs: object) -> tuple[int, str]:
    """A league with one open team and a user to join; returns (league id, uid)."""
    season, _, _, _ = await make_season(db, teams=2, **kwargs)  # type: ignore[arg-type]
    db.add(Team(name="Open", season_id=season.id))
    db.add(User(supabase_uid="newbie", username="newbie", email="n@x.co"))
    await db.flush()
    return season.league_id, "newbie"


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


async def test_invites_last_until_the_draft_cutoff_within_sixty_days_at_most(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    year = 2025
    league_id, _ = await _join_setup(db, draft_status="scheduled", year=year)
    async with client_as("uid-0") as commissioner:
        no_cutoff = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()

        async def invite_with_kickoff_in(delta: timedelta) -> datetime:
            db.add(
                NFLGame(
                    id=f"cutoff-{delta.days}",
                    season=year,
                    game_week=19,
                    game_time_epoch=str((datetime.now(UTC) + delta).timestamp()),
                )
            )
            await db.flush()
            created = (
                await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
            ).json()
            return datetime.fromisoformat(created["expiresAt"])

        within = await invite_with_kickoff_in(timedelta(days=30))
        explicit = (
            await commissioner.post(
                f"/api/leagues/{league_id}/invite",
                json={"expiresAt": "2030-01-01T00:00:00Z"},
            )
        ).json()

    now = datetime.now(UTC)
    # No kickoff known yet: the 60 day cap.
    assert (
        timedelta(days=59, hours=23)
        < datetime.fromisoformat(no_cutoff["expiresAt"]) - now
        <= timedelta(days=60)
    )
    # A kickoff 30 days out is the cutoff.
    assert timedelta(days=29, hours=23) < within - now <= timedelta(days=30)
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
        select(SeasonSettings)
        .join(Season, Season.id == SeasonSettings.season_id)
        .where(Season.league_id == league_id)
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
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    db.add(User(supabase_uid="late", username="late", email="l@x.co"))
    await db.flush()
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{season.league_id}/invite", json={})
        ).json()["code"]
    async with client_as("late") as late:
        response = await late.post(f"/api/invites/{code}/join")
    assert response.status_code == 409
    assert "full" in response.json()["detail"]


async def test_public_config_exposes_the_season(client_as: ClientFactory) -> None:
    async with client_as("x") as client:
        body = (await client.get("/api/config")).json()
    assert isinstance(body["season"], int)


async def test_commissioner_edits_notes_and_members_read_them(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-1") as member:
        assert (await member.get(f"/api/leagues/{season.league_id}")).json()[
            "notes"
        ] == ""
    async with client_as("uid-0") as commissioner:
        saved = await commissioner.patch(
            f"/api/leagues/{season.league_id}",
            json={"notes": "Buy-in $20\nWinner takes all"},
        )
        renamed = await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"name": "Renamed"}
        )
    assert saved.status_code == 200
    assert saved.json()["notes"] == "Buy-in $20\nWinner takes all"
    assert renamed.json()["notes"] == "Buy-in $20\nWinner takes all"
    async with client_as("uid-1") as member:
        body = (await member.get(f"/api/leagues/{season.league_id}")).json()
    assert body["notes"] == "Buy-in $20\nWinner takes all"


async def test_members_cannot_edit_notes(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-1") as member:
        response = await member.patch(
            f"/api/leagues/{season.league_id}", json={"notes": "mine now"}
        )
    assert response.status_code == 403


async def test_notes_can_be_cleared_and_are_length_limited(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"notes": "x"}
        )
        cleared = await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"notes": ""}
        )
        too_long = await commissioner.patch(
            f"/api/leagues/{season.league_id}", json={"notes": "x" * 5001}
        )
    assert cleared.json()["notes"] == ""
    assert too_long.status_code == 422


async def _invite_code(client: AsyncClient, league_id: int) -> str:
    created = await client.post(f"/api/leagues/{league_id}/invite", json={})
    code: str = created.json()["code"]
    return code


async def test_join_claims_the_lowest_numbered_open_team(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=2, draft_status="scheduled")
    first = Team(name="Open 1", season_id=season.id)
    second = Team(name="Open 2", season_id=season.id)
    db.add_all([first, second])
    db.add(User(supabase_uid="newbie", username="newbie", email="n@x.co"))
    await db.flush()
    async with client_as("uid-0") as commissioner:
        code = await _invite_code(commissioner, season.league_id)
    async with client_as("newbie") as newbie:
        joined = (await newbie.post(f"/api/invites/{code}/join")).json()
    assert joined["teamId"] == first.id


async def test_full_league_answers_league_full_until_the_team_count_grows(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, draft_status="scheduled")
    db.add(User(supabase_uid="late", username="late", email="l@x.co"))
    await db.flush()
    async with client_as("uid-0") as commissioner:
        code = await _invite_code(commissioner, season.league_id)
    async with client_as("late") as late:
        refused = await late.post(f"/api/invites/{code}/join")
        preview = (await late.get(f"/api/invites/{code}")).json()
    assert refused.status_code == 409
    assert refused.json()["code"] == "league_full"
    assert refused.json()["detail"] == "This league is full"
    assert preview["full"] is True
    assert preview["openSpots"] == 0
    assert preview["joinable"] is False

    async with client_as("uid-0") as commissioner:
        grown = await commissioner.patch(
            f"/api/seasons/{season.id}", json={"numberTeams": 3}
        )
    assert grown.status_code == 200
    async with client_as("late") as late:
        preview = (await late.get(f"/api/invites/{code}")).json()
        joined = await late.post(f"/api/invites/{code}/join")
    assert preview["full"] is False
    assert joined.status_code == 200
    assert joined.json()["teamId"] is not None


async def test_rejoining_after_leaving_takes_one_team_only(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        code = await _invite_code(commissioner, league_id)
    async with client_as("newbie") as newbie:
        first = (await newbie.post(f"/api/invites/{code}/join")).json()
    newbie_user = await db.scalar(select(User).where(User.supabase_uid == "newbie"))
    assert newbie_user is not None
    async with client_as("newbie") as newbie:
        left = await newbie.delete(f"/api/leagues/{league_id}/members/{newbie_user.id}")
    assert left.status_code == 204
    async with client_as("newbie") as newbie:
        second = (await newbie.post(f"/api/invites/{code}/join")).json()
    assert second["alreadyMember"] is False
    assert second["teamId"] == first["teamId"]
    owned = (
        await db.execute(select(Team).where(Team.owner_id == newbie_user.id))
    ).scalars()
    assert len(list(owned)) == 1


async def test_preview_lists_member_names_and_no_emails(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    league_id, _ = await _join_setup(db, draft_status="scheduled")
    async with client_as("uid-0") as commissioner:
        code = await _invite_code(commissioner, league_id)
    async with client_as("newbie") as newbie:
        response = await newbie.get(f"/api/invites/{code}")
    preview = response.json()
    assert preview["members"] == [
        {"displayName": "user0", "isCommissioner": True},
        {"displayName": "user1", "isCommissioner": False},
    ]
    assert preview["openSpots"] == 1
    assert preview["full"] is False
    assert "@" not in response.text


async def test_a_member_can_leave_but_not_remove_others(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="scheduled")
    base = f"/api/leagues/{season.league_id}/members"
    async with client_as("uid-1") as member:
        other = await member.delete(f"{base}/{users[0].id}")
        left = await member.delete(f"{base}/{users[1].id}")
        after = await member.get(f"/api/leagues/{season.league_id}")
    assert other.status_code == 403
    assert left.status_code == 204
    assert after.status_code == 403
    row = await db.get(LeagueMember, (season.league_id, users[1].id))
    await db.refresh(row)
    assert row is not None and row.left_at is not None


async def test_leaving_keeps_the_invite_link(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="scheduled")
    league_id = season.league_id
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
    async with client_as("uid-1") as member:
        await member.delete(f"/api/leagues/{league_id}/members/{users[1].id}")
    async with client_as("uid-0") as commissioner:
        assert (await commissioner.get(f"/api/leagues/{league_id}/invite")).json()[
            "code"
        ] == code


async def test_removing_a_member_revokes_the_invite_link(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="scheduled")
    league_id = season.league_id
    async with client_as("uid-0") as commissioner:
        code = (
            await commissioner.post(f"/api/leagues/{league_id}/invite", json={})
        ).json()["code"]
        removed = await commissioner.delete(
            f"/api/leagues/{league_id}/members/{users[1].id}"
        )
        assert removed.status_code == 200
        assert (
            await commissioner.get(f"/api/leagues/{league_id}/invite")
        ).json() is None
    async with client_as("uid-1") as removed_user:
        preview = await removed_user.get(f"/api/invites/{code}")
        join = await removed_user.post(f"/api/invites/{code}/join")
    assert preview.json()["joinable"] is False
    assert join.status_code >= 400
