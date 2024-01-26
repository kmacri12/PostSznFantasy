from flask import Blueprint
import os
import json
from api.utils.rapidapi.rapidapi import RapidApi

players_bp = Blueprint("players", __name__)


@players_bp.route("/")
def health_check():
    return "Players route up and running"


@players_bp.route("/get_players_and_stats")
def get_players_and_stats():
    filepath = os.path.join(os.getcwd(), "api/data/nflPlayersAndStats.json")
    if not os.path.exists(filepath):
        rapidapi = RapidApi()
        # get players and stats json
        # for teamnum in [1-32]
        rapidapi

    with open(filepath, "r") as f:
        data = json.load(f)
