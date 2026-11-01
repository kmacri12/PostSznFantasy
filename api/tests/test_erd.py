import re
from pathlib import Path

from sqlalchemy import Table

import api.db.models  # noqa: F401  (registers every table on Base.metadata)
from api.db.base import Base

ERD = Path(__file__).resolve().parents[2] / "docs" / "erd.md"

# Too wide to draw column by column; the diagram lists a subset of their columns.
SUMMARISED = {"season_settings", "nfl_player_game_stats", "nfl_player_season_stats"}


def _diagram() -> str:
    match = re.search(r"```mermaid\n(.*?)```", ERD.read_text(), re.DOTALL)
    assert match, "docs/erd.md has no mermaid block"
    return match.group(1)


def _entities() -> dict[str, set[str]]:
    entities: dict[str, set[str]] = {}
    for name, body in re.findall(
        r"^    (\w+) \{\n(.*?)^    \}", _diagram(), re.M | re.S
    ):
        entities[name] = {line.split()[1] for line in body.strip().splitlines()}
    return entities


def _relationships() -> set[frozenset[str]]:
    pattern = r"^    (\w+) [|}o]{1,2}--[|{o]{1,2} (\w+) :"
    return {frozenset(pair) for pair in re.findall(pattern, _diagram(), re.M)}


def _tables() -> dict[str, Table]:
    return {table.name: table for table in Base.metadata.tables.values()}


def test_every_table_is_in_the_erd_and_nothing_else() -> None:
    assert set(_entities()) == set(_tables()), (
        "docs/erd.md is out of date: update the diagram in the same PR as the model change"
    )


def test_columns_match_for_fully_drawn_tables() -> None:
    entities = _entities()
    for name, table in _tables().items():
        drawn = entities[name]
        real = {column.name for column in table.columns}
        if name in SUMMARISED:
            assert drawn <= real, (
                f"docs/erd.md lists unknown columns for {name}: {drawn - real}"
            )
        else:
            assert drawn == real, (
                f"docs/erd.md columns for {name} differ: {drawn ^ real}"
            )


def test_every_foreign_key_is_drawn() -> None:
    drawn = _relationships()
    for name, table in _tables().items():
        for fk in table.foreign_keys:
            pair = frozenset({name, fk.column.table.name})
            assert pair in drawn, (
                f"docs/erd.md is missing the relationship {sorted(pair)}"
            )
