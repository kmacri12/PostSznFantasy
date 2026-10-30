"""activity_events

Append-only activity feed (lineup moves, commissioner overrides, stat corrections,
settings changes) and each member's last-viewed marker per feed.

Revision ID: 0008_activity_events
Revises: 0007
Create Date: 2026-10-30 15:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008_activity_events"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_name", sa.String(length=20), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "kind IN ('lineup_move', 'commissioner_override', 'stat_correction', "
            "'settings_change')",
            name="ck_activity_events_kind",
        ),
        sa.ForeignKeyConstraint(
            ["league_id"], ["fantasy.leagues.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["team_id"], ["fantasy.teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["fantasy.users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="fantasy",
    )
    op.create_index(
        "ix_activity_events_league_id_id",
        "activity_events",
        ["league_id", "id"],
        schema="fantasy",
    )
    op.create_index(
        "ix_activity_events_team_id_id",
        "activity_events",
        ["team_id", "id"],
        schema="fantasy",
    )
    op.create_table(
        "activity_views",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("last_event_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["fantasy.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["league_id"], ["fantasy.leagues.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "league_id", "team_id"),
        schema="fantasy",
    )


def downgrade() -> None:
    raise NotImplementedError("Pre-dev migration: recreate the database instead")
