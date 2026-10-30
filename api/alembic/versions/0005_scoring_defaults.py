"""scoring_defaults

Scoring settings follow docs/product-rules.md section 5: kicker distance tiers and
the player return-TD settings are gone (return TDs always score for the DST), and
the DST point and yardage tiers use the new band edges.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-30 18:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KICK_BANDS = ("0_19", "20_29", "30_39", "40_49", "50_plus")
DROPPED = (
    "scoring_special_punt_return_td",
    "scoring_special_kick_return_td",
    *(f"scoring_kicking_fg_made_{band}" for band in _KICK_BANDS),
    *(f"scoring_kicking_fg_miss_{band}" for band in _KICK_BANDS),
    *(
        f"scoring_dst_pts_allowed_{band}"
        for band in ("1_6", "7_13", "14_20", "21_27", "28_34", "35_plus")
    ),
    *(
        f"scoring_dst_yards_allowed_{band}"
        for band in ("300_399", "400_499", "500_plus")
    ),
)

ADDED = {
    "scoring_dst_pts_allowed_1_13": 5,
    "scoring_dst_pts_allowed_14_21": 3,
    "scoring_dst_pts_allowed_22_28": 1,
    "scoring_dst_pts_allowed_29_plus": 0,
    "scoring_dst_yards_allowed_300_plus": 0,
}

# Existing leagues move to the new defaults; the app has no production data yet.
RESET = {
    "scoring_passing_interception": -2,
    "scoring_kicking_fg_miss": -1,
    "scoring_kicking_fg_yard": 0.1,
    "scoring_kicking_xp_miss": -1,
    "scoring_dst_pts_allowed_0": 7,
    "scoring_dst_yards_allowed_under_100": 6,
    "scoring_dst_yards_allowed_100_199": 4,
    "scoring_dst_yards_allowed_200_299": 2,
    "scoring_dst_fumble_recover": 1,
    "scoring_dst_interception": 1,
    "scoring_dst_two_point_return": 2,
}

_NUMERIC = sa.Numeric(precision=6, scale=2)


def upgrade() -> None:
    for column, default in ADDED.items():
        op.add_column(
            "league_settings",
            sa.Column(
                column, _NUMERIC, nullable=False, server_default=sa.text(str(default))
            ),
            schema="fantasy",
        )
        op.alter_column(
            "league_settings", column, server_default=None, schema="fantasy"
        )
    for column in DROPPED:
        op.drop_column("league_settings", column, schema="fantasy")
    assignments = ", ".join(f"{column} = {value}" for column, value in RESET.items())
    op.execute(f"UPDATE fantasy.league_settings SET {assignments}")


def downgrade() -> None:
    raise NotImplementedError("Scoring defaults migration is one-way")
