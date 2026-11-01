"""The standings endpoint: ranking with tie reasons, starter progress, players left."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLTeam,
    Team,
    TeamPlayer,
)
from api.services.scheduler import eliminate_losing_teams
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

# Tank01 numbers the postseason weeks 19-22.
WILD_CARD, DIVISIONAL, CONFERENCE, SUPER_BOWL = 19, 20, 21, 22
# Default layout: QB 0, RB 1-2, WR 3-4, TE 5, FLEX 6, K 7, DEF 8, bench 9 and up.
QB_SLOT, RB_SLOT, BENCH_SLOT = 0, 1, 9


@dataclass
class World:
    league_id: int
    teams: list[Team]
    nfl: dict[str, NFLTeam]
    client_as: ClientFactory
    db: AsyncSession

    async def standings(self) -> dict[str, Any]:
        await recompute_standings(self.db, 2025)
        async with self.client_as("uid-0") as client:
            response = await client.get(f"/api/seasons/{self.league_id}/standings")
        assert response.status_code == 200
        body: dict[str, Any] = response.json()
        return body

    async def row(self, team: Team) -> dict[str, Any]:
        body = await self.standings()
        row: dict[str, Any] = next(r for r in body["teams"] if r["teamId"] == team.id)
        return row


async def world(
    db: AsyncSession, client_as: ClientFactory, *, fantasy_teams: int = 2
) -> World:
    season, _, teams, _ = await make_season(
        db, teams=fantasy_teams, draft_status="completed"
    )
    abvs = ["KC", "BUF", "DEN", "MIA", "SEA", "GB"]
    nfl = {
        abv: NFLTeam(id=i + 1, team_abv=abv, is_active=True, in_playoffs=True)
        for i, abv in enumerate(abvs)
    }
    db.add_all(nfl.values())
    await db.flush()
    return World(season.id, teams, nfl, client_as, db)


_player_ids = iter(range(5000, 6000))


async def draft(
    w: World,
    team: Team,
    position: str,
    nfl_abv: str,
    slot: tuple[int, int] | None = None,
) -> NFLPlayer:
    """Put a new player on `team`'s roster; slot = (round, slot index) places them."""
    player = NFLPlayer(
        id=next(_player_ids),
        name=f"{nfl_abv} {position}",
        position=position,
        team_id=w.nfl[nfl_abv].id,
    )
    w.db.add(player)
    await w.db.flush()
    w.db.add(TeamPlayer(team_id=team.id, season_id=w.league_id, player_id=player.id))
    if slot is not None:
        w.db.add(
            LineupSlot(
                team_id=team.id, round=slot[0], player_id=player.id, slot_index=slot[1]
            )
        )
    await w.db.flush()
    return player


async def game(
    w: World,
    week: int,
    home: str,
    away: str,
    *,
    status: str = "Scheduled",
    score: tuple[int, int] | None = None,
) -> NFLGame:
    g = NFLGame(
        id=f"{week}-{home}-{away}",
        season=2025,
        season_type="post",
        game_week=week,
        game_status=status,
        team_id_home=w.nfl[home].id,
        team_id_away=w.nfl[away].id,
        home_pts=score[0] if score else None,
        away_pts=score[1] if score else None,
    )
    w.db.add(g)
    await w.db.flush()
    return g


async def rush(w: World, g: NFLGame, player: NFLPlayer, yards: int) -> None:
    w.db.add(NFLPlayerGameStats(game_id=g.id, player_id=player.id, rushing_yards=yards))
    await w.db.flush()


