import logging

from api.app import db
from api.utils.db.models import User
from api.utils.security.firebase import get_firebase_app
from firebase_admin import auth
from flask import Blueprint, jsonify, request

user_bp = Blueprint("user", __name__)
logger = logging.getLogger(__name__)


@user_bp.route("/")
def profile():
    return "User"


@user_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    token = data.get("token")

    if not token:
        return jsonify({"error": "Token is required"}), 400

    try:
        get_firebase_app()
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token["uid"]

        user = User.query.filter_by(firebase_uid=uid).first()

        if not user:
            # Create a new user if it doesn't exist
            user = User(
                firebase_uid=uid,
                username=decoded_token.get("name"),
                email=decoded_token.get("email"),
            )
            db.session.add(user)
            db.session.commit()

        # Return a success response with the user_id
        return jsonify({"message": "Login successful", "user_id": user.id}), 200

    except Exception as e:
        print(e)
        return jsonify({"error": "Invalid token"}), 401
