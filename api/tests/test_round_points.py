from decimal import Decimal

from api.db.models.league import SeasonSettings
from api.db.models.nfl import NFLPlayer, NFLPlayerGameStats
from api.models.league_models import PostseasonSettings, ScoringSettings
from api.services.round_points import PointsLine, point_lines, sum_points

QB, RB, WR = 1, 2, 3
TEAM, OTHER = 10, 11
WILD_CARD, DIVISIONAL = 19, 20  # Tank01 numbers the postseason weeks 19-22
STARTER_SLOTS = frozenset({0, 1})  # slot 2 and up is the bench


def league_settings(**overrides: float) -> SeasonSettings:
    values = {
        **ScoringSettings().model_dump(by_alias=False),
        **PostseasonSettings().model_dump(by_alias=False, mode="json"),
        **overrides,
    }
    return SeasonSettings(**values)


def players() -> dict[int, NFLPlayer]:
    return {
        QB: NFLPlayer(id=QB, name="QB", position="QB"),
        RB: NFLPlayer(id=RB, name="RB", position="RB"),
        WR: NFLPlayer(id=WR, name="WR", position="WR"),
    }


def passing(yards: int, tds: int = 0) -> dict[str, int]:
    return {"passing_yards": yards, "passing_touchdowns": tds}


def rushing(yards: int) -> dict[str, int]:
    return {"rushing_yards": yards}


def played(
    player_id: int, week: int, **stat: int
) -> tuple[int, tuple[NFLPlayerGameStats, int]]:
    row = NFLPlayerGameStats(
        game_id=f"g{week}-{player_id}", player_id=player_id, **stat
    )
    return player_id, (row, week)


def stats_of(*entries: tuple[int, tuple[NFLPlayerGameStats, int]]):  # type: ignore[no-untyped-def]
    by_player: dict[int, list[tuple[NFLPlayerGameStats, int]]] = {}
    for player_id, entry in entries:
        by_player.setdefault(player_id, []).append(entry)
    return by_player


def lines_for(
    placements: dict[tuple[int, int], dict[int, int]],
    stats: dict[int, list[tuple[NFLPlayerGameStats, int]]],
    *,
    settings: SeasonSettings | None = None,
    roster: tuple[int, ...] = (QB, RB, WR),
) -> list[PointsLine]:
    return point_lines(
        settings or league_settings(),
        STARTER_SLOTS,
        {TEAM: roster},
        placements,
        players(),
        stats,
    )


def line(lines: list[PointsLine], round_: int, player_id: int) -> PointsLine:
    (match,) = [ln for ln in lines if ln.round == round_ and ln.player_id == player_id]
    return match


def test_a_starter_earns_counted_points_in_the_round_of_the_game() -> None:
    lines = lines_for(
        {(TEAM, 1): {0: QB}},
        stats_of(
            played(QB, WILD_CARD, **passing(300, 2)),
            played(QB, DIVISIONAL, **passing(100)),
        ),
    )
    wild_card = line(lines, 1, QB)
    assert (wild_card.starter, wild_card.slot_index, wild_card.played) == (
        True,
        0,
        True,
    )
    assert wild_card.points == Decimal("20.00")  # 300 yds * 0.04 + 2 TD * 4
    # Not in the Divisional lineup, so those 4 points are bench points.
    divisional = line(lines, 2, QB)
    assert (divisional.starter, divisional.points) == (False, Decimal("4.00"))


def test_a_benched_player_earns_bench_points_not_counted_ones() -> None:
    lines = lines_for(
        {(TEAM, 1): {0: QB, 2: RB}},
        stats_of(
            played(QB, WILD_CARD, **passing(100)), played(RB, WILD_CARD, **rushing(80))
        ),
    )
    bench = line(lines, 1, RB)
    assert (bench.starter, bench.slot_index, bench.points) == (
        False,
        2,
        Decimal("8.00"),
    )
    assert sum_points(lines, counted=True) == {(TEAM, 1): Decimal("4.00")}
    assert sum_points(lines, counted=False) == {(TEAM, 1): Decimal("8.00")}


def test_a_player_never_placed_in_a_slot_counts_as_bench() -> None:
    lines = lines_for({}, stats_of(played(WR, WILD_CARD, **rushing(50))))
    unplaced = line(lines, 1, WR)
    assert (unplaced.starter, unplaced.slot_index, unplaced.points) == (
        False,
        None,
        Decimal("5.00"),
    )
    assert sum_points(lines, counted=True) == {}


def test_a_starter_who_has_not_played_is_listed_at_zero() -> None:
    lines = lines_for({(TEAM, 1): {1: RB}}, {})
    assert lines == [
        PointsLine(
            TEAM, 1, RB, slot_index=1, starter=True, played=False, points=Decimal(0)
        )
    ]


def test_a_roster_player_who_did_not_play_and_is_not_a_starter_has_no_line() -> None:
    lines = lines_for({(TEAM, 1): {2: WR}}, {})
    assert lines == []


def test_the_round_multiplier_applies_to_counted_and_bench_points() -> None:
    lines = lines_for(
        {(TEAM, 2): {0: QB}},
        stats_of(
            played(QB, DIVISIONAL, **passing(100)),
            played(RB, DIVISIONAL, **rushing(50)),
        ),
        settings=league_settings(multiplier_divisional=2),
    )
    assert line(lines, 2, QB).points == Decimal("8.00")
    assert line(lines, 2, RB).points == Decimal("10.00")


def test_each_player_is_rounded_to_cents_so_the_lines_add_up_to_the_round() -> None:
    # 0.1 per yard * 7 yds * 1.25x = 0.875 each; the two lines show 0.88 + 0.88.
    lines = lines_for(
        {(TEAM, 1): {0: RB, 1: WR}},
        stats_of(
            played(RB, WILD_CARD, **rushing(7)), played(WR, WILD_CARD, **rushing(7))
        ),
        settings=league_settings(multiplier_wild_card=1.25),
    )
    assert [ln.points for ln in lines] == [Decimal("0.88"), Decimal("0.88")]
    assert sum_points(lines, counted=True) == {(TEAM, 1): Decimal("1.76")}


def test_players_of_another_team_stay_separate() -> None:
    both = point_lines(
        league_settings(),
        STARTER_SLOTS,
        {TEAM: (QB,), OTHER: (RB,)},
        {(TEAM, 1): {0: QB}, (OTHER, 1): {0: RB}},
        players(),
        stats_of(
            played(QB, WILD_CARD, **passing(100)), played(RB, WILD_CARD, **rushing(10))
        ),
    )
    assert sum_points(both, counted=True) == {
        (TEAM, 1): Decimal("4.00"),
        (OTHER, 1): Decimal("1.00"),
    }
