import os
from typing import Any

import psycopg2
from psycopg2.extensions import connection


def dictfetchall(cursor: Any) -> list[dict[str, Any]]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]


def table_exists(conn: connection, table_name: str) -> bool:
    """Check if a table exists in the database."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = %s
        )
    """,
        (table_name,),
    )
    result = cursor.fetchone()
    cursor.close()
    return bool(result and result[0])


def table_has_data(conn: connection, table_name: str) -> bool:
    """Check if a table contains any data."""
    cursor = conn.cursor()
    cursor.execute(f"SELECT EXISTS (SELECT 1 FROM {table_name})")
    result = cursor.fetchone()
    cursor.close()
    return bool(result and result[0])


def get_pg_connection(
    host: str | None = None,
    dbname: str | None = None,
    user: str | None = None,
    password: str | None = None,
    port: int | str | None = None,
) -> connection:
    raw_port = port or os.getenv("PG_PORT", "5432")
    return psycopg2.connect(
        host=host or os.getenv("PG_HOST", "localhost"),
        dbname=dbname or os.getenv("PG_DBNAME", "postszn"),
        user=user or os.getenv("PG_USER", "postgres"),
        password=password or os.getenv("PG_PASSWORD", "postgres"),
        port=int(raw_port),
    )
