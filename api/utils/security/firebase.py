import os

import firebase_admin
from firebase_admin import credentials

_firebase_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App | None:
    """Lazily initialize and return the Firebase Admin app instance."""
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
