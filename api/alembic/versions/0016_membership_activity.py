"""membership_activity

Four more activity kinds (league created, joined, left, role changed) and a one-time
backfill of them for leagues that already exist, from the timestamps already stored.
Rerunning the backfill adds nothing. Real leagues exist by now, so history that was
never logged is reconstructed instead of leaving their feeds empty.

Revision ID: 0016_membership_activity
Revises: 0015_seasons
Create Date: 2026-11-02 12:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016_membership_activity"
down_revision: str | Sequence[str] | None = "0015_seasons"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_KINDS = (
    "'lineup_move', 'commissioner_override', 'stat_correction', 'settings_change'"
)
NEW_KINDS = "'league_created', 'membership_joined', 'membership_left', 'role_changed'"

# The feed belongs to the league's latest season. The creator is the first member to
# join; later commissioners were promoted after joining.
BACKFILL = """
DROP TABLE IF EXISTS _feed_members;

CREATE TEMP TABLE _feed_members AS
SELECT s.id AS season_id, m.league_id, m.user_id, m.role, m.joined_at, m.left_at,
       u.username, l.name AS league_name,
       (m.user_id = FIRST_VALUE(m.user_id) OVER (
           PARTITION BY m.league_id ORDER BY m.joined_at, m.user_id
       )) AS is_creator
FROM fantasy.league_members m
JOIN fantasy.leagues l ON l.id = m.league_id
JOIN fantasy.users u ON u.id = m.user_id
JOIN fantasy.seasons s ON s.league_id = m.league_id
 AND s.year = (SELECT MAX(year) FROM fantasy.seasons WHERE league_id = m.league_id);

INSERT INTO fantasy.activity_events
    (season_id, kind, actor_user_id, actor_name, payload, created_at)
SELECT season_id, 'league_created', user_id, LEFT(username, 20),
       jsonb_build_object('leagueName', league_name), joined_at
FROM _feed_members f
WHERE is_creator AND NOT EXISTS (
    SELECT 1 FROM fantasy.activity_events e
    WHERE e.season_id = f.season_id AND e.kind = 'league_created'
);

INSERT INTO fantasy.activity_events
    (season_id, kind, actor_user_id, actor_name, payload, created_at)
SELECT f.season_id, 'membership_joined', f.user_id, LEFT(f.username, 20),
       jsonb_build_object(
           'role', CASE WHEN f.is_creator THEN 'commissioner' ELSE 'member' END,
           'teamName', (SELECT t.name FROM fantasy.teams t
                        WHERE t.season_id = f.season_id AND t.owner_id = f.user_id
                        LIMIT 1)
       ), f.joined_at
FROM _feed_members f
WHERE NOT EXISTS (
    SELECT 1 FROM fantasy.activity_events e
    WHERE e.season_id = f.season_id AND e.kind = 'membership_joined'
      AND e.actor_user_id = f.user_id
);

INSERT INTO fantasy.activity_events
    (season_id, kind, actor_user_id, actor_name, payload, created_at)
SELECT f.season_id, 'role_changed', NULL, NULL,
       jsonb_build_object(
           'userId', f.user_id, 'userName', f.username, 'role', 'commissioner'
       ), f.joined_at
FROM _feed_members f
WHERE f.role = 'commissioner' AND f.left_at IS NULL AND NOT f.is_creator
  AND NOT EXISTS (
    SELECT 1 FROM fantasy.activity_events e
    WHERE e.season_id = f.season_id AND e.kind = 'role_changed'
      AND (e.payload ->> 'userId')::int = f.user_id
);

INSERT INTO fantasy.activity_events
    (season_id, kind, actor_user_id, actor_name, payload, created_at)
SELECT f.season_id, 'membership_left', f.user_id, LEFT(f.username, 20),
       jsonb_build_object('userId', f.user_id, 'userName', f.username), f.left_at
FROM _feed_members f
WHERE f.left_at IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fantasy.activity_events e
    WHERE e.season_id = f.season_id AND e.kind = 'membership_left'
      AND (e.payload ->> 'userId')::int = f.user_id
);

DROP TABLE _feed_members;
"""


def _set_kind_constraint(kinds: str) -> None:
    op.drop_constraint(
        "ck_activity_events_kind", "activity_events", schema="fantasy", type_="check"
    )
    op.create_check_constraint(
        "ck_activity_events_kind",
        "activity_events",
        f"kind IN ({kinds})",
        schema="fantasy",
    )


def upgrade() -> None:
    _set_kind_constraint(f"{OLD_KINDS}, {NEW_KINDS}")
    for statement in BACKFILL.split(";\n\n"):
        if statement.strip():
            op.execute(statement)


def downgrade() -> None:
    op.execute(f"DELETE FROM fantasy.activity_events WHERE kind IN ({NEW_KINDS})")
    _set_kind_constraint(OLD_KINDS)
