"""Season awards, worked out from counted points on every read.

All awards but the bench award use counted points (a starter's points after the round
multiplier). The draft awards compare, per position, the order a player was drafted
with his finish by counted points (docs/product-rules.md); the bench award sums what
rostered players earned off the starting lineup, the same calculation as the
round-by-round breakdown (round_points.py). Ties go to the lower id (the earlier pick
for a draft award), so the result is stable. `owners` maps every rostered player to
his fantasy team, so a drafted player with no points line can still be the biggest
bust.
"""

from collections import defaultdict
from collections.abc import Collection, Iterable, Mapping
from dataclasses import dataclass
from decimal import Decimal

from api.db.models.nfl import NFLPlayer
from api.models.enums import PlayerPosition
from api.services.round_points import PointsLine


@dataclass(frozen=True)
class DraftValue:
    drafted_as: int
    finished_as: int
    places: int
    points: Decimal


@dataclass(frozen=True)
class Award:
    key: str
    title: str
    team_id: int
    player_id: int | None
    round: int | None
    value: Decimal
    # Set for the per-position draft awards, whose value is `draft.places`.
    draft: DraftValue | None = None
    # Overall draft pick number, set with `draft`.
    pick_number: int | None = None


def _best[T](
    items: Iterable[tuple[T, Decimal]], *, lowest: bool = False
) -> tuple[T, Decimal] | None:
    """The item with the highest (or lowest) value; the earliest item wins a tie."""
    best: tuple[T, Decimal] | None = None
    for item, value in items:
        if best is None or (value < best[1] if lowest else value > best[1]):
            best = (item, value)
    return best


def _draft_values(
    totals: Mapping[int, Decimal], pick_numbers: Mapping[int, int]
) -> dict[int, DraftValue]:
    """Draft value of every player in one position's picks.

    Drafted as = his order among those picks; finished as = his rank by counted points
    among them (1 = most, level players share the better rank). Places gained is the
    difference: positive means he outscored his draft slot.
    """
    drafted = sorted(pick_numbers, key=lambda p: (pick_numbers[p], p))
    scores = {p: totals.get(p, Decimal(0)) for p in drafted}
    return {
        p: DraftValue(
            drafted_as=order,
            finished_as=finish,
            places=order - finish,
            points=scores[p],
        )
        for order, p in enumerate(drafted, start=1)
        for finish in [1 + sum(1 for q in drafted if scores[q] > scores[p])]
    }


def compute_awards(
    lines: Collection[PointsLine],
    players: Mapping[int, NFLPlayer],
    pick_numbers: Mapping[int, int],
    champion_team_ids: Collection[int],
    owners: Mapping[int, int],
) -> list[Award]:
    counted = sorted(
        (ln for ln in lines if ln.starter),
        key=lambda ln: (ln.player_id, ln.round),
    )
    team_of = dict(owners)
    totals: dict[int, Decimal] = defaultdict(Decimal)
    for ln in counted:
        totals[ln.player_id] += ln.points
    awards: list[Award] = []

    def player_award(key: str, title: str, player_id: int, value: Decimal) -> None:
        awards.append(Award(key, title, team_of[player_id], player_id, None, value))

    def best_player(key: str, title: str, pool: Iterable[int]) -> None:
        found = _best((p, totals[p]) for p in sorted(pool) if totals[p] > 0)
        if found:
            player_award(key, title, *found)

    best_player("playoff_mvp", "Playoff MVP", totals)
    best_player(
        "champions_mvp",
        "Champion's MVP",
        (p for p in totals if team_of[p] in champion_team_ids),
    )
    for position in PlayerPosition:
        best_player(
            f"top_{position.value.lower()}",
            f"Top {position.value}",
            (
                p
                for p in totals
                if p in players
                and PlayerPosition.from_str(players[p].position) is position
            ),
        )

    game = _best(
        ((ln, ln.points) for ln in counted),
    )
    if game and game[1] > 0:
        ln = game[0]
        awards.append(
            Award(
                "best_game",
                "Best single game",
                ln.team_id,
                ln.player_id,
                ln.round,
                game[1],
            )
        )

    round_totals: dict[tuple[int, int], Decimal] = defaultdict(Decimal)
    bench: dict[int, Decimal] = defaultdict(Decimal)
    for ln in lines:
        if ln.starter:
            round_totals[(ln.team_id, ln.round)] += ln.points
        else:
            bench[ln.team_id] += ln.points
    best_round = _best((k, v) for k, v in sorted(round_totals.items()))
    if best_round and best_round[1] > 0:
        (team_id, round_), value = best_round
        awards.append(Award("best_round", "Best round", team_id, None, round_, value))
    most_bench = _best((t, v) for t, v in sorted(bench.items()))
    if most_bench and most_bench[1] > 0:
        awards.append(
            Award(
                "bench_points",
                "Most points left on the bench",
                most_bench[0],
                None,
                None,
                most_bench[1],
            )
        )

    for position in PlayerPosition:
        picked = {
            p: n
            for p, n in pick_numbers.items()
            if p in team_of
            and p in players
            and PlayerPosition.from_str(players[p].position) is position
        }
        values = _draft_values(totals, picked)
        for key, title, lowest in (
            (
                f"best_value_{position.value.lower()}",
                f"Best {position.value} value",
                False,
            ),
            (f"bust_{position.value.lower()}", f"Biggest {position.value} bust", True),
        ):
            found = _best(
                ((p, Decimal(values[p].places)) for p in values),
                lowest=lowest,
            )
            if found:
                awards.append(
                    Award(
                        key,
                        title,
                        team_of[found[0]],
                        found[0],
                        None,
                        found[1],
                        values[found[0]],
                        picked[found[0]],
                    )
                )
    return awards
