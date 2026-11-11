"""Chat polish (#396): reactions, replies, @mentions and editing, through the HTTP seam."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.config import get_settings
from api.db.models import (
    LeagueMember,
    LeagueMessage,
    Notification,
    PushSubscription,
    User,
)
from api.services import mentions, push
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season
from api.tests.postgres.recap_support import finished_league

PARTY = "\N{PARTY POPPER}"
FIRE = "\N{FIRE}"


async def _say(client: AsyncClient, season_id: int, **body: Any) -> dict[str, Any]:
    response = await client.post(f"/api/seasons/{season_id}/messages", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def _items(client: AsyncClient, season_id: int) -> list[dict[str, Any]]:
    response = await client.get(f"/api/seasons/{season_id}/feed")
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


def _react(
    client: AsyncClient, season_id: int, message_id: int, emoji: str, reacted: bool
) -> Any:
    return client.put(
        f"/api/seasons/{season_id}/messages/{message_id}/reactions",
        json={"emoji": emoji, "reacted": reacted},
    )


async def test_reactions_count_who_and_toggle(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=3)
    async with client_as("uid-1") as author:
        message = await _say(author, season.id, body="touchdown")
    async with client_as("uid-2") as fan:
        assert (
            await _react(fan, season.id, message["id"], PARTY, True)
        ).status_code == 204
        # Repeating is harmless.
        assert (
            await _react(fan, season.id, message["id"], PARTY, True)
        ).status_code == 204
        seen_by_fan = (await _items(fan, season.id))[0]
    async with client_as("uid-1") as author:
        await _react(author, season.id, message["id"], PARTY, True)
        await _react(author, season.id, message["id"], FIRE, True)
        seen_by_author = (await _items(author, season.id))[0]
        await _react(author, season.id, message["id"], PARTY, False)
        removed = (await _items(author, season.id))[0]
    assert seen_by_fan["reactions"] == [
        {"emoji": PARTY, "count": 1, "mine": True, "names": ["user2"]}
    ]
    assert seen_by_author["reactions"] == [
        {"emoji": PARTY, "count": 2, "mine": True, "names": ["user2", "user1"]},
        {"emoji": FIRE, "count": 1, "mine": True, "names": ["user1"]},
    ]
    assert [r["emoji"] for r in removed["reactions"]] == [PARTY, FIRE]
    assert removed["reactions"][0]["count"] == 1 and not removed["reactions"][0]["mine"]


@pytest.mark.parametrize("emoji", ["", "a", "hello", " ", "1", "\N{FIRE}x", "x" * 40])
async def test_a_reaction_must_be_an_emoji(
    db: AsyncSession, client_as: ClientFactory, emoji: str
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        message = await _say(member, season.id, body="hi")
        response = await _react(member, season.id, message["id"], emoji, True)
    assert response.status_code == 422


async def test_composed_emoji_are_accepted(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    family = "\N{MAN}‍\N{WOMAN}‍\N{GIRL}"
    flag = (
        "\N{REGIONAL INDICATOR SYMBOL LETTER U}\N{REGIONAL INDICATOR SYMBOL LETTER S}"
    )
    keycap = "1️⃣"
    async with client_as("uid-1") as member:
        message = await _say(member, season.id, body="hi")
        for emoji in (family, flag, keycap):
            response = await _react(member, season.id, message["id"], emoji, True)
            assert response.status_code == 204, emoji
        reactions = (await _items(member, season.id))[0]["reactions"]
    assert {r["emoji"] for r in reactions} == {family, flag, keycap}


async def test_reactions_are_refused_on_deleted_messages_and_to_outsiders(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        message = await _say(member, season.id, body="hi")
        await member.delete(f"/api/seasons/{season.id}/messages/{message['id']}")
        gone = await _react(member, season.id, message["id"], FIRE, True)
        missing = await _react(member, season.id, 999999, FIRE, True)
    async with client_as("uid-nobody") as stranger:
        outsider = await _react(stranger, season.id, message["id"], FIRE, True)
    assert (gone.status_code, missing.status_code, outsider.status_code) == (
        404,
        404,
        403,
    )


async def test_an_archived_season_takes_no_reactions_or_edits(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    archived, _, _ = await finished_league(db)
    async with client_as("uid-1") as member:
        react = await _react(member, archived.id, 1, FIRE, True)
        edit = await member.patch(
            f"/api/seasons/{archived.id}/messages/1", json={"body": "x"}
        )
    assert (react.status_code, edit.status_code) == (409, 409)


async def test_a_message_holds_only_so_many_different_reactions(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        message = await _say(member, season.id, body="hi")
        for offset in range(20):
            emoji = chr(0x1F600 + offset)
            ok = await _react(member, season.id, message["id"], emoji, True)
            assert ok.status_code == 204
        full = await _react(member, season.id, message["id"], chr(0x1F680), True)
        again = await _react(member, season.id, message["id"], chr(0x1F600), True)
    assert full.status_code == 422 and again.status_code == 204


async def test_a_reply_carries_a_quote_that_survives_deleting_the_original(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=3)
    async with client_as("uid-1") as author:
        original = await _say(author, season.id, body="who has the first pick?")
    async with client_as("uid-2") as replier:
        reply = await _say(replier, season.id, body="me", replyToId=original["id"])
        assert reply["replyTo"] == {
            "id": original["id"],
            "authorName": "user1",
            "snippet": "who has the first pick?",
            "deleted": False,
        }
        bad = await replier.post(
            f"/api/seasons/{season.id}/messages",
            json={"body": "x", "replyToId": 999999},
        )
    async with client_as("uid-1") as author:
        await author.delete(f"/api/seasons/{season.id}/messages/{original['id']}")
        quoted = (await _items(author, season.id))[0]
    assert bad.status_code == 422
    assert quoted["body"] == "me"
    assert quoted["replyTo"] == {
        "id": original["id"],
        "authorName": None,
        "snippet": "",
        "deleted": True,
    }


async def test_a_reply_to_a_gif_quotes_it_as_a_gif_and_long_text_is_cut(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        gif = await _say(
            member, season.id, gifUrl="https://media.giphy.com/media/abc/giphy.gif"
        )
        long = await _say(member, season.id, body="word " * 100)
        await _say(member, season.id, body="a", replyToId=gif["id"])
        reply_long = await _say(member, season.id, body="b", replyToId=long["id"])
    assert reply_long["replyTo"]["snippet"].endswith("…")
    assert len(reply_long["replyTo"]["snippet"]) <= 141
    async with client_as("uid-1") as member:
        items = await _items(member, season.id)
    quote = next(i for i in items if i["body"] == "a")["replyTo"]
    assert quote["snippet"] == "GIF"


async def test_mentions_keep_only_tagged_active_members_whose_name_is_in_the_text(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, users, _, _ = await make_season(db, teams=4)
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[3].id)
        .values(left_at=datetime.now(UTC))
    )
    stranger = User(supabase_uid="uid-x", username="outsider", email="x@x.co")
    db.add(stranger)
    await db.flush()
    async with client_as("uid-1") as author:
        message = await _say(
            author,
            season.id,
            body="@user2 and @user3 and @outsider and @USER0 and me @user1",
            mentionedUserIds=[
                users[2].id,
                users[3].id,
                stranger.id,
                users[0].id,
                users[1].id,
                users[2].id,
            ],
        )
        untagged = await _say(
            author,
            season.id,
            body="no names here",
            mentionedUserIds=[users[2].id],
        )
    assert message["mentions"] == [
        {"userId": users[2].id, "name": "user2"},
        {"userId": users[0].id, "name": "user0"},
    ]
    assert untagged["mentions"] == []


async def test_too_many_mentions_are_refused(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as member:
        response = await member.post(
            f"/api/seasons/{season.id}/messages",
            json={"body": "hi", "mentionedUserIds": list(range(1, 12))},
        )
    assert response.status_code == 422


async def test_the_author_edits_for_five_minutes_and_it_reads_edited(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=3)
    async with client_as("uid-1") as author:
        message = await _say(author, season.id, body="teh game")
        assert message["canEdit"] is True and message["editedAt"] is None
        edited = await author.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}",
            json={"body": "  the game "},
        )
        unchanged = await author.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}",
            json={"body": "the game"},
        )
        blank = await author.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}", json={"body": " "}
        )
    assert edited.status_code == 200
    assert edited.json()["body"] == "the game"
    assert edited.json()["editedAt"] is not None
    assert unchanged.status_code == 200
    assert blank.status_code == 422
    async with client_as("uid-2") as other:
        seen = (await _items(other, season.id))[0]
        refused = await other.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}", json={"body": "mine"}
        )
    assert seen["canEdit"] is False and seen["editedAt"] is not None
    assert refused.status_code == 403
    row = await db.get(LeagueMessage, message["id"])
    assert row is not None
    row.created_at = datetime.now(UTC) - timedelta(minutes=6)
    await db.flush()
    async with client_as("uid-1") as author:
        late = await author.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}", json={"body": "late"}
        )
        stale = (await _items(author, season.id))[0]
    assert late.status_code == 409
    assert stale["canEdit"] is False


async def test_a_commissioner_cannot_edit_someone_elses_message(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db)
    async with client_as("uid-1") as author:
        message = await _say(author, season.id, body="mine")
    async with client_as("uid-0") as commissioner:
        refused = await commissioner.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}", json={"body": "x"}
        )
        missing = await commissioner.patch(
            f"/api/seasons/{season.id}/messages/999999", json={"body": "x"}
        )
    assert (refused.status_code, missing.status_code) == (403, 404)


async def test_editing_in_a_new_mention_notifies_only_the_newly_tagged(
    db: AsyncSession,
    client_as: ClientFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spawned: list[tuple[Any, ...]] = []
    monkeypatch.setattr(push, "spawn", lambda fn, *args: spawned.append((fn, *args)))
    season, users, _, _ = await make_season(db, teams=3)
    async with client_as("uid-1") as author:
        message = await _say(
            author, season.id, body="hey @user2", mentionedUserIds=[users[2].id]
        )
        edited = await author.patch(
            f"/api/seasons/{season.id}/messages/{message['id']}",
            json={
                "body": "hey @user2 and @user0",
                "mentionedUserIds": [users[2].id, users[0].id],
            },
        )
    assert [m["userId"] for m in edited.json()["mentions"]] == [
        users[2].id,
        users[0].id,
    ]
    notified = [args for args in spawned if args[0] is mentions.notify_mentioned]
    assert [args[2] for args in notified] == [[users[2].id], [users[0].id]]


@pytest.fixture
def delivered(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, push.PushMessage]]:
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_public_key", "public")
    monkeypatch.setattr(settings, "vapid_private_key", "private")
    monkeypatch.setattr(settings, "vapid_subject", "mailto:owner@example.com")
    sent: list[tuple[str, push.PushMessage]] = []

    def fake(subscription: PushSubscription, message: push.PushMessage) -> int:
        sent.append((subscription.endpoint, message))
        return 201

    monkeypatch.setattr(push, "_deliver", fake)
    return sent


async def _device(db: AsyncSession, user: User) -> None:
    db.add(
        PushSubscription(
            user_id=user.id,
            endpoint=f"https://fcm.googleapis.com/fcm/send/{user.username}",
            p256dh="k",
            auth="a",
        )
    )
    await db.flush()


async def _tagged_message(
    db: AsyncSession, season: Any, author: User, tagged: list[User]
) -> LeagueMessage:
    message = LeagueMessage(
        league_id=season.league_id,
        season_id=season.id,
        author_user_id=author.id,
        author_name="Ann",
        body="secret plan",
        mentioned_user_ids=[u.id for u in tagged],
    )
    db.add(message)
    await db.flush()
    return message


async def test_a_mention_pushes_the_member_through_the_inbox_even_with_chat_muted(
    db: AsyncSession, delivered: list[tuple[str, push.PushMessage]]
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    await _device(db, users[1])
    await _device(db, users[2])
    # Chat is off for everyone by default, and user1 also muted this league.
    await db.execute(
        update(LeagueMember)
        .where(LeagueMember.user_id == users[1].id)
        .values(chat_muted=True)
    )
    await db.execute(
        update(User).where(User.id == users[2].id).values(push_mentions=False)
    )
    message = await _tagged_message(db, season, users[0], [users[1], users[2]])

    await mentions.notify_mentioned(db, message.id, message.mentioned_user_ids)

    [(endpoint, sent)] = delivered
    assert endpoint.endswith("/user1")
    assert sent.title == "Test League"
    assert sent.body == "Ann mentioned you in the chat."
    assert "secret" not in sent.body
    assert sent.url == f"/leagues/{season.league_id}/feed"
    inbox = (
        (await db.execute(select(Notification).order_by(Notification.user_id)))
        .scalars()
        .all()
    )
    # The member who turned mention pushes off still has the inbox entry.
    assert [(n.user_id, n.kind) for n in inbox] == [
        (users[1].id, "mention"),
        (users[2].id, "mention"),
    ]
    assert inbox[0].payload == {"seasonId": season.id, "messageId": message.id}


async def test_the_chat_push_skips_members_the_message_tagged(
    db: AsyncSession, delivered: list[tuple[str, push.PushMessage]]
) -> None:
    season, users, _, _ = await make_season(db, teams=3)
    await db.execute(update(User).values(push_chat=True))
    await _device(db, users[1])
    await _device(db, users[2])
    message = await _tagged_message(db, season, users[0], [users[1]])

    await push.notify_league_message(db, message.id)

    assert [endpoint.rsplit("/", 1)[1] for endpoint, _ in delivered] == ["user2"]


async def test_mention_preference_is_in_the_push_preferences(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    await make_season(db)
    async with client_as("uid-1") as member:
        before = (await member.get("/api/push/preferences")).json()
        after = (
            await member.patch("/api/push/preferences", json={"mentions": False})
        ).json()
    assert before["mentions"] is True and after["mentions"] is False


async def test_the_league_list_counts_unseen_events_and_messages(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    season, _, _, _ = await make_season(db, teams=2)
    async with client_as("uid-1") as author:
        await _say(author, season.id, body="one")
        await _say(author, season.id, body="two")
    async with client_as("uid-0") as reader:
        before = (await reader.get("/api/leagues/user-leagues")).json()[0]
        await reader.post(f"/api/seasons/{season.id}/feed/viewed")
        after = (await reader.get("/api/leagues/user-leagues")).json()[0]
    assert before["newActivityCount"] >= 2 and before["hasNewActivity"] is True
    assert after["newActivityCount"] == 0 and after["hasNewActivity"] is False
