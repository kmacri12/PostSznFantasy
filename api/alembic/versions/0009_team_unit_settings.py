"""team_unit_settings

Adds the required team QB / team K league settings (docs/product-rules.md section 4)
and the depth chart starters that pick the one QB / K per NFL team in the draft pool.
Pre-dev: existing leagues are backfilled to off; new leagues must choose explicitly.

Revision ID: 0009_team_unit_settings
Revises: 0007
Create Date: 2026-10-30 16:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_team_unit_settings"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = ("team_qb", "team_k")


def upgrade() -> None:
    for column in COLUMNS:
        op.add_column(
            "league_settings",
            sa.Column(column, sa.Boolean(), nullable=False, server_default="false"),
            schema="fantasy",
        )
        # The backfill is the only default; the API requires an explicit choice.
        op.alter_column(
            "league_settings", column, server_default=None, schema="fantasy"
        )
    op.create_table(
        "depth_chart_starters",
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.String(length=8), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["nfl.nfl_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["player_id"], ["nfl.nfl_players.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("team_id", "position"),
        schema="nfl",
    )


def downgrade() -> None:
    op.drop_table("depth_chart_starters", schema="nfl")
    for column in COLUMNS:
        op.drop_column("league_settings", column, schema="fantasy")
