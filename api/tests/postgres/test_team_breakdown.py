"""Round-by-round breakdown: counted points per starter, bench points dimmed."""

from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import LeagueSettings, LineupSlot
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.test_live_standings import (
    BENCH_SLOT,
    DIVISIONAL,
    RB_SLOT,
    WILD_CARD,
    World,
    draft,
    game,
    rush,
    world,
)


async def breakdown(
    w: World, team_index: int = 0, uid: str = "uid-0"
) -> dict[str, Any]:
    async with w.client_as(uid) as client:
        response = await client.get(f"/api/teams/{w.teams[team_index].id}/breakdown")
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


async def scored_world(db: AsyncSession, client_as: ClientFactory) -> World:
    """Round 1: RB starts (10 pts), WR is benched (30), TE never placed (5).
    Round 2 (2x): the TE starts and scores 8, the RB sits and scores 20."""
    w = await world(db, client_as)
    me = w.teams[0]
    await db.execute(update(LeagueSettings).values(multiplier_divisional=2))
    rb = await draft(w, me, "RB", "KC", (1, RB_SLOT))
    wr = await draft(w, me, "WR", "KC", (1, BENCH_SLOT))
    te = await draft(w, me, "TE", "KC")
    wc = await game(w, WILD_CARD, "KC", "BUF", status="Completed", score=(20, 10))
    div = await game(w, DIVISIONAL, "KC", "DEN", status="Completed", score=(20, 10))
    await rush(w, wc, rb, 100)
    await rush(w, wc, wr, 300)
    await rush(w, wc, te, 50)
    await rush(w, div, te, 40)
    await rush(w, div, rb, 100)
    db.add_all(
        [
            LineupSlot(team_id=me.id, round=2, player_id=te.id, slot_index=5),
            LineupSlot(team_id=me.id, round=2, player_id=rb.id, slot_index=BENCH_SLOT),
        ]
    )
    await db.flush()
    return w


async def test_each_round_lists_starters_with_counted_points_and_bench_points(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await scored_world(db, client_as)

    body = await breakdown(w)
    wild_card, divisional = body["rounds"][0], body["rounds"][1]

    assert (wild_card["round"], wild_card["multiplier"]) == (1, 1)
    starters = {s["slot"] + str(s["index"]): s for s in wild_card["starters"]}
    assert len(wild_card["starters"]) == 9  # every starter slot, empty ones too
    assert starters["RB1"]["player"]["position"] == "RB"
    assert starters["RB1"]["points"] == 10
    assert starters["QB0"]["player"] is None
    assert starters["QB0"]["points"] == 0
    assert wild_card["counted"] == 10

    bench = {p["position"]: p for p in wild_card["bench"]}
    assert bench["WR"]["points"] == 30
    assert bench["WR"]["slot"] == "BENCH"
    assert bench["TE"]["points"] == 5
    assert bench["TE"]["slot"] is None  # never placed in any slot
    assert wild_card["benchPoints"] == 35

    # The Divisional counts double, for starters and bench alike.
    assert divisional["multiplier"] == 2
    assert divisional["counted"] == 8
    assert [(p["position"], p["points"]) for p in divisional["bench"]] == [("RB", 20)]
    assert divisional["benchPoints"] == 20


async def test_a_bench_player_who_did_not_play_is_not_listed(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    await draft(w, w.teams[0], "WR", "KC", (1, BENCH_SLOT))
    await game(w, WILD_CARD, "KC", "BUF")

    body = await breakdown(w)
    assert body["rounds"][0]["bench"] == []
    assert body["pointsLeftOnBench"] == 0


async def test_the_team_total_of_points_left_on_the_bench_sums_every_round(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await scored_world(db, client_as)

    body = await breakdown(w)

    assert body["pointsLeftOnBench"] == 55  # 35 in the Wild Card + 20 in the Divisional
    assert body["total"] == 18


async def test_the_breakdown_matches_the_standings_exactly(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await scored_world(db, client_as)
    me = w.teams[0]

    row = await w.row(me)
    body = await breakdown(w)

    assert body["total"] == row["total"]
    assert [r["counted"] for r in body["rounds"]] == [
        row["wildCard"],
        row["divisional"],
        row["confChamp"],
        row["superBowl"],
    ]
    for round_ in body["rounds"]:
        assert round_["counted"] == round(
            sum(s["points"] for s in round_["starters"]), 2
        )


async def test_any_league_member_can_read_a_breakdown_but_outsiders_cannot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await scored_world(db, client_as)

    assert (await breakdown(w, team_index=0, uid="uid-1"))["teamId"] == w.teams[0].id

    async with client_as("stranger") as client:
        response = await client.get(f"/api/teams/{w.teams[0].id}/breakdown")
    assert response.status_code in (403, 404)
