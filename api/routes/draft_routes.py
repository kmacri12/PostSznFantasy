import logging
from flask import Blueprint, jsonify

from api.utils.db.models import Draft, DraftPick
from api.utils.security.firebase import token_required


draft_bp = Blueprint("draft", __name__)
logger = logging.getLogger(__name__)


@draft_bp.route("/")
def health():
    """Health check"""
    return "healthy"


@draft_bp.route("/draft-info/<int:league_id>", methods=["GET"])
@token_required
def get_draft_info(league_id: int, user_id: int):
    try:
        draft = Draft.query.filter_by(league_id=league_id).first()
        if not draft:
            return jsonify({"error": "Draft not found"}), 404
        return jsonify(draft.to_dict()), 200
    except Exception:
        logger.exception('Error getting draft info')


@draft_bp.route("/draft-picks/<int:draft_id>", methods=["GET"])
@token_required
def get_draft_picks(draft_id: int, user_id: int):
    try:
        draft_picks = DraftPick.query.filter_by(draft_id=draft_id).first()
        if not draft_picks:
            return jsonify({"error": "Draft not found"}), 404
        return jsonify(draft.to_dict()), 200
    except Exception:
        logger.exception('Error getting draft picks')
