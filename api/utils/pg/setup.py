import os
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from api.utils.rapidapi.rapidapi import RapidApi



rapidapi_connection = RapidApi()

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


def create_nflteams_table(conn):
    cursor = conn.cursor()
    if not table_exists(conn, "nfl_teams"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_teams (
            id INT PRIMARY KEY,
            team_abv VARCHAR(255),
            team_city VARCHAR(255),
            team_name VARCHAR(255),
            team_logo_url VARCHAR(255)
        );          
        """)
    if not table_has_data(conn, "nfl_teams"):
        nfl_teams = rapidapi_connection.get_nfl_teams()
        insert_query = """
            INSERT INTO nfl_teams (id, team_abv, team_city, team_name, team_logo_url)
            VALUES (%s, %s, %s, %s, %s)
        """
        for team in nfl_teams:
            cursor.execute(insert_query, (int(team['teamID']), team['teamAbv'], team['teamCity'], team['teamName'], team['nflComLogo1'],))
    
    conn.commit()
    cursor.close()

def create_nflplayers_table(conn):
    cursor = conn.cursor()
    if (not table_exists(conn, "nfl_teams")) or (not table_has_data(conn, "nfl_teams")):
        create_nflteams_table(conn)
    if not table_exists(conn, "nfl_players"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_players (
            id INT PRIMARY KEY,
            name VARCHAR(255),
            position VARCHAR(255),
            espn_headshot_url VARCHAR(255),
            jersey_num VARCHAR(255),
            birthday VARCHAR(255),
            height VARCHAR(255),
            weight VARCHAR(255),
            exp VARCHAR(255),
            team_id INT,
            FOREIGN KEY (team_id) REFERENCES nfl_teams (id)
        );
        """)
    if not table_has_data(conn, "nfl_players"):
        nfl_players = rapidapi_connection.get_nfl_players()
        insert_query = """
            INSERT INTO nfl_players (id, name, position, espn_headshot_url, jersey_num, birthday, height, weight, exp, team_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for player in nfl_players:
            id = int(player['playerID'])
            name = player['longName']
            pos = player['pos']
            espnHeadshot = player['espnHeadshot'] if "espnHeadshot" in player else ""
            teamID = int(player['teamID'])
            jersey = player['jerseyNum'] if "jerseyNum" in player else ""
            birthday = player['bDay'] if "bDay" in player else "1/1/1900"
            height = player['height'] if "height" in player else "0'0\""
            weight = player['weight'] if "weight" in player else "0"
            exp = player['exp'] if 'exp' in player and player['exp'] != 'R' else "0"
            cursor.execute(insert_query, (id, name, pos, espnHeadshot, jersey, birthday, height, weight, exp, teamID,))
    
    conn.commit()
    cursor.close()

def create_db():
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"), 
        dbname="postgres",
        user=os.getenv("PG_USER"), 
        password=os.getenv("PG_PASSWORD"),
        port=int(os.getenv("PG_PORT")),
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (os.getenv("PG_DBNAME"),))
    exists = cursor.fetchone()
    if not exists:
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier('PostSznFantasy')))
    conn.commit()

    cursor.close()
    conn.close()


def setup_postgres():
    create_db()
    conn = psycopg2.connect(
        host=os.getenv("PG_HOST"), 
        dbname=os.getenv("PG_DBNAME"),
        user=os.getenv("PG_USER"), 
        password=os.getenv("PG_PASSWORD"),
        port=int(os.getenv("PG_PORT")),
    )
    create_nflteams_table(conn)
    create_nflplayers_table(conn)
    conn.close()
