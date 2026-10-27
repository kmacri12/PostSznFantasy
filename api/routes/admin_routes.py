import logging

from api.utils.db import setup, update
from flask import Blueprint

admin_bp = Blueprint("admin", __name__)
logger = logging.getLogger(__name__)


@admin_bp.route("/")
def health():
    """health check"""
    return "healthy"


@admin_bp.route("/setup/pgdb", methods=["POST", "PUT"])
def setup_pgdb():
    try:
        setup.setup_postgres()
        return "PostgresDB Setup"
    except Exception:
        logger.exception("Exception caught while setting up postgres")


@admin_bp.route("/update/nfl_players", methods=["POST", "PUT"])
def update_players():
    try:
        update.update_nflplayers_table()

        """update nfl player data with latest"""
        return "Updated"

    except Exception:
        logger.exception("Exception caught while updating nfl players")


@admin_bp.route("/update/nfl_players_and_stats", methods=["POST", "PUT"])
def update_nfl_players_and_stats():
    try:
        update.update_nfl_player_game_stats_table()
        """update nfl player stats data with latest"""
        return "Updated"
    except Exception:
        logger.exception("Exception caught while updating nfl players with their stats")
