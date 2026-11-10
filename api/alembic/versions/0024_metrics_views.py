"""metrics views and a read-only role

Aggregate-only views for the owner's dashboards (#358): no emails, names or other
personal data leave the database through them. `metrics_reader` can read the views and
nothing else; the owner sets its password (docs/owner/23-monitoring.md).

Revision ID: 0024_metrics_views
Revises: 0023_draft_reserved_picks
Create Date: 2026-11-09 20:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0024_metrics_views"
down_revision: str | Sequence[str] | None = "0023_draft_reserved_picks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

VIEWS = ("metrics_daily", "metrics_leagues", "metrics_users")

# Views run with their owner's rights, so the reader needs no table access. Soft-deleted
# leagues (#231) are left out of every count.
METRICS_LEAGUES = """
CREATE OR REPLACE VIEW fantasy.metrics_leagues AS
SELECT
    l.id AS league_id,
    l.created_at,
    s.year AS season_year,
    d.status AS draft_status,
    (SELECT count(*) FROM fantasy.league_members m
     WHERE m.league_id = l.id AND m.left_at IS NULL) AS members,
    (SELECT count(*) FROM fantasy.seasons x WHERE x.league_id = l.id) AS seasons,
    coalesce(t.teams, 0) AS teams,
    coalesce(t.claimed_teams, 0) AS claimed_teams,
    coalesce(t.teams, 0) - coalesce(t.claimed_teams, 0) AS open_teams
FROM fantasy.leagues l
LEFT JOIN LATERAL (
    SELECT id, year FROM fantasy.seasons
    WHERE league_id = l.id ORDER BY year DESC LIMIT 1
) s ON true
LEFT JOIN fantasy.drafts d ON d.season_id = s.id
LEFT JOIN LATERAL (
    SELECT count(*) AS teams, count(owner_id) AS claimed_teams
    FROM fantasy.teams WHERE season_id = s.id
) t ON true
WHERE l.deleted_at IS NULL
"""

METRICS_USERS = """
CREATE OR REPLACE VIEW fantasy.metrics_users AS
SELECT
    u.id AS user_id,
    u.created_at,
    (SELECT count(*) FROM fantasy.league_members m
     JOIN fantasy.leagues l ON l.id = m.league_id AND l.deleted_at IS NULL
     WHERE m.user_id = u.id AND m.left_at IS NULL) AS leagues_joined
FROM fantasy.users u
"""

# One row per UTC day from the first signup to today; every column counts what happened
# that day. Drafts "scheduled" are the ones set to start that day, not the day the
# commissioner picked the time.
METRICS_DAILY = """
CREATE OR REPLACE VIEW fantasy.metrics_daily AS
WITH bounds AS (
    SELECT coalesce(min(created_at), now())::date AS first_day FROM fantasy.users
),
days AS (
    SELECT d::date AS day
    FROM bounds, generate_series(bounds.first_day, (now() AT TIME ZONE 'UTC')::date,
                                 interval '1 day') AS d
),
live_leagues AS (SELECT id FROM fantasy.leagues WHERE deleted_at IS NULL),
signups AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.users GROUP BY 1
),
leagues_created AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.leagues WHERE deleted_at IS NULL GROUP BY 1
),
joins AS (
    SELECT (m.joined_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.league_members m JOIN live_leagues l ON l.id = m.league_id GROUP BY 1
),
drafts_scheduled AS (
    SELECT (d.start_time AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.drafts d
    JOIN fantasy.seasons s ON s.id = d.season_id
    JOIN live_leagues l ON l.id = s.league_id
    WHERE d.start_time IS NOT NULL GROUP BY 1
),
draft_events AS (
    SELECT (e.created_at AT TIME ZONE 'UTC')::date AS day,
           count(*) FILTER (WHERE e.kind = 'draft_started') AS started,
           count(*) FILTER (WHERE e.kind = 'draft_completed') AS completed
    FROM fantasy.activity_events e
    JOIN fantasy.seasons s ON s.id = e.season_id
    JOIN live_leagues l ON l.id = s.league_id
    WHERE e.kind IN ('draft_started', 'draft_completed') GROUP BY 1
),
messages AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.league_messages
    WHERE deleted_at IS NULL GROUP BY 1
),
pushes AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
    FROM fantasy.push_subscriptions GROUP BY 1
),
active AS (
    SELECT day, count(DISTINCT user_id) AS n FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, actor_user_id AS user_id
        FROM fantasy.activity_events WHERE actor_user_id IS NOT NULL
        UNION ALL
        SELECT (created_at AT TIME ZONE 'UTC')::date, author_user_id
        FROM fantasy.league_messages
        WHERE author_user_id IS NOT NULL AND deleted_at IS NULL
    ) a GROUP BY day
)
SELECT
    days.day,
    coalesce(signups.n, 0) AS signups,
    coalesce(leagues_created.n, 0) AS leagues_created,
    coalesce(joins.n, 0) AS members_joined,
    coalesce(drafts_scheduled.n, 0) AS drafts_scheduled,
    coalesce(draft_events.started, 0) AS drafts_started,
    coalesce(draft_events.completed, 0) AS drafts_completed,
    coalesce(active.n, 0) AS active_members,
    coalesce(messages.n, 0) AS chat_messages,
    coalesce(pushes.n, 0) AS push_subscriptions
FROM days
LEFT JOIN signups USING (day)
LEFT JOIN leagues_created USING (day)
LEFT JOIN joins USING (day)
LEFT JOIN drafts_scheduled USING (day)
LEFT JOIN draft_events USING (day)
LEFT JOIN active USING (day)
LEFT JOIN messages USING (day)
LEFT JOIN pushes USING (day)
"""

CREATE_VIEWS = (METRICS_LEAGUES, METRICS_USERS, METRICS_DAILY)

# NOLOGIN until the owner sets a password; the password never lives in the repo.
CREATE_ROLE = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metrics_reader') THEN
        CREATE ROLE metrics_reader NOLOGIN;
    END IF;
END
$$
"""

GRANTS = (
    "ALTER ROLE metrics_reader SET default_transaction_read_only = on",
    "GRANT USAGE ON SCHEMA fantasy TO metrics_reader",
    *(f"GRANT SELECT ON fantasy.{view} TO metrics_reader" for view in VIEWS),
)


def create_metrics(connection: sa.engine.Connection) -> None:
    for statement in (*CREATE_VIEWS, CREATE_ROLE, *GRANTS):
        connection.execute(sa.text(statement))


def upgrade() -> None:
    for table in ("users", "leagues"):
        op.add_column(
            table,
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            schema="fantasy",
        )
    create_metrics(op.get_bind())


def downgrade() -> None:
    for view in VIEWS:
        op.execute(f"DROP VIEW IF EXISTS fantasy.{view}")
    op.execute("DROP OWNED BY metrics_reader")
    op.execute("DROP ROLE metrics_reader")
    for table in ("leagues", "users"):
        op.drop_column(table, "created_at", schema="fantasy")
