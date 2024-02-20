import os
import psycopg2
from psycopg2.extensions import connection

def dictfetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def table_exists(conn, table_name) -> bool:
    """Check if a table exists in the database."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = %s
        )
    """, (table_name,))
    exists = cursor.fetchone()[0]
    cursor.close()
    return exists


def table_has_data(conn, table_name) -> bool:
    """Check if a table contains any data."""
    cursor = conn.cursor()
    cursor.execute(f"SELECT EXISTS (SELECT 1 FROM {table_name})")
    has_data = cursor.fetchone()[0]
    cursor.close()
    return has_data


def get_pg_connection(host=os.getenv("PG_HOST"), 
        dbname=os.getenv("PG_DBNAME"),
        user=os.getenv("PG_USER"), 
        password=os.getenv("PG_PASSWORD"),
        port=int(os.getenv("PG_PORT"))) -> connection:
    return psycopg2.connect(
        host=host, 
        dbname=dbname,
        user=user, 
        password=password,
        port=port,
    )