"""settings bounds

Roster and scoring limits on season_settings (#322), the same ones the API enforces,
so no write path can store a roster that exhausts memory or can never be filled.
roster_total = starters + bench stays an API rule: older rows may differ.

Revision ID: 0021_settings_bounds
Revises: 0020_lowercase_emails
Create Date: 2026-11-09 09:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021_settings_bounds"
down_revision: str | Sequence[str] | None = "0020_lowercase_emails"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STARTERS = (
    "roster_num_qb",
    "roster_num_rb",
    "roster_num_wr",
    "roster_num_te",
    "roster_num_flex_wr_rb_te",
    "roster_num_flex_wr_rb",
    "roster_num_flex_wr_te",
    "roster_num_flex_qb_wr_rb_te",
    "roster_num_k",
    "roster_num_dst",
)
CAPPED = ("qb", "rb", "wr", "te", "k", "dst")
TABLE = "season_settings"


def _scoring_columns() -> list[str]:
    rows = op.get_bind().execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'fantasy' AND table_name = :t "
            "AND column_name LIKE 'scoring\\_%'"
        ),
        {"t": TABLE},
    )
    return [row[0] for row in rows]


def upgrade() -> None:
    t = f"fantasy.{TABLE}"
    # Bring any existing row inside the limits before the constraints apply.
    for col in (*STARTERS, "roster_num_bench"):
        op.execute(f"UPDATE {t} SET {col} = LEAST(GREATEST({col}, 0), 20)")
    op.execute(f"UPDATE {t} SET roster_num_qb = 1 WHERE {' + '.join(STARTERS)} < 1")
    for pos in CAPPED:
        op.execute(
            f"UPDATE {t} SET roster_max_{pos} = "
            f"LEAST(GREATEST(roster_max_{pos}, roster_num_{pos}), 99)"
        )
    op.execute(
        f"UPDATE {t} SET roster_total = roster_num_bench + {' + '.join(STARTERS)}"
    )
    for col in _scoring_columns():
        op.execute(f"UPDATE {t} SET {col} = LEAST(GREATEST({col}, -100), 100)")

    for col in (*STARTERS, "roster_num_bench"):
        op.create_check_constraint(
            f"ck_season_settings_{col}",
            TABLE,
            f"{col} BETWEEN 0 AND 20",
            schema="fantasy",
        )
    for pos in CAPPED:
        op.create_check_constraint(
            f"ck_season_settings_roster_max_{pos}",
            TABLE,
            f"roster_max_{pos} BETWEEN roster_num_{pos} AND 99",
            schema="fantasy",
        )
    op.create_check_constraint(
        "ck_season_settings_roster_size",
        TABLE,
        "roster_total BETWEEN 1 AND 40 AND " + " + ".join(STARTERS) + " >= 1",
        schema="fantasy",
    )
    for col in _scoring_columns():
        op.create_check_constraint(
            f"ck_season_settings_{col}",
            TABLE,
            f"{col} BETWEEN -100 AND 100",
            schema="fantasy",
        )


def downgrade() -> None:
    names = [f"ck_season_settings_{c}" for c in (*STARTERS, "roster_num_bench")]
    names += [f"ck_season_settings_roster_max_{p}" for p in CAPPED]
    names += ["ck_season_settings_roster_size"]
    names += [f"ck_season_settings_{c}" for c in _scoring_columns()]
    for name in names:
        op.drop_constraint(name, TABLE, schema="fantasy", type_="check")
