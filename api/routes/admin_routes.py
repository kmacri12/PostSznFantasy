from flask import Blueprint
from api.utils.rapidapi.rapidapi import RapidApi

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/")
def health():
    """health chek"""
    return True


@admin_bp.route("/update/nfl_players", methods=["PUT"])
def update_players():
    rapidapi = RapidApi()
    players = rapidapi.update_players()

    """update nfl player data with latest"""
    return players


@admin_bp.route("/update/nfl_players_and_stats", methods=["PUT"])
def nfl_players_and_stats():
    rapidapi = RapidApi()
    players = rapidapi.update_players_and_stats()

    """update nfl player data with latest"""
    return players
