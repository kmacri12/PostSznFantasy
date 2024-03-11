from api.utils.rapidapi.rapidapi import RapidApi
from api.utils.db.pg_utils import get_pg_connection
from psycopg2.extensions import connection


rapidapi_connection = RapidApi()


def update_nflplayers_table(conn: connection = get_pg_connection()):
    pass


def update_nflteams_table(conn: connection = get_pg_connection()):
    pass


def update_nflgames_table(conn: connection = get_pg_connection()):
    pass


def update_nfl_player_game_stats_table(conn: connection = get_pg_connection()):
    pass
