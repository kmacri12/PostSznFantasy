import logging
from flask import Blueprint, jsonify

from api.utils.db.models import Draft
from api.utils.security.firebase import token_required


draft_bp = Blueprint("draft", __name__)
logger = logging.getLogger(__name__)


@draft_bp.route("/")
def health():
    """Health check"""
    return "healthy"


@draft_bp.route("/draft-info-by-league/<int:league_id>", methods=["GET"])
@token_required
def get_draft_info(league_id: int, user_id: int):
    try:
        draft = Draft.query.filter_by(league_id=league_id).first()
        if not draft:
            return jsonify({"error": "Draft not found"}), 404
        return jsonify(draft.to_dict()), 200
    except Exception:
        logger.exception('Error getting draft info')
