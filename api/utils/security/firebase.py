import os
from collections.abc import Callable
from functools import wraps
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials
from flask import jsonify, request

_firebase_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App | None:
    global _firebase_app
    if _firebase_app is None:
        key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
        if key_path and os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            _firebase_app = firebase_admin.initialize_app(cred)
        elif not firebase_admin._apps:
            _firebase_app = firebase_admin.initialize_app()
        else:
            _firebase_app = firebase_admin.get_app()
    return _firebase_app


def token_required(f: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = request.headers.get("Authorization")

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            get_firebase_app()
            token_str = token.split(" ", 1)[1] if " " in token else token
            decoded_token = auth.verify_id_token(token_str)
            user_id = decoded_token["uid"]
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        return f(*args, user_id=user_id, **kwargs)

    return decorated
