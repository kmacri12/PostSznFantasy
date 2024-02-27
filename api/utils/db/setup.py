import os
import json
import re
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import connection, ISOLATION_LEVEL_AUTOCOMMIT
from api.utils.rapidapi.rapidapi import RapidApi
from api.utils.db.pg_utils import *


rapidapi_connection = RapidApi()


def create_nflteams_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "nfl_teams"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_teams (
            id SMALLINT PRIMARY KEY,
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


def create_nflplayers_table(conn:connection=get_pg_connection()):
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
            team_id SMALLINT,
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
            team_id = int(player['teamID'])
            jersey = player['jerseyNum'] if "jerseyNum" in player else ""
            birthday = player['bDay'] if "bDay" in player else "1/1/1900"
            height = player['height'] if "height" in player else "0'0\""
            weight = player['weight'] if "weight" in player else "0"
            exp = player['exp'] if 'exp' in player and player['exp'] != 'R' else "0"
            cursor.execute(insert_query, (id, name, pos, espnHeadshot, jersey, birthday, height, weight, exp, team_id,))
        cursor.execute("SELECT * FROM nfl_teams")
        teams = dictfetchall(cursor)
        dst_insert_query = """
            INSERT INTO nfl_players (id, name, position, team_id)
            VALUES (%s, %s, %s, %s)
        """
        for team in teams:
            id = team['id']
            name = team['team_name'] + " DST"
            pos = 'DST'
            team_id = team['id']
            cursor.execute(dst_insert_query, (id, name, pos, team_id,))

    
    conn.commit()
    cursor.close()


def create_nfl_games_table(conn:connection=get_pg_connection()):
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
            game_week SMALLINT,
            season SMALLINT,
            espn_link VARCHAR(255),
            team_id_home SMALLINT,
            team_id_away SMALLINT,
            home_pts SMALLINT,
            away_pts SMALLINT,
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
                week_number_str = game['gameWeek'].split()[-1]
                if week_number_str.isdigit():
                    game_week = int(week_number_str)
                elif game['gameWeek'] == 'Wild Card':
                    game_week = 1
                elif game['gameWeek'] == 'Divisional Round':
                    game_week = 2
                elif game['gameWeek'] == 'Conference Championship':
                    game_week = 3
                elif game['gameWeek'] == 'Super Bowl':
                    game_week = 4
                else:
                    game_week = 0
                season = int(game['season'])
                espn_link = game['espnLink']
                team_id_home = int(game['teamIDHome'])
                team_id_away = int(game['teamIDAway'])
                season_type = game['seasonType']
                cursor.execute(insert_query, (id, game_date, game_time_epoch, game_week, season, espn_link, team_id_home, team_id_away, season_type,))

    conn.commit()
    cursor.close()


def populate_game_table_with_boxscores(conn:connection=get_pg_connection()):
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
            home_pts = int(box_score['homePts'])
            away_pts = int(box_score['awayPts'])
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


def create_nfl_player_game_stats_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "nfl_player_game_stats"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_player_game_stats (
            game_id VARCHAR(255),
            player_id INT,
            passing_completions SMALLINT DEFAULT 0,
            passing_attempts SMALLINT DEFAULT 0,
            passing_yards SMALLINT DEFAULT 0,
            passing_touchdowns SMALLINT DEFAULT 0,
            passing_interceptions SMALLINT DEFAULT 0,
            passing_sacked SMALLINT DEFAULT 0,
            passing_sacked_yards SMALLINT DEFAULT 0,
            passing_two_point_conversions SMALLINT DEFAULT 0,
            rushing_carries SMALLINT DEFAULT 0,
            rushing_yards SMALLINT DEFAULT 0,
            rushing_touchdowns SMALLINT DEFAULT 0,
            rushing_long_rush SMALLINT DEFAULT 0,
            rushing_two_point_conversions SMALLINT DEFAULT 0,
            receiving_receptions SMALLINT DEFAULT 0,
            receiving_targets SMALLINT DEFAULT 0,
            receiving_yards SMALLINT DEFAULT 0,
            receiving_touchdowns SMALLINT DEFAULT 0,
            receiving_long_reception SMALLINT DEFAULT 0,
            receiving_two_point_conversions SMALLINT DEFAULT 0,
            carrying_fumbles SMALLINT DEFAULT 0,
            carrying_fumbles_lost SMALLINT DEFAULT 0,
            punt_return_yards SMALLINT DEFAULT 0,
            punt_return_td SMALLINT DEFAULT 0,
            kick_return_yards SMALLINT DEFAULT 0,
            kick_return_td SMALLINT DEFAULT 0,
            kicking_xp_made SMALLINT DEFAULT 0,
            kicking_xp_missed SMALLINT DEFAULT 0,
            kicking_fg_missed SMALLINT DEFAULT 0,
            kicking_fg_yards_made SMALLINT[],
            dst_yards_allowed SMALLINT DEFAULT 0,
            dst_points_allowed SMALLINT DEFAULT 0,
            dst_sacks SMALLINT DEFAULT 0,
            dst_def_td SMALLINT DEFAULT 0,
            dst_safeties SMALLINT DEFAULT 0,
            dst_fumbles_recovered SMALLINT DEFAULT 0,
            dst_interceptions SMALLINT DEFAULT 0,
            PRIMARY KEY (game_id, player_id),
            FOREIGN KEY (game_id) REFERENCES nfl_games (id),
            FOREIGN KEY (player_id) REFERENCES nfl_players (id)
        );          
        """)
        cursor.execute("""ALTER TABLE nfl_player_game_stats
                    ALTER COLUMN kicking_fg_yards_made SET DEFAULT '{}'""")
        cursor.execute("SELECT * FROM nfl_games")
        games = dictfetchall(cursor)
        for game in games:
            game_id = game['id']
            player_stats = game['player_stats']
            for player_id, stats in player_stats.items():

                passing_completions = int(stats.get("Passing", {}).get("passCompletions", 0))
                passing_attempts = int(stats.get("Passing", {}).get("passAttempts", 0))
                passing_yards = int(stats.get("Passing", {}).get("passYds", 0))
                passing_touchdowns = int(stats.get("Passing", {}).get("passTD", 0))
                passing_interceptions = int(stats.get("Passing", {}).get("int", 0))
                passing_sacked = int(stats.get("Passing", {}).get("sacked", "0-0").split('-')[0])
                passing_sacked_yards = int(stats.get("Passing", {}).get("sacked", "0-0").split('-')[1])
                passing_two_point_conversions = int(stats.get("Passing", {}).get("passingTwoPointConversion", 0))
                rushing_carries = int(stats.get("Rushing", {}).get("carries", 0))
                rushing_yards = int(stats.get("Rushing", {}).get("rushYds", 0))
                rushing_touchdowns = int(stats.get("Rushing", {}).get("rushTD", 0))
                rushing_long_rush = int(stats.get("Rushing", {}).get("longRush", 0))
                rushing_two_point_conversions = int(stats.get("Rushing", {}).get("rushingTwoPointConversion", 0))
                receiving_receptions = int(stats.get("Receiving", {}).get("receptions", 0))
                receiving_targets = int(stats.get("Receiving", {}).get("targets", 0))
                receiving_yards = int(stats.get("Receiving", {}).get("recYds", 0))
                receiving_touchdowns = int(stats.get("Receiving", {}).get("recTD", 0))
                receiving_long_reception = int(stats.get("Receiving", {}).get("longRec", 0))
                receiving_two_point_conversions = int(stats.get("Receiving", {}).get("receivingTwoPointConversion", 0))
                carrying_fumbles = int(stats.get("Defense", {}).get("fumbles", 0))
                carrying_fumbles_lost = int(stats.get("Defense", {}).get("fumblesLost", 0))
                punt_return_yards = int(stats.get("Punting", {}).get("puntReturnYds", 0))
                punt_return_td = int(stats.get("Punting", {}).get("puntReturnTD", 0))
                kick_return_yards = int(stats.get("Kicking", {}).get("kickReturnYds", 0))
                kick_return_td = int(stats.get("Kicking", {}).get("kickReturnTD", 0))
                kicking_xp_made = int(stats.get("Kicking", {}).get("xpMade", 0))
                kicking_xp_attempts = int(stats.get("Kicking", {}).get("xpAttempts", 0))
                kicking_xp_missed = kicking_xp_attempts - kicking_xp_made
                kicking_fg_made = int(stats.get("Kicking", {}).get("fgMade", 0))
                kicking_fg_attempts = int(stats.get("Kicking", {}).get("fgAttempts", 0))
                kicking_fg_missed = kicking_fg_attempts - kicking_fg_made

                kicking_fg_yards_made = []
                
                # Code for made kick yards
                if 'scoringPlays' in stats:
                    for play in stats['scoringPlays']:
                        if play.get('scoreType', None) == "FG":
                            yards = int(re.search(r'\d+', play.get('score','')).group())
                            kicking_fg_yards_made.append(yards)
                
                query = """
                    INSERT INTO nfl_player_game_stats (
                        game_id, player_id, passing_completions, passing_attempts, passing_yards, passing_touchdowns, passing_interceptions, passing_sacked, passing_sacked_yards, passing_two_point_conversions, rushing_carries, rushing_yards, rushing_touchdowns, rushing_long_rush, rushing_two_point_conversions, receiving_receptions, receiving_targets, receiving_yards, receiving_touchdowns, receiving_long_reception, receiving_two_point_conversions, carrying_fumbles, carrying_fumbles_lost, punt_return_yards, punt_return_td, kick_return_yards, kick_return_td, kicking_xp_made, kicking_xp_missed, kicking_fg_missed, kicking_fg_yards_made
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (game_id, player_id) DO UPDATE
                    SET
                        passing_completions = EXCLUDED.passing_completions,
                        passing_attempts = EXCLUDED.passing_attempts,
                        passing_yards = EXCLUDED.passing_yards,
                        passing_touchdowns = EXCLUDED.passing_touchdowns,
                        passing_interceptions = EXCLUDED.passing_interceptions,
                        passing_sacked = EXCLUDED.passing_sacked,
                        passing_sacked_yards = EXCLUDED.passing_sacked_yards,
                        passing_two_point_conversions = EXCLUDED.passing_two_point_conversions,
                        rushing_carries = EXCLUDED.rushing_carries,
                        rushing_yards = EXCLUDED.rushing_yards,
                        rushing_touchdowns = EXCLUDED.rushing_touchdowns,
                        rushing_long_rush = EXCLUDED.rushing_long_rush,
                        rushing_two_point_conversions = EXCLUDED.rushing_two_point_conversions,
                        receiving_receptions = EXCLUDED.receiving_receptions,
                        receiving_targets = EXCLUDED.receiving_targets,
                        receiving_yards = EXCLUDED.receiving_yards,
                        receiving_touchdowns = EXCLUDED.receiving_touchdowns,
                        receiving_long_reception = EXCLUDED.receiving_long_reception,
                        receiving_two_point_conversions = EXCLUDED.receiving_two_point_conversions,
                        carrying_fumbles = EXCLUDED.carrying_fumbles,
                        carrying_fumbles_lost = EXCLUDED.carrying_fumbles_lost,
                        punt_return_yards = EXCLUDED.punt_return_yards,
                        punt_return_td = EXCLUDED.punt_return_td,
                        kick_return_yards = EXCLUDED.kick_return_yards,
                        kick_return_td = EXCLUDED.kick_return_td,
                        kicking_xp_made = EXCLUDED.kicking_xp_made,
                        kicking_xp_missed = EXCLUDED.kicking_xp_missed,
                        kicking_fg_missed = EXCLUDED.kicking_fg_missed,
                        kicking_fg_yards_made = EXCLUDED.kicking_fg_yards_made
                    """
                values = (
                        game_id, player_id, passing_completions, passing_attempts, passing_yards, passing_touchdowns, passing_interceptions, passing_sacked, passing_sacked_yards, passing_two_point_conversions, rushing_carries, rushing_yards, rushing_touchdowns, rushing_long_rush, rushing_two_point_conversions, receiving_receptions, receiving_targets, receiving_yards, receiving_touchdowns, receiving_long_reception, receiving_two_point_conversions, carrying_fumbles, carrying_fumbles_lost, punt_return_yards, punt_return_td, kick_return_yards, kick_return_td, kicking_xp_made, kicking_xp_missed, kicking_fg_missed, kicking_fg_yards_made
                    )
                cursor.execute(query, values)


                conn.commit()



            if 'dst' in game:
                dst = game['dst']
                for home_away, stats in dst.items():
                    player_id = stats.get('teamID', None)
                    if player_id:
                        dst_yards_allowed = int(stats.get('ydsAllowed', 0))
                        dst_points_allowed = int(stats.get('ptsAllowed', 0))
                        dst_sacks = int(stats.get('sacks', 0))
                        dst_def_td = int(stats.get('defTD', 0))
                        dst_safeties = int(stats.get('safeties', 0))
                        dst_fumbles_recovered = int(stats.get('fumblesRecovered', 0))
                        dst_interceptions = int(stats.get('defensiveInterceptions', 0))
                        cursor.execute("""
                            INSERT INTO nfl_player_game_stats (
                                game_id, player_id, dst_yards_allowed, dst_points_allowed, dst_sacks, dst_def_td,
                                dst_safeties, dst_fumbles_recovered, dst_interceptions
                            )
                            VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )

                            ON CONFLICT (game_id, player_id) DO UPDATE
                            SET
                                dst_yards_allowed = EXCLUDED.dst_yards_allowed,
                                dst_points_allowed = EXCLUDED.dst_points_allowed,
                                dst_sacks = EXCLUDED.dst_sacks,
                                dst_def_td = EXCLUDED.dst_def_td,
                                dst_safeties = EXCLUDED.dst_safeties,
                                dst_fumbles_recovered = EXCLUDED.dst_fumbles_recovered,
                                dst_interceptions = EXCLUDED.dst_interceptions
                        """, (
                            game_id, player_id, dst_yards_allowed, dst_points_allowed, dst_sacks, dst_def_td,
                            dst_safeties, dst_fumbles_recovered, dst_interceptions
                        ))

                        conn.commit()
                

        conn.commit()
        cursor.close()


def create_nfl_player_season_stats_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "nfl_player_season_stats"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS nfl_player_season_stats (
            season VARCHAR(255),
            player_id INT,
            passing_completions SMALLINT DEFAULT 0,
            passing_attempts SMALLINT DEFAULT 0,
            passing_yards SMALLINT DEFAULT 0,
            passing_touchdowns SMALLINT DEFAULT 0,
            passing_interceptions SMALLINT DEFAULT 0,
            passing_sacked SMALLINT DEFAULT 0,
            passing_sacked_yards SMALLINT DEFAULT 0,
            passing_two_point_conversions SMALLINT DEFAULT 0,
            rushing_carries SMALLINT DEFAULT 0,
            rushing_yards SMALLINT DEFAULT 0,
            rushing_touchdowns SMALLINT DEFAULT 0,
            rushing_long_rush SMALLINT DEFAULT 0,
            rushing_two_point_conversions SMALLINT DEFAULT 0,
            receiving_receptions SMALLINT DEFAULT 0,
            receiving_targets SMALLINT DEFAULT 0,
            receiving_yards SMALLINT DEFAULT 0,
            receiving_touchdowns SMALLINT DEFAULT 0,
            receiving_long_reception SMALLINT DEFAULT 0,
            receiving_two_point_conversions SMALLINT DEFAULT 0,
            carrying_fumbles SMALLINT DEFAULT 0,
            carrying_fumbles_lost SMALLINT DEFAULT 0,
            punt_return_yards SMALLINT DEFAULT 0,
            punt_return_td SMALLINT DEFAULT 0,
            kick_return_yards SMALLINT DEFAULT 0,
            kick_return_td SMALLINT DEFAULT 0,
            kicking_xp_made SMALLINT DEFAULT 0,
            kicking_xp_missed SMALLINT DEFAULT 0,
            kicking_fg_missed SMALLINT DEFAULT 0,
            kicking_fg_yards_made SMALLINT[],
            dst_yards_allowed SMALLINT DEFAULT 0,
            dst_points_allowed SMALLINT DEFAULT 0,
            dst_sacks SMALLINT DEFAULT 0,
            dst_def_td SMALLINT DEFAULT 0,
            dst_safeties SMALLINT DEFAULT 0,
            dst_fumbles_recovered SMALLINT DEFAULT 0,
            dst_interceptions SMALLINT DEFAULT 0,
            PRIMARY KEY (season, player_id),
            FOREIGN KEY (player_id) REFERENCES nfl_players (id)
        );
        """)
        cursor.execute("""ALTER TABLE nfl_player_season_stats
                    ALTER COLUMN kicking_fg_yards_made SET DEFAULT '{}'""")
        cursor.execute("SELECT * FROM nfl_player_game_stats")
        player_games = dictfetchall(cursor)
        for player_game in player_games:
            cursor.execute("SELECT season FROM nfl_games WHERE id = %s", (player_game['game_id'],))
            player_game['season'] = cursor.fetchone()[0]
            del player_game['game_id']

            sql = """INSERT INTO nfl_player_season_stats (
                season, player_id, passing_completions, passing_attempts, passing_yards, passing_touchdowns,
                passing_interceptions, passing_sacked, passing_sacked_yards, passing_two_point_conversions,
                rushing_carries, rushing_yards, rushing_touchdowns, rushing_long_rush, rushing_two_point_conversions,
                receiving_receptions, receiving_targets, receiving_yards, receiving_touchdowns, receiving_long_reception,
                receiving_two_point_conversions, carrying_fumbles, carrying_fumbles_lost, punt_return_yards, punt_return_td,
                kick_return_yards, kick_return_td, kicking_xp_made, kicking_xp_missed, kicking_fg_missed, kicking_fg_yards_made,
                dst_yards_allowed, dst_points_allowed, dst_sacks, dst_def_td, dst_safeties, dst_fumbles_recovered, dst_interceptions
            )
            VALUES (
                %(season)s, %(player_id)s, %(passing_completions)s, %(passing_attempts)s, %(passing_yards)s, %(passing_touchdowns)s,
                %(passing_interceptions)s, %(passing_sacked)s, %(passing_sacked_yards)s, %(passing_two_point_conversions)s,
                %(rushing_carries)s, %(rushing_yards)s, %(rushing_touchdowns)s, %(rushing_long_rush)s, %(rushing_two_point_conversions)s,
                %(receiving_receptions)s, %(receiving_targets)s, %(receiving_yards)s, %(receiving_touchdowns)s, %(receiving_long_reception)s,
                %(receiving_two_point_conversions)s, %(carrying_fumbles)s, %(carrying_fumbles_lost)s, %(punt_return_yards)s, %(punt_return_td)s,
                %(kick_return_yards)s, %(kick_return_td)s, %(kicking_xp_made)s, %(kicking_xp_missed)s, %(kicking_fg_missed)s, %(kicking_fg_yards_made)s,
                %(dst_yards_allowed)s, %(dst_points_allowed)s, %(dst_sacks)s, %(dst_def_td)s, %(dst_safeties)s, %(dst_fumbles_recovered)s, %(dst_interceptions)s
            )
            ON CONFLICT (season, player_id) DO UPDATE
            SET
                passing_completions = nfl_player_season_stats.passing_completions + EXCLUDED.passing_completions,
                passing_attempts = nfl_player_season_stats.passing_attempts + EXCLUDED.passing_attempts,
                passing_yards = nfl_player_season_stats.passing_yards + EXCLUDED.passing_yards,
                passing_touchdowns = nfl_player_season_stats.passing_touchdowns + EXCLUDED.passing_touchdowns,
                passing_interceptions = nfl_player_season_stats.passing_interceptions + EXCLUDED.passing_interceptions,
                passing_sacked = nfl_player_season_stats.passing_sacked + EXCLUDED.passing_sacked,
                passing_sacked_yards = nfl_player_season_stats.passing_sacked_yards + EXCLUDED.passing_sacked_yards,
                passing_two_point_conversions = nfl_player_season_stats.passing_two_point_conversions + EXCLUDED.passing_two_point_conversions,
                rushing_carries = nfl_player_season_stats.rushing_carries + EXCLUDED.rushing_carries,
                rushing_yards = nfl_player_season_stats.rushing_yards + EXCLUDED.rushing_yards,
                rushing_touchdowns = nfl_player_season_stats.rushing_touchdowns + EXCLUDED.rushing_touchdowns,
                rushing_long_rush = GREATEST(nfl_player_season_stats.rushing_long_rush, EXCLUDED.rushing_long_rush),
                rushing_two_point_conversions = nfl_player_season_stats.rushing_two_point_conversions + EXCLUDED.rushing_two_point_conversions,
                receiving_receptions = nfl_player_season_stats.receiving_receptions + EXCLUDED.receiving_receptions,
                receiving_targets = nfl_player_season_stats.receiving_targets + EXCLUDED.receiving_targets,
                receiving_yards = nfl_player_season_stats.receiving_yards + EXCLUDED.receiving_yards,
                receiving_touchdowns = nfl_player_season_stats.receiving_touchdowns + EXCLUDED.receiving_touchdowns,
                receiving_long_reception = GREATEST(nfl_player_season_stats.rushing_long_rush, EXCLUDED.rushing_long_rush),
                receiving_two_point_conversions = nfl_player_season_stats.receiving_two_point_conversions + EXCLUDED.receiving_two_point_conversions,
                carrying_fumbles = nfl_player_season_stats.carrying_fumbles + EXCLUDED.carrying_fumbles,
                carrying_fumbles_lost = nfl_player_season_stats.carrying_fumbles_lost + EXCLUDED.carrying_fumbles_lost,
                punt_return_yards = nfl_player_season_stats.punt_return_yards + EXCLUDED.punt_return_yards,
                punt_return_td = nfl_player_season_stats.punt_return_td + EXCLUDED.punt_return_td,
                kick_return_yards = nfl_player_season_stats.kick_return_yards + EXCLUDED.kick_return_yards,
                kick_return_td = nfl_player_season_stats.kick_return_td + EXCLUDED.kick_return_td,
                kicking_xp_made = nfl_player_season_stats.kicking_xp_made + EXCLUDED.kicking_xp_made,
                kicking_xp_missed = nfl_player_season_stats.kicking_xp_missed + EXCLUDED.kicking_xp_missed,
                kicking_fg_missed = nfl_player_season_stats.kicking_fg_missed + EXCLUDED.kicking_fg_missed,
                kicking_fg_yards_made = ARRAY(
                    SELECT DISTINCT UNNEST(array_cat(nfl_player_season_stats.kicking_fg_yards_made, EXCLUDED.kicking_fg_yards_made))
                ),
                dst_yards_allowed = nfl_player_season_stats.dst_yards_allowed + EXCLUDED.dst_yards_allowed,
                dst_points_allowed = nfl_player_season_stats.dst_points_allowed + EXCLUDED.dst_points_allowed,
                dst_sacks = nfl_player_season_stats.dst_sacks + EXCLUDED.dst_sacks,
                dst_def_td = nfl_player_season_stats.dst_def_td + EXCLUDED.dst_def_td,
                dst_safeties = nfl_player_season_stats.dst_safeties + EXCLUDED.dst_safeties,
                dst_fumbles_recovered = nfl_player_season_stats.dst_fumbles_recovered + EXCLUDED.dst_fumbles_recovered,
                dst_interceptions = nfl_player_season_stats.dst_interceptions + EXCLUDED.dst_interceptions
            ;"""

            cursor.execute(sql, player_game)
            conn.commit()


