import logging
from flask import Flask
from flask_cors import CORS

from api.routes.main_routes import main_bp
from api.routes.user_routes import user_bp
from api.routes.admin_routes import admin_bp
from api.routes.players_routes import players_bp


def create_app():
    app = Flask(__name__)
    CORS(app)
    CORS(
        app,
        resources={
            r"/api/*": {"origins": "http://localhost:3000/", "headers": "Content-Type"}
        },
    )
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] - %(message)s",
        handlers=[logging.FileHandler("app.log"), logging.StreamHandler()],
    )
    logging.info("Starting the application")

    # Register the blueprints

    app.register_blueprint(main_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(players_bp, url_prefix="/api/players")

    return app
