from api.models.players_models import Player
from api.utils.db.models import NFLPlayer, NFLPlayerSeasonStats
from flask import Blueprint, jsonify
from sqlalchemy.orm import joinedload

players_bp = Blueprint("players", __name__)


@players_bp.route("/")
def health_check():
    return "Players route up and running"


@players_bp.route("/player-season-stats", methods=["GET"])
def get_players_and_stats():
    position_list = ["QB", "RB", "FB", "WR", "TE", "PK", "DST"]
    stats = (
        NFLPlayerSeasonStats.query.options(
            joinedload(NFLPlayerSeasonStats.player).joinedload(NFLPlayer.team)
        )
        .join(NFLPlayer)
        .filter(NFLPlayer.position.in_(position_list))
        .all()
    )
    stats_dict = []
    for stat in stats:
        stat_dict = stat.to_dict()
        stat_dict["player"] = stat.player.to_dict()
        stat_dict["player"]["team"] = stat.player.team.to_dict()

        stats_dict.append(stat_dict)
    return jsonify(stats_dict)


@players_bp.route("/player-list", methods=["GET"])
def get_player_list():
    position_list = ["QB", "RB", "FB", "WR", "TE", "PK", "DST"]
    players_from_db = NFLPlayer.query.filter(
        NFLPlayer.position.in_(position_list)
    ).all()
    player_list = [
        Player(
            id=player.id,
            name=player.name,
            position=player.position,
            team_abv=player.team.team_abv,
        ).model_dump()
        for player in players_from_db
    ]

    return player_list