def create_users_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "users"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(20) UNIQUE NOT NULL,
            email VARCHAR(64) UNIQUE NOT NULL,
            password_hash VARCHAR(512) NOT NULL
        );
        """)
    conn.commit()
    cursor.close()


def create_leagues_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "leagues"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS leagues (
            id SERIAL PRIMARY KEY,
            name VARCHAR(20) UNIQUE NOT NULL,
            commissioner_id INT UNIQUE NOT NULL
        );
        """)
    conn.commit()
    cursor.close()


def create_teams_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "teams"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS teams (
            id SERIAL PRIMARY KEY,
            name VARCHAR(20),
            owner_id INT,
            league_id INT NOT NULL,
            roster INT[],
            FOREIGN KEY (owner_id) REFERENCES users (id),
            FOREIGN KEY (league_id) REFERENCES leagues (id)
        );
        """)
    conn.commit()
    cursor.close()


def create_league_settings_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "league_settings"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS league_settings (
            id SERIAL PRIMARY KEY,
            league_id INT NOT NULL,
            number_teams INT NOT NULL,
            roster_num_qb INT NOT NULL,
            roster_num_rb INT NOT NULL,
            roster_num_wr INT NOT NULL,
            roster_num_te INT NOT NULL,
            roster_num_flex_wr_rb_te INT NOT NULL,
            roster_num_flex_wr_rb INT NOT NULL,
            roster_num_flex_wr_te INT NOT NULL,
            roster_num_flex_qb_wr_rb_te INT NOT NULL,
            roster_num_k INT NOT NULL,
            roster_num_dst INT NOT NULL,
            roster_num_total_size INT NOT NULL,
            roster_max_qb INT,
            roster_max_rb INT,
            roster_max_wr INT,
            roster_max_te INT,
            roster_max_k INT,
            roster_max_dst INT,
            scoring_passing_yard INT,
            scoring_passing_td INT,
            scoring_passing_2pt INT,
            scoring_passing_interception INT,
            scoring_passing_completion INT,
            scoring_passing_attempt INT,
            scoring_passing_sack INT,
            scoring_rushing_yard INT,
            scoring_rushing_td INT,
            scoring_rushing_2pt INT,
            scoring_rushing_attempt INT,
            scoring_receiving_reception INT,
            scoring_receiving_yard INT,
            scoring_receiving_td INT,
            scoring_receiving_2pt INT,
            scoring_receiving_target INT,
            scoring_receiving_reception_bonus_RB INT,
            scoring_receiving_reception_bonus_WR INT,
            scoring_receiving_reception_bonus_TE INT,
            scoring_carrying_fumble INT,
            scoring_carrying_fumble_lost INT,
            scoring_special_punt_return_yard INT,
            scoring_special_punt_return_td INT,
            scoring_special_kick_return_yard INT,
            scoring_special_kick_return_td INT,
            scoring_kicking_fg_made INT,
            scoring_kicking_fg_miss INT,
            scoring_kicking_fg_made_0_19 INT,
            scoring_kicking_fg_made_20_29 INT,
            scoring_kicking_fg_made_30_39 INT,
            scoring_kicking_fg_made_40_49 INT,
            scoring_kicking_fg_made_50_plus INT,
            scoring_kicking_fg_yard INT,
            scoring_kicking_xp_made INT,
            scoring_kicking_xp_miss INT,
            scoring_dst_td INT,
            scoring_dst_pts_allowed_0 INT,
            scoring_dst_pts_allowed_1_6 INT,
            scoring_dst_pts_allowed_7_13 INT,
            scoring_dst_pts_allowed_14_20 INT,
            scoring_dst_pts_allowed_21_27 INT,
            scoring_dst_pts_allowed_28_34 INT,
            scoring_dst_pts_allowed_35_plus INT,
            scoring_dst_yards_allowed_under_100 INT,
            scoring_dst_yards_allowed_100_199 INT,
            scoring_dst_yards_allowed_200_299 INT,
            scoring_dst_yards_allowed_300_399 INT,
            scoring_dst_yards_allowed_400_499 INT,
            scoring_dst_yards_allowed_500_plus INT,
            scoring_dst_sack INT,
            scoring_dst_safety INT,
            scoring_dst_fumble_recover INT,
            scoring_dst_interception INT,
            FOREIGN KEY (league_id) REFERENCES leagues (id)
                       
        );
        """)
    conn.commit()
    cursor.close()


