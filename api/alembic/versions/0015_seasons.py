"""seasons

One permanent league with a season per year (#114). Wipe and rebuild: the project is
pre-launch, so existing leagues are deleted instead of converted.

Revision ID: 0015_seasons
Revises: 0014_fg_miss_yard_setting
Create Date: 2026-11-02 09:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015_seasons"
down_revision: str | Sequence[str] | None = "0014_fg_miss_yard_setting"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables whose league_id becomes a season_id (dropping the column drops its
# constraints and indexes, which are recreated below).
SEASON_TABLES = (
    "teams",
    "drafts",
    "team_players",
    "standings",
    "activity_events",
    "activity_views",
)


def _fk(table: str, column: str, target: str, ondelete: str) -> None:
    op.create_foreign_key(
        f"fk_{table}_{column}",
        table,
        target.split(".")[1],
        [column],
        ["id"],
        source_schema="fantasy",
        referent_schema="fantasy",
        ondelete=ondelete,
    )


def upgrade() -> None:
    op.execute("TRUNCATE fantasy.leagues CASCADE")

    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "league_id",
            sa.Integer(),
            sa.ForeignKey("fantasy.leagues.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.UniqueConstraint("league_id", "year"),
        schema="fantasy",
    )
    op.create_index(
        "ix_fantasy_seasons_league_id", "seasons", ["league_id"], schema="fantasy"
    )

    op.drop_constraint(
        "uq_leagues_previous_league_id", "leagues", schema="fantasy", type_="unique"
    )
    op.drop_constraint(
        "fk_leagues_previous_league_id", "leagues", schema="fantasy", type_="foreignkey"
    )
    op.drop_column("leagues", "previous_league_id", schema="fantasy")
    op.drop_column("leagues", "season", schema="fantasy")
    op.add_column(
        "leagues",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        schema="fantasy",
    )
    op.add_column(
        "leagues",
        sa.Column("deleted_by", sa.Integer(), nullable=True),
        schema="fantasy",
    )
    op.create_foreign_key(
        "fk_leagues_deleted_by",
        "leagues",
        "users",
        ["deleted_by"],
        ["id"],
        source_schema="fantasy",
        referent_schema="fantasy",
        ondelete="SET NULL",
    )
    op.add_column(
        "league_members",
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        schema="fantasy",
    )

    op.rename_table("league_settings", "season_settings", schema="fantasy")
    for table in ("season_settings", *SEASON_TABLES):
        op.drop_column(table, "league_id", schema="fantasy")
        op.add_column(
            table,
            sa.Column("season_id", sa.Integer(), nullable=False),
            schema="fantasy",
        )
        _fk(table, "season_id", "fantasy.seasons", "CASCADE")

    op.create_unique_constraint(
        "uq_season_settings_season_id",
        "season_settings",
        ["season_id"],
        schema="fantasy",
    )
    op.create_unique_constraint(
        "uq_drafts_season_id", "drafts", ["season_id"], schema="fantasy"
    )
    op.create_unique_constraint(
        "uq_team_players_season_id_player_id",
        "team_players",
        ["season_id", "player_id"],
        schema="fantasy",
    )
    op.create_unique_constraint(
        "uq_standings_season_id_team_id",
        "standings",
        ["season_id", "team_id"],
        schema="fantasy",
    )
    op.create_index(
        "ix_fantasy_teams_season_id", "teams", ["season_id"], schema="fantasy"
    )
    op.create_index(
        "ix_fantasy_standings_season_id", "standings", ["season_id"], schema="fantasy"
    )
    op.create_index(
        "ix_activity_events_season_id_id",
        "activity_events",
        ["season_id", "id"],
        schema="fantasy",
    )
    op.create_primary_key(
        "activity_views_pkey",
        "activity_views",
        ["user_id", "season_id", "team_id"],
        schema="fantasy",
    )


def downgrade() -> None:
    raise NotImplementedError("Wipe-and-rebuild migration; restore from a backup.")
