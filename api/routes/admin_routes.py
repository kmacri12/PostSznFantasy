import logging
import os
import json
from flask import Blueprint
from api.utils.rapidapi.rapidapi import RapidApi
from api.utils.data_utils import join_nfl_player_list_and_team_with_stats
from api.utils.pg import setup

admin_bp = Blueprint("admin", __name__)
logger = logging.getLogger(__name__)

@admin_bp.route("/")
def health():
    """health chek"""
    return "healthy"


@admin_bp.route("/setup/pgdb", methods=["PUT"])
def setup_pgdb():
    setup.setup_postgres()
    return "PostgresDB Setup"


@admin_bp.route("/update/nfl_players", methods=["PUT"])
def update_players():
    rapidapi = RapidApi()
    players = rapidapi.update_players()

    """update nfl player data with latest"""
    return players


@admin_bp.route("/update/nfl_players_and_stats", methods=["PUT"])
def update_nfl_players_and_stats():
    try:
        rapidapi = RapidApi()

        # get current players
        playerlist_filepath = os.path.join(os.getcwd(), "api/data/NflPlayerList.json")
        if not os.path.exists(playerlist_filepath):
            players = rapidapi.update_players()
        else:
            with open(playerlist_filepath, "r") as f:
                players = json.load(f)
        nflteams_filepath = os.path.join(os.getcwd(), "api/data/nflTeams.json")
        with open(nflteams_filepath, "r") as f:
            teams = json.load(f)
        teamstats = []
        for team in teams:
            stats = rapidapi.get_stats_for_team(team["teamID"], team["teamAbv"])
            teamstats.extend(stats)
        data = join_nfl_player_list_and_team_with_stats(players, teamstats)

        with open(playerlist_filepath, "w") as f:
            json.dump(data, f)


        """update nfl player data with latest"""
        return players
    except Exception:
        logger.exception("Exception caught while updating nfl players with their stats")
        return [] 
