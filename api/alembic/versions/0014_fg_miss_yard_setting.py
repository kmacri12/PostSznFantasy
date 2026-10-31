"""fg_miss_yard_setting

Splits dst_blocked_kicks into punts, field goals and extra points, and adds the per-yard missed field goal scoring setting (docs/rapidapi-tank01.md: the
distances come from the play-by-play). Existing leagues get 0, so their scores stay put.

Revision ID: 0014_fg_miss_yard_setting
Revises: 0013_player_injury_status
Create Date: 2026-10-31 15:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_fg_miss_yard_setting"
down_revision: str | Sequence[str] | None = "0013_player_injury_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_BLOCKED_KINDS = (
    "dst_blocked_punts",
    "dst_blocked_field_goals",
    "dst_blocked_extra_points",
)


def upgrade() -> None:
    op.add_column(
        "league_settings",
        sa.Column(
            "scoring_kicking_fg_miss_yard",
            sa.Numeric(precision=6, scale=2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        schema="fantasy",
    )
    op.alter_column(
        "league_settings",
        "scoring_kicking_fg_miss_yard",
        server_default=None,
        schema="fantasy",
    )
    # Blocked kicks were never ingested, so nothing to carry over.
    op.drop_column("nfl_player_game_stats", "dst_blocked_kicks", schema="nfl")
    for column in _BLOCKED_KINDS:
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
    for column in _BLOCKED_KINDS:
        op.drop_column("nfl_player_game_stats", column, schema="nfl")
    op.add_column(
        "nfl_player_game_stats",
        sa.Column(
            "dst_blocked_kicks",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        schema="nfl",
    )
    op.drop_column("league_settings", "scoring_kicking_fg_miss_yard", schema="fantasy")
