import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from config import Config

db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    socketio.init_app(app, async_mode='eventlet')

    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp)

    from app.feed import bp as feed_bp
    app.register_blueprint(feed_bp)

    from app.portfolio import bp as portfolio_bp
    app.register_blueprint(portfolio_bp)

    from app.protect import bp as protect_bp
    app.register_blueprint(protect_bp)

    from app.character import bp as character_bp
    app.register_blueprint(character_bp)

    from app.wanderland import bp as wanderland_bp
    app.register_blueprint(wanderland_bp)

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    with app.app_context():
        from app import models
        db.create_all()

    return app
