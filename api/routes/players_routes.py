import os
from flask import Blueprint
from api.utils.db.models import NFLPlayerSeasonStats
from api.app import db

players_bp = Blueprint("players", __name__)


@players_bp.route("/")
def health_check():
    return "Players route up and running"


@players_bp.route("/get_player_season_stats")
def get_players_and_stats(
    season_year=os.getenv("SEASON_YEAR"),
    position_list=["QB", "RB", "FB", "WR", "TE", "PK", "DST"],
):
    session = db.session  # Accessing the db object
    stats = NFLPlayerSeasonStats.get_stats_by_positions(session, position_list)
    return stats
