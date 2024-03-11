from flask import Blueprint

players_bp = Blueprint("players", __name__)


@players_bp.route("/")
def health_check():
    return "Players route up and running"


@players_bp.route("/get_players_and_stats")
def get_players_and_stats():
    pass
