import os
import json
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from api.utils.rapidapi.rapidapi import RapidApi



rapidapi_connection = RapidApi()

# Function to fetch all rows as a dictionary
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

def create_nfl_games_table(conn):
    cursor = conn.cursor()
    if (not table_exists(conn, "nfl_teams")) or (not table_has_data(conn, "nfl_teams")):
        create_nflteams_table(conn)
    if (not table_exists(conn, "nfl_players")) or (not table_has_data(conn, "nfl_players")):
        create_nflplayers_table(conn)
    if not table_exists(conn, "nfl_games"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_games (
            id VARCHAR(255) PRIMARY KEY,
            game_status VARCHAR(255),
            game_date VARCHAR(255),
            game_time_epoch VARCHAR(255),
            game_week VARCHAR(255),
            season VARCHAR(255),
            espn_link VARCHAR(255),
            team_id_home INT,
            team_id_away INT,
            home_pts VARCHAR(255),
            away_pts VARCHAR(255),
            season_type VARCHAR(255),
            team_stats JSONB,
            scoring_plays JSONB,
            line_score JSONB,
            player_stats JSONB,
            dst JSONB,
            game_clock VARCHAR(255),
            FOREIGN KEY (team_id_home) REFERENCES nfl_teams (id),
            FOREIGN KEY (team_id_away) REFERENCES nfl_teams (id)
        );
        """)
    if not table_has_data(conn, "nfl_games"):
        year = os.getenv("SEASON_YEAR")
        insert_query = """
            INSERT INTO nfl_games (id, game_date, game_time_epoch, game_week, season, espn_link, team_id_home, team_id_away, season_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        nfl_games = rapidapi_connection.get_nfl_games_list(year, 'all', 'all')
        for game in nfl_games:
            if game['seasonType'] != 'Preseason':
                id = game['gameID']
                game_date = game['gameDate']
                game_time_epoch = game['gameTime_epoch']
                game_week = game['gameWeek']
                season = game['season']
                espn_link = game['espnLink']
                team_id_home = game['teamIDHome']
                team_id_away = game['teamIDAway']
                season_type = game['seasonType']
                cursor.execute(insert_query, (id, game_date, game_time_epoch, game_week, season, espn_link, team_id_home, team_id_away, season_type,))

    conn.commit()
    cursor.close()
    
def populate_game_table_with_boxscores(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM nfl_games
            WHERE game_clock IS NOT NULL
        );
    """)
    has_data = cursor.fetchone()[0]
    if not has_data:
        cursor.execute("SELECT * FROM nfl_games")
        rows = dictfetchall(cursor)
        for game in rows:
            game_id = game['id']
            box_score = rapidapi_connection.get_nfl_box_score(game_id)
            game_status = box_score['gameStatus']
            home_pts = box_score['homePts']
            away_pts = box_score['awayPts']
            game_clock = box_score['gameClock']
            team_stats = json.dumps(box_score['teamStats'])
            scoring_plays = json.dumps(box_score['scoringPlays'])
            line_score = json.dumps(box_score['lineScore'])
            player_stats = json.dumps(box_score['playerStats'])
            dst = json.dumps(box_score['DST'])
            cursor.execute("""
                UPDATE nfl_games
                SET game_status = %s,
                    home_pts = %s,
                    away_pts = %s,
                    game_clock = %s,
                    team_stats = %s,
                    scoring_plays = %s,
                    line_score = %s,
                    player_stats = %s,
                    dst = %s
                WHERE id = %s
            """, (game_status, home_pts, away_pts, game_clock, team_stats, scoring_plays, line_score, player_stats, dst, game_id))

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
    create_nfl_games_table(conn)
    populate_game_table_with_boxscores(conn)
    conn.close()
