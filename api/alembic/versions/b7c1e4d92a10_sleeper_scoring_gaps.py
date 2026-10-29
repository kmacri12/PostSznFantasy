"""sleeper_scoring_gaps

Revision ID: b7c1e4d92a10
Revises: 25a38913a05f
Create Date: 2026-10-28 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7c1e4d92a10"
down_revision: str | Sequence[str] | None = "25a38913a05f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_SCORING_COLUMNS = [
    "scoring_passing_bonus_300_yards",
    "scoring_passing_bonus_400_yards",
    "scoring_rushing_bonus_100_yards",
    "scoring_rushing_bonus_200_yards",
    "scoring_receiving_bonus_100_yards",
    "scoring_receiving_bonus_200_yards",
    "scoring_kicking_fg_miss_0_19",
    "scoring_kicking_fg_miss_20_29",
    "scoring_kicking_fg_miss_30_39",
    "scoring_kicking_fg_miss_40_49",
    "scoring_kicking_fg_miss_50_plus",
    "scoring_dst_blocked_kick",
    "scoring_dst_two_point_return",
]


def upgrade() -> None:
    for column in NEW_SCORING_COLUMNS:
        op.add_column(
            "league_settings",
            sa.Column(column, sa.Numeric(6, 2), nullable=True),
            schema="fantasy",
        )
    stats = "nfl_player_game_stats"
    op.add_column(
        stats,
        sa.Column(
            "kicking_fg_yards_missed",
            sa.ARRAY(sa.SmallInteger()),
            nullable=False,
            server_default="{}",
        ),
        schema="nfl",
    )
    for column in ("dst_blocked_kicks", "dst_two_point_returns"):
        op.add_column(
            stats,
            sa.Column(column, sa.SmallInteger(), nullable=False, server_default="0"),
            schema="nfl",
        )


def downgrade() -> None:
    stats = "nfl_player_game_stats"
    for column in (
        "dst_two_point_returns",
        "dst_blocked_kicks",
        "kicking_fg_yards_missed",
    ):
        op.drop_column(stats, column, schema="nfl")
    for column in reversed(NEW_SCORING_COLUMNS):
        op.drop_column("league_settings", column, schema="fantasy")
