# config.py - Central configuration and Flask app factory
import os
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

# --- Environment ---
FLASK_ENV = os.getenv("FLASK_ENV", "production")

# --- Dynamic CORS / Redirect Config ---
if FLASK_ENV == 'development':
    FRONTEND_ORIGIN = "http://localhost:3000"
    FRONTEND_BASE = "http://localhost:3000"
    REDIRECT_URI = "http://localhost:5000/login/google/callback"
else:
    FRONTEND_ORIGIN = "https://sujalgawas.github.io"
    FRONTEND_BASE = "https://sujalgawas.github.io/JEE_question_generator"
    REDIRECT_URI = "https://jee-question-generator.onrender.com/login/google/callback"

SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
]

# --- Firebase Config Files ---
ADMIN_SERVICE_KEY_PATH = 'adminServiceKey.json'
GOOGLE_ACCOUNT_KEY_PATH = 'googleAccountKey.json'
SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'


def create_app():
    """Flask application factory."""
    from flask import Flask
    from flask_cors import CORS

    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))

    CORS(app, resources={r"/*": {"origins": [FRONTEND_ORIGIN]}}, supports_credentials=True)

    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

    # Register blueprints
    from routes.auth import auth_bp
    from routes.paper import paper_bp
    from routes.test_results import test_results_bp
    from routes.papers_crud import papers_crud_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(paper_bp)
    app.register_blueprint(test_results_bp)
    app.register_blueprint(papers_crud_bp)

    return app
