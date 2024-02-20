import os
import psycopg2
from api.utils.rapidapi.rapidapi import RapidApi
from api.utils.pg.pg_utils import *


rapidapi_connection = RapidApi()

def update_nflplayers_table(conn:connection=get_pg_connection()):
    pass

def update_nflteams_table(conn:connection=get_pg_connection()):
    pass

def update_nflgames_table(conn:connection=get_pg_connection()):
    pass

def update_nfl_player_game_stats_table(conn:connection=get_pg_connection()):
    pass
