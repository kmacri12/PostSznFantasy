"""Epic 13.2: a team QB / team K slot scores every QB / K on that NFL team."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models import (
    LineupSlot,
    NFLGame,
    NFLPlayer,
    NFLPlayerGameStats,
    NFLTeam,
    SeasonStanding,
    TeamPlayer,
)
from api.services.standings import recompute_standings
from api.tests.postgres.conftest import ClientFactory
from api.tests.postgres.factories import make_season

# Slot indexes in the default layout: QB 0, RB 1-2, WR 3-4, TE 5, FLEX 6, K 7, DEF 8.
QB_SLOT, WR_SLOT, K_SLOT, BENCH_SLOT = 0, 3, 7, 9


class Scene:
    """KC with a hurt starting QB, his backup, a throwing WR, two kickers and a RB pair."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def build(self, *, team_qb: bool, team_k: bool) -> "Scene":
        db = self.db
        self.season, _, self.teams, _ = await make_season(
            db, draft_status="completed", team_qb=team_qb, team_k=team_k
        )
        db.add_all(
            [
                NFLTeam(id=1, team_abv="KC", is_active=True, in_playoffs=True),
                NFLTeam(id=2, team_abv="BUF", is_active=True, in_playoffs=True),
            ]
        )
        await db.flush()

        def player(pid: int, name: str, position: str, team_id: int = 1) -> NFLPlayer:
            return NFLPlayer(id=pid, name=name, position=position, team_id=team_id)

        self.starter = player(11, "Hurt Starter", "QB")
        self.backup = player(12, "Backup QB", "QB")
        self.wr = player(13, "Passing WR", "WR")
        self.kicker = player(14, "Hurt Kicker", "PK")
        self.backup_kicker = player(15, "Backup Kicker", "PK")
        self.rb = player(16, "Lead Back", "RB")
        self.backup_rb = player(17, "Backup Back", "RB")
        self.bench_qb = player(18, "Benched QB", "QB")
        self.rival_qb = player(21, "Rival QB", "QB", team_id=2)
        db.add_all(
            [
                self.starter, self.backup, self.wr, self.kicker,
                self.backup_kicker, self.rb, self.backup_rb, self.bench_qb, self.rival_qb,
            ]
        )  # fmt: skip
        db.add_all(
            [
                NFLGame(id="wc", season=2025, season_type="post", game_week=1),
                NFLGame(id="div", season=2025, season_type="post", game_week=20),
            ]
        )
        await db.flush()
        return self

    async def roster(self, team_index: int, *players: NFLPlayer) -> None:
        team = self.teams[team_index]
        self.db.add_all(
            TeamPlayer(team_id=team.id, season_id=self.season.id, player_id=p.id)
            for p in players
        )
        await self.db.flush()

    async def start(
        self, team_index: int, player: NFLPlayer, slot: int, round_: int = 1
    ) -> None:
        self.db.add(
            LineupSlot(
                team_id=self.teams[team_index].id,
                round=round_,
                player_id=player.id,
                slot_index=slot,
            )
        )
        await self.db.flush()

    async def stats(
        self, game_id: str, player: NFLPlayer, **line: int | list[int]
    ) -> None:
        self.db.add(NFLPlayerGameStats(game_id=game_id, player_id=player.id, **line))
        await self.db.flush()

    async def standing(self, team_index: int) -> SeasonStanding:
        await recompute_standings(self.db, 2025)
        row = await self.db.scalar(
            select(SeasonStanding)
            .where(SeasonStanding.team_id == self.teams[team_index].id)
            .execution_options(populate_existing=True)
        )
        assert row is not None
        return row


async def passing_game(scene: Scene) -> None:
    """Wild Card: starter 8 points, backup 10, the WR's pass 5.2, rival 40."""
    await scene.stats("wc", scene.starter, passing_yards=100, passing_touchdowns=1)
    await scene.stats(
        "wc", scene.backup, passing_yards=200, passing_touchdowns=1,
        passing_interceptions=1,
    )  # fmt: skip
    await scene.stats("wc", scene.wr, passing_yards=30, passing_touchdowns=1)
    await scene.stats("wc", scene.rival_qb, passing_yards=1000)


async def test_hurt_starter_and_his_backup_both_count_for_the_slot(
    db: AsyncSession,
) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.start(0, scene.starter, QB_SLOT)
    await passing_game(scene)

    row = await scene.standing(0)

    # 8 + 10; the WR's 5.2 and the rival team's 40 stay out.
    assert row.wild_card == Decimal("18")


async def test_a_wr_who_throws_scores_as_a_wr_and_never_joins_the_qb_unit(
    db: AsyncSession,
) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.roster(1, scene.wr)
    await scene.start(0, scene.starter, QB_SLOT)
    await scene.start(1, scene.wr, WR_SLOT)
    await passing_game(scene)

    qb_team, wr_team = await scene.standing(0), await scene.standing(1)

    assert qb_team.wild_card == Decimal("18")
    assert wr_team.wild_card == Decimal("5.2")


