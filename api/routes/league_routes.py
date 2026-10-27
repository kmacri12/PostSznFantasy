import logging
from datetime import UTC, datetime, timedelta

from api.models.league_models import LeaguesByUser, Standings, TeamSimple
from api.utils.calculations.standings_utils import (
    get_players_left,
    get_team_fantasy_points_by_week,
)
from api.utils.db.models import Draft, League, LeagueSettings, Team, User, db
from api.utils.security.firebase import token_required
from flask import Blueprint, jsonify, request

league_bp = Blueprint("league", __name__)
logger = logging.getLogger(__name__)


@league_bp.route("/")
def health():
    """Health check"""
    return "healthy"


@league_bp.route("/create-league", methods=["POST"])
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
        new_league = League(name=league_name, commissioner_id=user.id)
        db.session.add(new_league)
        db.session.commit()

        # Create league settings
        league_settings = LeagueSettings(
            league_id=new_league.id,
            **roster_settings,  # Unpack roster settings
            **scoring_settings,  # Unpack scoring settings
        )
        db.session.add(league_settings)

        # Create default teams
        new_teams = []
        for i in range(number_of_teams):
            new_team = Team(
                name=f"Team {i + 1}",
                owner_id=None if i != 0 else user.id,
                league_id=new_league.id,
            )
            new_teams.append(new_team)
            db.session.add(new_team)
        db.session.commit()

        # Create default draft
        new_draft = Draft(
            league_id=new_league.id,
            status="Scheduled",
            start_time=datetime.now(UTC) + timedelta(days=7),
            draft_type="snake",
            time_per_pick_seconds=60,
            alphabetical_sort=False,
            draft_order_team_ids=[team.id for team in new_teams],
        )
        db.session.add(new_draft)

        db.session.commit()

        return jsonify(
            {
                "message": f"League '{league_name}' created successfully by user {user_id}!"
            }
        ), 201

    except Exception:
        db.session.rollback()
        logger.exception("Error creating league")
        return jsonify({"error": "Error creating league"}), 500


@league_bp.route("/get_leagues_by_user", methods=["GET"])
@token_required
def get_leagues_by_user(user_id: int) -> list[LeaguesByUser]:
    try:
        user = User.query.filter_by(firebase_uid=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        teams = Team.query.filter_by(owner_id=user.id).all()

        leagues_by_user = [
            LeaguesByUser(
                id=team.league.id,
                name=team.league.name,
                commissioner_id=team.league.commissioner_id,
                user_team_id=team.id,
            )
            for team in teams
        ]

        return jsonify([league.model_dump() for league in leagues_by_user]), 200

    except Exception:
        logger.exception("Error getting leagues")
        return jsonify({"error": "Error getting leagues"}), 500


@league_bp.route("/<league_id>/standings", methods=["GET"])
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
            wild_card_points = get_team_fantasy_points_by_week(
                team.id, league_id, "wildcard"
            )
            divisional_points = get_team_fantasy_points_by_week(
                team.id, league_id, "divisional"
            )
            conference_points = get_team_fantasy_points_by_week(
                team.id, league_id, "conference"
            )
            super_bowl_points = get_team_fantasy_points_by_week(
                team.id, league_id, "superbowl"
            )
            total_points = sum(
                [
                    wild_card_points,
                    divisional_points,
                    conference_points,
                    super_bowl_points,
                ]
            )

            standings.append(
                Standings(
                    team_name=team.name,
                    owner=User.query.get(team.owner_id).username
                    if team.owner_id
                    else "N/A",
                    players_left=get_players_left(team.id, league_id),
                    wild_card=wild_card_points,
                    divisional=divisional_points,
                    conf_champ=conference_points,
                    super_bowl=super_bowl_points,
                    total=total_points,
                )
            )

        # Sort standings by total points
        standings.sort(key=lambda x: x.total, reverse=True)

        return jsonify([s.model_dump() for s in standings]), 200

    except Exception:
        logger.exception("Error getting standings")
        return jsonify({"error": "Error getting standings"}), 500


@league_bp.route("/<league_id>/teams", methods=["GET"])
@token_required
def get_teams(league_id, user_id):
    try:
        league = League.query.get(league_id)
        if not league:
            return jsonify({"error": "League not found"}), 404
        teams = [
            TeamSimple(
                id=team.id,
                name=team.name,
                owner_id=team.owner.id if team.owner else -1,
                owner_name=team.owner.username if team.owner else "No Owner",
            ).model_dump()
            for team in league.teams
        ]

        return teams, 200

    except Exception:
        logger.exception("Error getting teams")
        return jsonify({"error": "Error getting teams"}), 500


@league_bp.route("/<league_id>/settings", methods=["GET"])
@token_required
def get_league_settings(league_id, user_id):
    try:
        league_settings = LeagueSettings.query.filter_by(league_id=league_id).first()
        if not league_settings:
            return jsonify({"error": "League Settings not found"}), 404

        return jsonify(league_settings.to_dict()), 200

    except Exception:
        logger.exception("Error getting settings")
        return jsonify({"error": "Error getting settings"}), 500
