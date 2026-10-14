# routes/auth.py - Authentication endpoints (signup, login, Google OAuth)
from flask import Blueprint, request, jsonify, redirect, session, url_for
from datetime import datetime, timedelta
from services.firebase_service import db, auth, admin_auth, google_config
from config import FRONTEND_BASE, SCOPES

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/signup', methods=['POST'])
def signup():
    import json
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')

    if not all([email, password, name]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        user = auth.create_user_with_email_and_password(email, password)
        user_id = user['localId']
        auth.send_email_verification(user['idToken'])
        db.child("users").child(user_id).set({"name": name, "email": email})

        return jsonify({
            "status": "success", 
            "message": "Account created! A verification link has been sent to your email. Please verify before logging in."
        })
    except Exception as e:
        try:
            error_json = e.args[1]
            error_message = json.loads(error_json).get('error', {}).get('message', 'An unknown error occurred.')
            
            if "EMAIL_EXISTS" in error_message:
                message = "An account with this email already exists."
            else:
                message = "Could not create account. Please try again."
        except (IndexError, KeyError, json.JSONDecodeError):
            message = "An unexpected error occurred during signup."

        print(f"Signup error: {message}")
        return jsonify({"status": "error", "message": message}), 400


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    try:
        login_data = auth.sign_in_with_email_and_password(email, password)
        user_info = auth.get_account_info(login_data['idToken'])
        is_email_verified = user_info['users'][0]['emailVerified']

        if not is_email_verified:
            return jsonify({
                "status": "error", 
                "message": "Your email has not been verified. Please check your inbox."
            }), 403

        local_id = user_info['users'][0]['localId']
        user_data = db.child("users").child(local_id).get()
        name = user_data.get('name') if user_data else "User"

        # Bypass the Firebase 1-hour ID token limit:
        # Create a 14-day Firebase session cookie using Firebase Admin SDK
        expires_in = timedelta(days=14)
        try:
            session_token = admin_auth.create_session_cookie(login_data['idToken'], expires_in=expires_in)
        except Exception as e:
            print(f"Failed to create session cookie, fallback to idToken: {e}")
            session_token = login_data['idToken']

        return jsonify({
            "status": "success", 
            "message": "Logged in successfully",
            "idToken": session_token,
            "sessionToken": session_token,
            "rawIdToken": login_data['idToken'],
            "refreshToken": login_data.get('refreshToken'),
            "name": name
        })
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401


@auth_bp.route('/session-login', methods=['POST'])
def session_login():
    """
    Exchanges a Firebase ID token (e.g. from Google sign-in) for a 14-day Firebase session cookie.
    """
    data = request.get_json() or {}
    id_token = data.get('idToken')
    client_name = data.get('name')

    if not id_token:
        return jsonify({"status": "error", "message": "Missing idToken"}), 400

    try:
        expires_in = timedelta(days=14)
        session_token = admin_auth.create_session_cookie(id_token, expires_in=expires_in)
        decoded = admin_auth.verify_session_cookie(session_token, check_revoked=False)
        uid = decoded['uid']
        user_data = db.child("users").child(uid).get()
        name = (user_data.get('name') if user_data else None) or client_name or decoded.get('name') or decoded.get('email', 'User').split('@')[0]

        return jsonify({
            "status": "success",
            "idToken": session_token,
            "sessionToken": session_token,
            "name": name,
            "uid": uid
        })
    except Exception as e:
        print(f"Error creating session cookie: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_token():
    """
    Refreshes an expired/expiring session using Pyrebase refresh token.
    Mints a new 14-day Firebase session cookie.
    """
    data = request.get_json() or {}
    refresh_tok = data.get('refreshToken')

    if not refresh_tok:
        return jsonify({"status": "error", "message": "Missing refreshToken"}), 400

    try:
        refreshed = auth.refresh(refresh_tok)
        new_id_token = refreshed['idToken']
        new_refresh_tok = refreshed.get('refreshToken', refresh_tok)
        expires_in = timedelta(days=14)
        session_token = admin_auth.create_session_cookie(new_id_token, expires_in=expires_in)

        decoded = admin_auth.verify_session_cookie(session_token, check_revoked=False)
        uid = decoded['uid']
        user_data = db.child("users").child(uid).get()
        name = (user_data.get('name') if user_data else None) or decoded.get('name') or decoded.get('email', 'User').split('@')[0]

        return jsonify({
            "status": "success",
            "idToken": session_token,
            "refreshToken": new_refresh_tok,
            "name": name
        })
    except Exception as e:
        print(f"Error refreshing token: {e}")
        return jsonify({"status": "error", "message": str(e)}), 401