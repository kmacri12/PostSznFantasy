from flask import Blueprint, jsonify
from sqlalchemy.orm import joinedload
from api.utils.db.models import NFLPlayer, NFLPlayerSeasonStats

players_bp = Blueprint("players", __name__)


@players_bp.route("/")
def health_check():
    return "Players route up and running"


@players_bp.route("/player-season-stats", methods=["GET"])
def get_players_and_stats():
    position_list = ["QB", "RB", "FB", "WR", "TE", "PK", "DST"]
    stats = NFLPlayerSeasonStats.query.options(
        joinedload(NFLPlayerSeasonStats.player).joinedload(NFLPlayer.team)
    ).join(NFLPlayer).filter(NFLPlayer.position.in_(position_list)).all()
    stats_dict = []
    for stat in stats:
        stat_dict = stat.to_dict()
        stat_dict['player'] = stat.player.to_dict()
        stat_dict['player']['team'] = stat.player.team.to_dict()

        stats_dict.append(stat_dict)
    return jsonify(stats_dict)
