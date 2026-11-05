"""The Feed through its HTTP seam: chat posting and deleting, the merged events and
messages stream with its cursor, the draft events and the one unread dot."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import ActivityEvent, LeagueMember, LeagueMessage, NFLTeam, Season
from api.models.activity_models import SettingChange, SettingsChangePayload
from api.services import activity, draft_flow
from api.tests.postgres.activity_support import QB, activity_league
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_players, make_playoff_field, make_season
from api.tests.postgres.recap_support import finished_league

GIF = "https://media.giphy.com/media/abc/giphy.gif"


async def _feed(client: AsyncClient, season_id: int, **params: Any) -> dict[str, Any]:
    response = await client.get(f"/api/seasons/{season_id}/feed", params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def _say(client: AsyncClient, season_id: int, text: str = "hi") -> dict[str, Any]:
    response = await client.post(
        f"/api/seasons/{season_id}/messages", json={"body": text}
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _nav_dot(client: AsyncClient, league_id: int) -> bool:
    leagues = (await client.get("/api/leagues/user-leagues")).json()
    return bool(next(e for e in leagues if e["id"] == league_id)["hasNewActivity"])


async def test_a_member_posts_text_and_a_gif(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        plain = await _say(member, season.id, "  hello  ")
        gif = await member.post(
            f"/api/seasons/{season.id}/messages", json={"gifUrl": GIF}
        )
        feed = await _feed(member, season.id)
    assert plain["body"] == "hello" and plain["authorName"] == "user1"
    assert gif.status_code == 201 and gif.json()["gifUrl"] == GIF
    assert [i["type"] for i in feed["items"]] == ["message", "message"]
    assert feed["canPost"] is True


@pytest.mark.parametrize(
    "payload",
    [
        {"body": ""},
        {"body": "x" * 2001},
        {"gifUrl": "http://media.giphy.com/a.gif"},
        {"gifUrl": "https://evil.example.com/a.gif"},
        {"gifUrl": "https://giphy.com.evil.example.com/a.gif"},
        {"gifUrl": "https://user@giphy.com/a.gif"},
    ],
)
async def test_bad_messages_are_refused(
    db: AsyncSession, client_as: ClientFactory, payload: dict[str, str]
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        response = await member.post(f"/api/seasons/{season.id}/messages", json=payload)
    assert response.status_code == 422


async def test_gif_hosts_include_subdomains_of_the_allowlist(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        ok = await member.post(
            f"/api/seasons/{season.id}/messages",
            json={"gifUrl": "https://media0.giphy.com/x.gif"},
        )
    assert ok.status_code == 201


async def test_authors_and_commissioners_delete_but_other_members_cannot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    async with client_as("uid-1") as author:
        mine = await _say(author, season.id, "mine")
        also = await _say(author, season.id, "also mine")
        own = await author.delete(f"/api/seasons/{season.id}/messages/{mine['id']}")
        again = await author.delete(f"/api/seasons/{season.id}/messages/{mine['id']}")
    async with client_as("uid-2") as other:
        refused = await other.delete(f"/api/seasons/{season.id}/messages/{also['id']}")
        feed_other = await _feed(other, season.id)
    async with client_as("uid-0") as commissioner:
        seen = (await _feed(commissioner, season.id))["items"][0]
        removed = await commissioner.delete(
            f"/api/seasons/{season.id}/messages/{also['id']}"
        )
        missing = await commissioner.delete(f"/api/seasons/{season.id}/messages/999999")
        final = await _feed(commissioner, season.id)
    assert (own.status_code, again.status_code) == (204, 204)
    assert refused.status_code == 403
    assert [i["canDelete"] for i in feed_other["items"]] == [False]
    assert seen["canDelete"] is True
    assert removed.status_code == 204 and missing.status_code == 404
    assert final["items"] == []
    row = await db.get(LeagueMessage, mine["id"])
    assert row is not None and row.deleted_at is not None
    assert row.deleted_by == users[1].id


async def test_a_former_member_cannot_post(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    member = await db.get(LeagueMember, (season.league_id, users[1].id))
    assert member is not None
    member.left_at = datetime.now(UTC)
    await db.flush()
    async with client_as("uid-1") as former:
        response = await former.post(
            f"/api/seasons/{season.id}/messages", json={"body": "hi"}
        )
    assert response.status_code == 403


async def test_a_stranger_cannot_read_or_post(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-nobody") as stranger:
        assert (await stranger.get(f"/api/seasons/{season.id}/feed")).status_code == 403
        posted = await stranger.post(
            f"/api/seasons/{season.id}/messages", json={"body": "hi"}
        )
    assert posted.status_code == 403


async def test_an_archived_season_is_read_only(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        post = await member.post(
            f"/api/seasons/{season.id}/messages", json={"body": "late"}
        )
        feed = await _feed(member, season.id)
    assert post.status_code == 409
    assert feed["canPost"] is False


async def test_only_the_leagues_current_season_takes_messages(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    db.add(Season(league_id=season.league_id, year=season.year + 1))
    await db.flush()
    async with client_as("uid-1") as member:
        response = await member.post(
            f"/api/seasons/{season.id}/messages", json={"body": "old"}
        )
    assert response.status_code == 409


async def test_events_and_messages_merge_newest_first_and_page_by_cursor(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    now = datetime.now(UTC)
    for i in range(3):
        await activity.append(
            db,
            season.id,
            SettingsChangePayload(
                changes=[SettingChange(field=f"f{i}", before=0, after=1)]
            ),
            actor=activity.Actor.of(users[0]),
            at=now - timedelta(minutes=10 - 2 * i),
        )
    for i in range(3):
        db.add(
            LeagueMessage(
                league_id=season.league_id, season_id=season.id,
                author_user_id=users[1].id, author_name="user1", body=f"m{i}",
                created_at=now - timedelta(minutes=9 - 2 * i),
            )
        )  # fmt: skip
    await db.flush()
    async with client_as("uid-1") as member:
        first = await _feed(member, season.id, limit=4)
        second = await _feed(member, season.id, limit=4, before=first["nextBefore"])
        bad = await member.get(f"/api/seasons/{season.id}/feed", params={"before": "x"})
    shown = [
        i["body"] if i["type"] == "message" else i["payload"]["changes"][0]["field"]
        for i in first["items"] + second["items"]
    ]
    assert shown == ["m2", "f2", "m1", "f1", "m0", "f0"]
    assert first["nextBefore"] and second["nextBefore"] is None
    assert bad.status_code == 422


async def test_lineup_moves_are_stored_but_hidden_and_do_not_light_the_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    s = await activity_league(db)
    async with client_as("uid-1") as owner:
        await owner.post(s.lineup_url, json=s.move(s.players[0], QB))
    async with client_as("uid-0") as commissioner:
        feed = await _feed(commissioner, s.season.id)
        dot = await _nav_dot(commissioner, s.season.league_id)
        team_feed = (await commissioner.get(f"/api/teams/{s.team.id}/activity")).json()
    assert feed["items"] == [] and feed["hasNew"] is False and dot is False
    assert [e["kind"] for e in team_feed["events"]] == ["lineup_move"]


async def test_messages_light_the_dot_until_the_feed_is_viewed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    league_id = season.league_id
    async with client_as("uid-1") as author:
        await _say(author, season.id)
        own_dot = await _nav_dot(author, league_id)
    async with client_as("uid-0") as reader:
        # Joined before the message, so it is news.
        member = await db.get(LeagueMember, (league_id, users[0].id))
        assert member is not None
        member.joined_at = datetime.now(UTC) - timedelta(days=1)
        await db.flush()
        before = await _feed(reader, season.id)
        dot = await _nav_dot(reader, league_id)
        viewed = await reader.post(f"/api/seasons/{season.id}/feed/viewed")
        after = await _feed(reader, season.id)
        dot_after = await _nav_dot(reader, league_id)
    assert own_dot is False
    assert (before["hasNew"], dot, before["items"][0]["isNew"]) == (True, True, True)
    assert viewed.status_code == 204
    assert (after["hasNew"], dot_after, after["items"][0]["isNew"]) == (False,) * 3


async def test_a_deleted_message_stops_lighting_the_dot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db)
    member = await db.get(LeagueMember, (season.league_id, users[0].id))
    assert member is not None
    member.joined_at = datetime.now(UTC) - timedelta(days=1)
    await db.flush()
    async with client_as("uid-1") as author:
        message = await _say(author, season.id)
        await author.delete(f"/api/seasons/{season.id}/messages/{message['id']}")
    async with client_as("uid-0") as reader:
        assert (await _feed(reader, season.id))["hasNew"] is False
        assert await _nav_dot(reader, season.league_id) is False


async def test_randomizing_and_reordering_the_draft_post_to_the_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, teams, _ = await make_season(
        db, draft_status="scheduled", ordered=False
    )
    url = f"/api/drafts/{season.id}"
    async with client_as("uid-0") as commissioner:
        for order in ([0, 1], [0, 1], [1, 0]):
            await commissioner.put(
                f"{url}/order", json={"teamIds": [teams[i].id for i in order]}
            )
        await commissioner.post(f"{url}/order/randomize")
        feed = await _feed(commissioner, season.id)
    changed = [i for i in feed["items"] if i["kind"] == "draft_order_changed"]
    randomized = [i for i in feed["items"] if i["kind"] == "draft_order_randomized"]
    assert len(randomized) == 1 and len(randomized[0]["payload"]["order"]) == 2
    assert randomized[0]["payload"]["order"][0]["position"] == 1
    assert randomized[0]["actorName"] == "user0"
    # The repeated identical order is not an event; the swap moves both teams.
    assert len(changed) == 2
    swap = changed[0]["payload"]["moves"]
    assert {(m["teamName"], m["fromPosition"], m["toPosition"]) for m in swap} == {
        ("Team 0", 1, 2),
        ("Team 1", 2, 1),
    }


async def test_starting_and_completing_the_draft_post_to_the_feed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, roster_total=1, draft_status="scheduled")
    await make_playoff_field(db)
    kc = NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True)
    db.add(kc)
    await db.flush()
    await make_players(db, ["QB", "RB"], nfl_team=kc)
    async with client_as("uid-0") as commissioner:
        await commissioner.post(f"/api/drafts/{season.id}/control/start")
        await draft_flow.auto_pick(db, season.id)
        last = await draft_flow.auto_pick(db, season.id)
        feed = await _feed(commissioner, season.id)
    assert last.draft_complete
    by_kind = {i["kind"]: i for i in feed["items"]}
    assert by_kind["draft_started"]["actorName"] == "user0"
    assert by_kind["draft_started"]["payload"] == {"teamCount": 2, "rounds": 1}
    assert by_kind["draft_completed"]["actorName"] is None
    assert by_kind["draft_completed"]["payload"] == {"picks": 2}


async def test_draft_events_light_the_dot_for_other_members(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, draft_status="scheduled")
    member = await db.get(LeagueMember, (season.league_id, users[1].id))
    assert member is not None
    member.joined_at = datetime.now(UTC) - timedelta(days=1)
    await db.flush()
    async with client_as("uid-0") as commissioner:
        await commissioner.post(f"/api/drafts/{season.id}/order/randomize")
        own = await _nav_dot(commissioner, season.league_id)
    async with client_as("uid-1") as other:
        dot = await _nav_dot(other, season.league_id)
        events = (
            await db.scalars(
                select(ActivityEvent).where(ActivityEvent.season_id == season.id)
            )
        ).all()
    assert own is False and dot is True
    assert [e.kind for e in events] == ["draft_order_randomized"]
