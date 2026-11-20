"""return TD scoring

Kick and punt return TDs get their own DST settings (6 by default, what the DST TD
setting gave them before) and their own stat columns. Stored DST TDs keep the return
TDs until the next box-score ingest splits them out.

Revision ID: 0035_return_td_scoring
Revises: 0034_kickers_stored_as_k
Create Date: 2026-11-20 10:30:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0035_return_td_scoring"
down_revision: str | Sequence[str] | None = "0034_kickers_stored_as_k"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SETTINGS = ("scoring_dst_kick_return_td", "scoring_dst_punt_return_td")
STATS = ("dst_kick_return_td", "dst_punt_return_td")


def upgrade() -> None:
    for column in SETTINGS:
        op.add_column(
            "season_settings",
            sa.Column(
                column,
                sa.Numeric(precision=6, scale=2),
                nullable=False,
                server_default=sa.text("6"),
            ),
            schema="fantasy",
        )
        op.alter_column(
            "season_settings", column, server_default=None, schema="fantasy"
        )
        op.create_check_constraint(
            f"ck_season_settings_{column}",
            "season_settings",
            f"{column} BETWEEN -100 AND 100",
            schema="fantasy",
        )
    for column in STATS:
        op.add_column(
            "nfl_player_game_stats",
            sa.Column(
                column, sa.SmallInteger(), nullable=False, server_default=sa.text("0")
            ),
            schema="nfl",
        )
        op.alter_column(
            "nfl_player_game_stats", column, server_default=None, schema="nfl"
        )


def downgrade() -> None:
    for column in STATS:
        op.drop_column("nfl_player_game_stats", column, schema="nfl")
    for column in SETTINGS:
        op.drop_column("season_settings", column, schema="fantasy")
