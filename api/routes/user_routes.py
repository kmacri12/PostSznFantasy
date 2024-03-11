import os
import logging
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from api.app import db
from api.utils.db.models import User

user_bp = Blueprint("user", __name__)
logger = logging.getLogger(__name__)


@user_bp.route("/")
def profile():
    return "User"


@user_bp.route("/register_new_user", methods=["POST"])
def register_new_user():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    email = data.get("email")

    if not username or not password or not email:
        return (
            jsonify({"error": "One or more of username/password/email is missing"}),
            400,
        )

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"error": "Email already exists"}), 400

    new_user = User(username=username, password=password, email=email)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201


@user_bp.route("/login", methods=["POST"])
def login():
    # Get username/email and password from the request
    data = request.json
    username_or_email = data.get("username_or_email")
    password = data.get("password")

    if not username_or_email or not password:
        return jsonify({"error": "Username/email and password are required"}), 400

    # Query the database to find the user by username or email
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if user and user.check_password(password):
        token = jwt.encode(
            {"user_id": user.id, "exp": datetime.utcnow() + timedelta(days=90)},
            os.getenv("JWT_SECRET_KEY"),
            algorithm="HS256",
        )
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        # If the user does not exist or the password does not match, return an error response
        return jsonify({"error": "Invalid username/email or password"}), 401
