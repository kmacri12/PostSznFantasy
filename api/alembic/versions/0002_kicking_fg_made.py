"""kicking_fg_made

Season rows only carry a made-FG count (no per-kick distances), so the count needs
its own column.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-29 13:30:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("nfl_player_season_stats", "nfl_player_game_stats")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "kicking_fg_made",
                sa.SmallInteger(),
                nullable=False,
                server_default="0",
            ),
            schema="nfl",
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "kicking_fg_made", schema="nfl")
