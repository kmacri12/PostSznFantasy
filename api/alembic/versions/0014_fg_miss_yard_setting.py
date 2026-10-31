"""fg_miss_yard_setting

Adds the per-yard missed field goal scoring setting (docs/rapidapi-tank01.md: the
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


def downgrade() -> None:
    op.drop_column("league_settings", "scoring_kicking_fg_miss_yard", schema="fantasy")
