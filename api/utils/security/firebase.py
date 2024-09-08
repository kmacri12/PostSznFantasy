import os
from functools import wraps
from firebase_admin import credentials, auth
from flask import request, jsonify

service_account_key_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
cred = credentials.Certificate(service_account_key_path)


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
