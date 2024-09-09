import logging
from flask import Blueprint, request, jsonify
from api.utils.db.models import db, League, LeagueSettings, Team, User, TeamStandings
from api.utils.security.firebase import token_required

league_bp = Blueprint("league", __name__)
logger = logging.getLogger(__name__)


@league_bp.route("/")
def health():
    """Health check"""
    return "healthy"


@league_bp.route("/create_league", methods=["POST"])
@token_required
def create_league(user_id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    league_name = data.get("leagueName")
    number_of_teams = int(data.get("rosterSettings", {}).get("number_teams", 0))
    roster_settings = data.get("rosterSettings")
    scoring_settings = data.get("scoringSettings")

    if not league_name or not number_of_teams:
        return jsonify({"error": "League name and number of teams are required"}), 400

    try:
        # Get the user from the firebase_uid
        user = User.query.filter_by(firebase_uid=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Create the league
        new_league = League(
            name=league_name,
            commissioner_id=user.id
        )
        db.session.add(new_league)
        db.session.commit()

        # Create league settings
        league_settings = LeagueSettings(
            league_id=new_league.id,
            **roster_settings,  # Unpack roster settings
            **scoring_settings  # Unpack scoring settings
        )
        db.session.add(league_settings)

        # Create default teams
        for i in range(number_of_teams):
            new_team = Team(
                name=f"Team {i + 1}",
                owner_id=None if i != 0 else user.id,
                league_id=new_league.id
            )
            db.session.add(new_team)

        db.session.commit()

        return jsonify({"message": f"League '{league_name}' created successfully by user {user_id}!"}), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error creating league")
        return jsonify({"error": "Error creating league"}), 500


@league_bp.route("/get_leagues_by_user", methods=["GET"])
@token_required
def get_leagues_by_user(user_id):
    try:
        # Get the user from the firebase_uid
        user = User.query.filter_by(firebase_uid=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Get all teams owned by the user
        teams = Team.query.filter_by(owner_id=user.id).all()

        # Get the leagues associated with those teams
        leagues = [team.league for team in teams]

        # Prepare the leagues data to return
        leagues_data = [
            {"id": league.id, "name": league.name} for league in leagues
        ]

        return jsonify({"leagues": leagues_data}), 200

    except Exception as e:
        logger.exception("Error getting leagues")
        return jsonify({"error": "Error getting leagues"}), 500


@league_bp.route("/get_standings/<int:league_id>", methods=["GET"])
@token_required
def get_standings(league_id, user_id):
    try:
        # Get the league
        league = League.query.get(league_id)
        if not league:
            return jsonify({"error": "League not found"}), 404

        # Get all teams in the league
        teams = Team.query.filter_by(league_id=league_id).all()

        # Calculate standings based on some criteria, e.g., Total points
        standings = []
        for team in teams:
            wild_card_points = get_wild_card_points(team.id, league_id)
            divisional_points = get_divisional_points(team.id, league_id)
            conference_points = get_conf_champ_points(team.id, league_id)
            super_bowl_points = get_super_bowl_points(team.id, league_id)
            total_points = sum(wild_card_points, divisional_points, conference_points, super_bowl_points)

            standings.append({
                "team_name": team.name,
                "owner": User.query.get(team.owner_id).username if team.owner_id else "N/A",
                "players_left": get_players_left(team.id, league_id),  # Placeholder function
                "wild_card": wild_card_points,  # Placeholder function
                "divisional": divisional_points,  # Placeholder function
                "conf_champ": conference_points,  # Placeholder function
                "super_bowl": super_bowl_points,  # Placeholder function
                "total": total_points
            })

        # Sort standings by total points
        standings.sort(key=lambda x: x["total"], reverse=True)

        # Assign rank based on sorted standings
        for rank, standing in enumerate(standings, start=1):
            standing["rank"] = rank

        return jsonify({"standings": standings}), 200

    except Exception as e:
        logger.exception("Error getting standings")
        return jsonify({"error": "Error getting standings"}), 500