async def test_with_the_setting_off_a_qb_scores_only_himself(db: AsyncSession) -> None:
    scene = await Scene(db).build(team_qb=False, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.start(0, scene.starter, QB_SLOT)
    await passing_game(scene)

    assert (await scene.standing(0)).wild_card == Decimal("8")


async def test_only_the_round_in_question_and_the_starter_slot_count(
    db: AsyncSession,
) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.roster(1, scene.bench_qb)
    await scene.start(0, scene.starter, QB_SLOT, round_=2)
    await scene.start(1, scene.bench_qb, BENCH_SLOT)
    await scene.stats("wc", scene.backup, passing_yards=500)
    await scene.stats("div", scene.backup, passing_yards=100)
    await scene.stats("div", scene.starter, passing_yards=50)

    first = await scene.standing(0)

    assert (first.wild_card, first.divisional) == (Decimal("0"), Decimal("6"))
    # A benched QB scores nothing, unit or not.
    assert (await scene.standing(1)).total == Decimal("0")


async def test_a_hurt_kicker_and_his_backup_both_count(db: AsyncSession) -> None:
    scene = await Scene(db).build(team_qb=False, team_k=True)
    await scene.roster(0, scene.kicker)
    await scene.start(0, scene.kicker, K_SLOT)
    await scene.stats("wc", scene.kicker, kicking_xp_made=2)
    await scene.stats(
        "wc", scene.backup_kicker, kicking_fg_yards_made=[30, 50],
        kicking_fg_made=2, kicking_fg_missed=1,
    )  # fmt: skip

    # 2 for the extra points, then 8 for 80 field-goal yards less 1 for the miss.
    assert (await scene.standing(0)).wild_card == Decimal("9")


async def test_team_qb_and_team_k_are_independent(db: AsyncSession) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=False)
    await scene.roster(0, scene.starter, scene.kicker)
    await scene.start(0, scene.starter, QB_SLOT)
    await scene.start(0, scene.kicker, K_SLOT)
    await passing_game(scene)
    await scene.stats("wc", scene.kicker, kicking_xp_made=2)
    await scene.stats("wc", scene.backup_kicker, kicking_xp_made=3)

    # QB unit 18 plus only the drafted kicker's own 2.
    assert (await scene.standing(0)).wild_card == Decimal("20")


async def test_other_positions_never_combine(db: AsyncSession) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=True)
    await scene.roster(0, scene.rb)
    await scene.start(0, scene.rb, 1)
    await scene.stats("wc", scene.rb, rushing_yards=100)
    await scene.stats("wc", scene.backup_rb, rushing_yards=100)

    assert (await scene.standing(0)).wild_card == Decimal("10")


async def test_switching_the_setting_reflows_standings(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    scene = await Scene(db).build(team_qb=False, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.start(0, scene.starter, QB_SLOT)
    await passing_game(scene)
    assert (await scene.standing(0)).wild_card == Decimal("8")

    async with client_as("uid-0") as commissioner:
        on = await commissioner.patch(
            f"/api/seasons/{scene.season.id}/settings", json={"teamQb": True}
        )
    assert on.status_code == 200
    rows = (
        (
            await db.execute(
                select(SeasonStanding)
                .where(SeasonStanding.team_id == scene.teams[0].id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )
    assert [row.wild_card for row in rows] == [Decimal("18")]


async def test_the_lineup_shows_the_whole_units_points_and_flags_the_slot(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    scene = await Scene(db).build(team_qb=True, team_k=False)
    await scene.roster(0, scene.starter, scene.kicker)
    await scene.start(0, scene.starter, QB_SLOT)
    await passing_game(scene)

    async with client_as("uid-0") as owner:
        team = (await owner.get(f"/api/teams/{scene.teams[0].id}")).json()

    qb = team["lineups"][0]["slots"][QB_SLOT]["player"]
    assert (qb["points"], qb["scoresWholeTeam"]) == (18, True)
    flags = {p["name"]: p["scoresWholeTeam"] for p in team["roster"]}
    assert flags == {"Hurt Starter": True, "Hurt Kicker": False}


async def test_standings_and_breakdown_agree_with_team_units_on_and_off(
    db: AsyncSession, client_as: ClientFactory
) -> None:
    scene = await Scene(db).build(team_qb=False, team_k=False)
    await scene.roster(0, scene.starter)
    await scene.start(0, scene.starter, QB_SLOT)
    await passing_game(scene)
    await scene.standing(0)
    team_id, league_id = scene.teams[0].id, scene.season.id

    async def totals() -> tuple[float, float]:
        async with client_as("uid-0") as owner:
            standings = (await owner.get(f"/api/seasons/{league_id}/standings")).json()
            breakdown = (await owner.get(f"/api/teams/{team_id}/breakdown")).json()
        row = next(r for r in standings["teams"] if r["teamId"] == team_id)
        return row["total"], breakdown["total"]

    assert await totals() == (8, 8)
    async with client_as("uid-0") as commissioner:
        await commissioner.patch(
            f"/api/seasons/{league_id}/settings", json={"teamQb": True}
        )
    assert await totals() == (18, 18)
