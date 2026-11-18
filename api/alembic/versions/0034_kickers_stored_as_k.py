"""store kickers as K

Tank01 sends kickers as `PK`; ingest now stores `K` (as `FB` is stored as `RB`), so
rewrite the rows already there.

Revision ID: 0034_kickers_stored_as_k
Revises: 0033_draft_autopilot
Create Date: 2026-11-17 12:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0034_kickers_stored_as_k"
down_revision: str | Sequence[str] | None = "0033_draft_autopilot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE nfl.nfl_players SET position = 'K' WHERE position = 'PK'")


def downgrade() -> None:
    # `PK` is not recoverable and nothing reads it any more.
    pass
