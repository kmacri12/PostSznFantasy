import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from api.utils.socketio.socketio_handlers import setup_socketio_handlers

db = SQLAlchemy()  # Single instance of SQLAlchemy
# socketio = SocketIO()  # Single instance of SocketIO


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("PG_URI")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # CORS setup
    CORS(app)
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173/", "headers": "Content-Type"}})
    CORS(app, resources={r"/socket.io": {"origins": "http://localhost:5173/"}})

    # Logging setup
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] - %(message)s",
        handlers=[logging.FileHandler("app.log"), logging.StreamHandler()],
    )
    logging.info("Starting the application")

    socketio = SocketIO(app)

    # socketio.init_app(app, cors_allowed_origins="http://localhost:5173")  # Add CORS for WebSocket

    # Register the blueprints
    from api.routes.main_routes import main_bp
    from api.routes.user_routes import user_bp
    from api.routes.admin_routes import admin_bp
    from api.routes.players_routes import players_bp
    from api.routes.league_routes import league_bp
    from api.routes.draft_routes import draft_bp

    app.register_blueprint(main_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(players_bp, url_prefix="/api/players")
    app.register_blueprint(league_bp, url_prefix="/api/league")
    app.register_blueprint(draft_bp, url_prefix="/api/draft")

    # Setup SocketIO event handlers
    setup_socketio_handlers(socketio)

    return app  # , socketio  # Return both app and socketio
