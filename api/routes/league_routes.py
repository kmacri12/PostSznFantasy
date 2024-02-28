import os
import logging
from functools import wraps
from flask import Blueprint, request, jsonify
import jwt
from flask_sqlalchemy import SQLAlchemy
from api.app import db

league_bp = Blueprint("league", __name__)
logger = logging.getLogger(__name__)


@league_bp.route("/")
def health():
    """health check"""
    return "healthy"


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'error': 'Token is missing!'}), 401

        try:
            token = token.split(' ', 1)[1] if token else None
            data = jwt.decode(token, os.getenv("JWT_SECRET_KEY"), algorithms=['HS256'])
            user_id = data['user_id']  # Extract user ID from the token payload
        except jwt.ExpiredSignatureError:
            logger.exception("Expired Token sent")
            return jsonify({'error': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            logger.exception("Invalid Token sent")
            return jsonify({'error': 'Token is invalid!'}), 401

        return f(user_id, *args, **kwargs)

    return decorated

@league_bp.route('/create_league', methods=['POST'])
@token_required
def create_league(user_id):
    data = request.json
    # data will contain all the data needed to create a league, league settings, draft settings
    return jsonify({'message': f'League created successfully by user {user_id}!'})
