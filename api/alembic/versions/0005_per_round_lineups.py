"""per_round_lineups

Replaces the single persistent slot layout (team_players.slot_index and the unused
weeks/lineups/player_scores tables) with per-round lineup_slots, and drops the
free-agency, swap-eliminated, bye-handling and roster-lock settings that the fixed
product rules make meaningless. Pre-dev: no data is carried over.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-30 14:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REMOVED_SETTINGS = {
    "free_agency_enabled": sa.Boolean(),
    "free_agency_window": sa.String(length=20),
    "free_agency_claim_order": sa.String(length=20),
    "roster_lock": sa.String(length=20),
    "allow_swap_eliminated": sa.Boolean(),
    "bye_week_handling": sa.String(length=30),
}


def upgrade() -> None:
    op.drop_table("player_scores", schema="fantasy")
    op.drop_table("lineups", schema="fantasy")
    op.drop_table("weeks", schema="fantasy")
    op.drop_column("team_players", "slot_index", schema="fantasy")
    for column in REMOVED_SETTINGS:
        op.drop_column("league_settings", column, schema="fantasy")
    op.create_table(
        "lineup_slots",
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("slot_index", sa.Integer(), nullable=False),
        sa.CheckConstraint("round BETWEEN 1 AND 4", name="ck_lineup_slots_round"),
        sa.ForeignKeyConstraint(["team_id"], ["fantasy.teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["player_id"], ["nfl.nfl_players.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("team_id", "round", "player_id"),
        sa.UniqueConstraint("team_id", "round", "slot_index"),
        schema="fantasy",
    )


def downgrade() -> None:
    raise NotImplementedError("Pre-dev migration: recreate the database instead")
