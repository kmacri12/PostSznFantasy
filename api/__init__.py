from flask import Flask


def create_app():
    app = Flask(__name__)

    # Register the blueprints
    from api.routes.main_routes import main_bp
    from api.routes.user_routes import user_bp
    from api.routes.admin_routes import admin_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(user_bp, url_prefix="/user")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    return app
