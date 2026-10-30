"""A two-team league for activity tests: user0 commissions and owns team 0, user1 owns
team 1 and the roster below, with the lineup layout of test_round_lineups."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import League, NFLGame, NFLPlayer, NFLTeam, Team, TeamPlayer, User
from api.tests.postgres.factories import make_league, make_players

LAYOUT: dict[str, Any] = dict(
    roster_total=5, roster_num_qb=1, roster_num_rb=1, roster_num_wr=0, roster_num_te=0,
    roster_num_flex_wr_rb_te=1, roster_num_k=0, roster_num_dst=0, roster_num_bench=2,
)  # fmt: skip
# Slot indexes for LAYOUT: 0 QB, 1 RB, 2 FLEX, 3 BENCH, 4 BENCH.
QB, RB, FLEX, BENCH_1, BENCH_2 = range(5)

HOUR = timedelta(hours=1)
FUTURE = datetime.now(UTC) + 30 * 24 * HOUR
PAST = datetime.now(UTC) - 30 * 24 * HOUR


def game(
    game_id: str,
    week: int,
    home: int,
    away: int,
    kickoff: datetime,
    score: tuple[int, int] | None = None,
) -> NFLGame:
    return NFLGame(
        id=game_id, season=2025, season_type="post", game_week=week,
        game_status="Completed" if score else "Scheduled",
        game_time_epoch=str(int(kickoff.timestamp())), team_id_home=home,
        team_id_away=away,
        home_pts=score[0] if score else None, away_pts=score[1] if score else None,
    )  # fmt: skip


@dataclass
class ActivityLeague:
    league: League
    commissioner: User
    owner: User
    commissioner_team: Team
    team: Team  # owned by `owner`, holds the roster
    players: list[NFLPlayer]  # [QB, RB, RB, WR(BUF)]

    @property
    def lineup_url(self) -> str:
        return f"/api/teams/{self.team.id}/lineup"

    def move(
        self,
        player: NFLPlayer,
        slot: int | None,
        round_: int = 1,
        **extra: Any,
    ) -> dict[str, Any]:
        return {"round": round_, "playerId": player.id, "slotIndex": slot, **extra}


async def activity_league(
    db: AsyncSession,
    games: list[NFLGame] | None = None,
    *,
    team_count: int = 2,
    roster_on: int = 1,
    draft_status: str = "in_progress",
) -> ActivityLeague:
    """Players 0-2 are on KC (id 1), player 3 on BUF (id 2); DEN (id 3) is the foe."""
    league, users, teams, _ = await make_league(
        db, teams=team_count, draft_status=draft_status, **LAYOUT
    )
    db.add_all(
        NFLTeam(id=i, team_abv=a, is_active=True)
        for i, a in [(1, "KC"), (2, "BUF"), (3, "DEN")]
    )
    await db.flush()
    players = await make_players(
        db, ["QB", "RB", "RB"], nfl_team=await db.get(NFLTeam, 1)
    )
    players += await make_players(
        db, ["WR"], nfl_team=await db.get(NFLTeam, 2), first_id=2000
    )
    db.add_all(
        TeamPlayer(team_id=teams[roster_on].id, league_id=league.id, player_id=p.id)
        for p in players
    )
    db.add_all(games if games is not None else [game("g1", 1, 1, 3, FUTURE)])
    await db.flush()
    return ActivityLeague(
        league, users[0], users[roster_on], teams[0], teams[roster_on], players
    )


def round_of(body: dict[str, Any], round_: int) -> dict[str, Any]:
    return next(r for r in body["lineups"] if r["round"] == round_)


def slot_of(body: dict[str, Any], slot_index: int, round_: int = 1) -> dict[str, Any]:
    return next(s for s in round_of(body, round_)["slots"] if s["index"] == slot_index)