def create_drafts_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "drafts"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS drafts (
            id SERIAL PRIMARY KEY,
            league_id INT NOT NULL,
            status VARCHAR(20),
            start_time_epoch VARCHAR(255),
            draft_type VARCHAR(20),
            time_per_pick_seconds INT,
            slow_draft_auto_pause BOOLEAN,
            slow_draft_pause_from TIME,
            slow_draft_pause_to TIME,
            slow_draft_pause_timezone VARCHAR(20),
            cpu_autopick BOOLEAN,
            alphabetical_sort BOOLEAN,
            draft_order_team_ids INT[],
            FOREIGN KEY (league_id) REFERENCES leagues (id)
        );
        """)
    conn.commit()
    cursor.close()


def create_draft_picks_table(conn:connection=get_pg_connection()):
    cursor = conn.cursor()
    if not table_exists(conn, "draft_picks"):
        cursor.execute("""CREATE TABLE IF NOT EXISTS draft_picks (
            id SERIAL PRIMARY KEY,
            draft_id INT NOT NULL,
            team_id INT NOT NULL,
            player_id INT NOT NULL,
            number_round INT,
            number_pick_overall INT,
            number_pick_in_round INT,
            autopick BOOLEAN,
            FOREIGN KEY (draft_id) REFERENCES drafts (id),
            FOREIGN KEY (team_id) REFERENCES teams (id),
            FOREIGN KEY (player_id) REFERENCES nfl_players (id)
        );
        """)
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
    conn = get_pg_connection()
    create_nflteams_table(conn)
    create_nflplayers_table(conn)
    create_nfl_games_table(conn)
    populate_game_table_with_boxscores(conn)
    create_nfl_player_game_stats_table(conn)
    create_nfl_player_season_stats_table(conn)
    create_users_table(conn)
    create_leagues_table(conn)
    create_teams_table(conn)
    create_league_settings_table(conn)
    create_drafts_table(conn)
    create_draft_picks_table(conn)
    conn.close()
