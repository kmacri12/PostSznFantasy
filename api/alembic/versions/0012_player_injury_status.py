"""player_injury_status

Adds the injury tag (Out, Doubtful, Questionable, Injured Reserve) shown next to players.

Revision ID: 0012_player_injury_status
Revises: 0011_league_notes
Create Date: 2026-10-31 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_player_injury_status"
down_revision: str | Sequence[str] | None = "0011_league_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "nfl_players",
        sa.Column("injury_status", sa.String(length=32), nullable=True),
        schema="nfl",
    )


def downgrade() -> None:
    op.drop_column("nfl_players", "injury_status", schema="nfl")
