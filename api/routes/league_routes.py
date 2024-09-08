from functools import wraps
import os
import logging
from flask import Blueprint, request, jsonify
from api.utils.db.models import db, League, LeagueSettings, Team, User
from firebase_admin import credentials, auth

# Initialize Firebase Admin SDK
service_account_key_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
cred = credentials.Certificate(service_account_key_path)

league_bp = Blueprint("league", __name__)
logger = logging.getLogger(__name__)


@league_bp.route("/")
def health():
    """Health check"""
    return "healthy"


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            token = token.split(" ", 1)[1] if token else None
            decoded_token = auth.verify_id_token(token)
            user_id = decoded_token["uid"]
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        return f(user_id, *args, **kwargs)

    return decorated



@league_bp.route("/create_league", methods=["POST"])
@token_required
def create_league(user_id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    league_name = data.get("leagueName")
    number_of_teams = int(data.get("rosterSettings", {}).get("numberTeams", 0))
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
                owner_id=user_id,
                league_id=new_league.id
            )
            db.session.add(new_team)

        db.session.commit()

        return jsonify({"message": f"League '{league_name}' created successfully by user {user_id}!"}), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error creating league")
        return jsonify({"error": "Error creating league"}), 500