async def test_players_left_counts_starters_bench_and_unplaced_alive_players(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    mine = w.teams[0]
    await draft(w, mine, "QB", "KC", (1, QB_SLOT))  # starter, eliminated below
    await draft(w, mine, "RB", "KC", (1, BENCH_SLOT))  # bench, eliminated below
    await draft(w, mine, "WR", "BUF", (1, BENCH_SLOT + 1))  # bench, alive
    await draft(w, mine, "TE", "BUF")  # never placed, alive
    await draft(w, mine, "RB", "DEN", (1, RB_SLOT))  # starter, alive
    await draft(w, w.teams[1], "WR", "MIA")
    await game(w, WILD_CARD, "BUF", "KC", status="Completed", score=(27, 20))
    await game(w, WILD_CARD, "DEN", "MIA", status="Completed", score=(30, 10))

    body = await w.standings()
    assert {r["teamId"]: r["playersLeft"] for r in body["teams"]} == {
        mine.id: 5,
        w.teams[1].id: 1,
    }
    assert body["playersLeft"] == 6

    # The elimination service runs and the next recompute drops the losers' players.
    await eliminate_losing_teams(db, 2025)
    body = await w.standings()
    assert {r["teamId"]: r["playersLeft"] for r in body["teams"]} == {
        mine.id: 3,
        w.teams[1].id: 0,
    }
    assert body["playersLeft"] == 3


async def test_progress_counts_follow_games_from_scheduled_to_live_to_final(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    me = w.teams[0]
    await draft(w, me, "QB", "KC", (1, QB_SLOT))
    await draft(w, me, "RB", "DEN", (1, RB_SLOT))
    await draft(w, me, "WR", "MIA", (1, BENCH_SLOT))  # bench: not a starter
    kc = await game(w, WILD_CARD, "KC", "BUF")
    den = await game(w, WILD_CARD, "DEN", "MIA")
    last = await game(w, WILD_CARD, "SEA", "GB")  # nobody's player, keeps round 1 open

    def progress(body: dict[str, Any]) -> tuple[int, int, int, int]:
        p = next(r for r in body["teams"] if r["teamId"] == me.id)["progress"]
        return p["finished"], p["live"], p["toPlay"], p["notPlaying"]

    body = await w.standings()
    # 9 starter slots by default: 2 filled and yet to play, 7 empty.
    assert (body["round"], body["gamesInProgress"]) == (1, 0)
    assert progress(body) == (0, 0, 2, 7)

    kc.game_status = "Live - In Progress"
    await db.flush()
    body = await w.standings()
    assert body["gamesInProgress"] == 1
    assert progress(body) == (0, 1, 1, 7)

    kc.game_status, kc.home_pts, kc.away_pts = "Completed", 24, 17
    den.game_status = "Live - In Progress"
    await db.flush()
    body = await w.standings()
    assert body["gamesInProgress"] == 1
    assert progress(body) == (1, 1, 0, 7)

    den.game_status, den.home_pts, den.away_pts = "Completed", 3, 0
    await db.flush()
    body = await w.standings()
    assert body["gamesInProgress"] == 0
    assert (body["round"], progress(body)) == (1, (2, 0, 0, 7))

    # With the last Wild Card game final, the page moves on to the Divisional, whose
    # lineup nobody has set yet.
    last.game_status, last.home_pts, last.away_pts = "Completed", 9, 6
    await db.flush()
    body = await w.standings()
    assert (body["round"], progress(body)) == (2, (0, 0, 0, 9))


async def test_a_player_eliminated_for_the_round_is_not_playing(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    me = w.teams[0]
    await draft(w, me, "QB", "BUF", (2, QB_SLOT))  # lost in the Wild Card
    await draft(w, me, "RB", "KC", (2, RB_SLOT))
    await game(w, WILD_CARD, "KC", "BUF", status="Completed", score=(27, 20))
    await game(w, DIVISIONAL, "KC", "DEN")

    row = await w.row(me)
    assert row["progress"] == {"finished": 0, "live": 0, "toPlay": 1, "notPlaying": 8}


async def test_equal_totals_are_ordered_by_the_latest_completed_round_with_a_reason(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    ahead, behind = w.teams
    wc = await game(w, WILD_CARD, "KC", "BUF", status="Completed", score=(20, 10))
    div = await game(w, DIVISIONAL, "KC", "DEN", status="Completed", score=(20, 10))
    a = await draft(w, ahead, "RB", "KC")
    b = await draft(w, behind, "RB", "KC")
    for team, player in ((ahead, a), (behind, b)):
        for round_ in (1, 2):
            db.add(
                LineupSlot(
                    team_id=team.id,
                    round=round_,
                    player_id=player.id,
                    slot_index=RB_SLOT,
                )
            )
    # 10 then 20 points for `ahead`, 20 then 10 for `behind`: both total 30.
    await rush(w, wc, a, 100)
    await rush(w, div, a, 200)
    await rush(w, wc, b, 200)
    await rush(w, div, b, 100)

    body = await w.standings()
    top, bottom = body["teams"]
    assert (top["total"], bottom["total"]) == (30, 30)
    assert (top["teamId"], top["rank"]) == (ahead.id, 1)
    assert (bottom["teamId"], bottom["rank"]) == (behind.id, 2)
    assert bottom["tieReason"] is None
    reason = top["tieReason"]
    assert (reason["rule"], reason["round"]) == ("round_score", 2)
    assert (reason["overTeamId"], reason["aheadValue"], reason["behindValue"]) == (
        behind.id,
        20,
        10,
    )
    assert reason["detail"] == "higher Divisional score (20 to 10)"
    assert reason["message"].endswith(reason["detail"])
    assert "Divisional" in reason["message"]
    assert bottom["teamName"] in reason["message"]


async def test_level_rounds_go_to_players_on_the_super_bowl_winner(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    two, one = w.teams
    for round_game in (WILD_CARD, DIVISIONAL, CONFERENCE):
        await game(w, round_game, "KC", "BUF", status="Completed", score=(20, 10))
    await game(w, SUPER_BOWL, "KC", "DEN", status="Completed", score=(31, 28))
    # Nobody scored, so only the Super Bowl winner (KC) can separate them.
    await draft(w, two, "QB", "KC")
    await draft(w, two, "RB", "KC")  # bench players count too
    await draft(w, two, "WR", "DEN")
    await draft(w, one, "QB", "KC")
    await draft(w, one, "WR", "DEN")
    await draft(w, one, "TE", "DEN")

    body = await w.standings()
    top, bottom = body["teams"]
    assert (top["teamId"], top["rank"], bottom["rank"]) == (two.id, 1, 2)
    reason = top["tieReason"]
    assert reason["rule"] == "super_bowl_winner"
    assert reason["round"] is None
    assert (reason["aheadValue"], reason["behindValue"]) == (2, 1)
    assert "Super Bowl" in reason["message"]


async def test_teams_level_on_every_step_share_a_rank_without_a_reason(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    w = await world(db, client_as)
    await game(w, WILD_CARD, "KC", "BUF", status="Completed", score=(20, 10))
    await draft(w, w.teams[0], "QB", "KC")
    await draft(w, w.teams[1], "QB", "KC")

    body = await w.standings()
    assert [r["rank"] for r in body["teams"]] == [1, 1]
    assert [r["tieReason"] for r in body["teams"]] == [None, None]
