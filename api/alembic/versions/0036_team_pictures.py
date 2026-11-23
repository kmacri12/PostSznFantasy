"""generated team pictures

A team without an uploaded picture shows a generated one: a colour and an icon, stored on the
team when it is created (services/team_pictures.py). Existing teams get a colour no other team
of their season has (by creation order) and an icon spread by the same order.

Revision ID: 0036_team_pictures
Revises: 0035_return_td_scoring
Create Date: 2026-11-23 17:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0036_team_pictures"
down_revision: str | Sequence[str] | None = "0035_return_td_scoring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLORS = 12
ICONS = 12


def upgrade() -> None:
    for column in ("picture_color", "picture_icon"):
        op.add_column(
            "teams",
            sa.Column(column, sa.SmallInteger(), nullable=False, server_default="0"),
            schema="fantasy",
        )
    op.execute(
        sa.text(
            f"""
            UPDATE fantasy.teams AS t
            SET picture_color = (ordered.n - 1) % {COLORS},
                picture_icon = (ordered.n * 5 + ordered.season_id) % {ICONS}
            FROM (
                SELECT id, season_id,
                       row_number() OVER (PARTITION BY season_id ORDER BY id) AS n
                FROM fantasy.teams
            ) AS ordered
            WHERE t.id = ordered.id
            """
        )
    )


def downgrade() -> None:
    for column in ("picture_icon", "picture_color"):
        op.drop_column("teams", column, schema="fantasy")
