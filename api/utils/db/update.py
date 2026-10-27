from api.utils.db.pg_utils import get_pg_connection
from api.utils.rapidapi.rapidapi import RapidApi
from psycopg2.extensions import connection


def get_rapidapi_client() -> RapidApi:
    return RapidApi()


def update_nflplayers_table(conn: connection | None = None) -> None:
    if conn is None:
        conn = get_pg_connection()


def update_nflteams_table(conn: connection | None = None) -> None:
    if conn is None:
        conn = get_pg_connection()


def update_nflgames_table(conn: connection | None = None) -> None:
    if conn is None:
        conn = get_pg_connection()


def update_nfl_player_game_stats_table(conn: connection | None = None) -> None:
    if conn is None:
        conn = get_pg_connection()
