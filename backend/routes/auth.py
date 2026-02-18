# routes/auth.py - Authentication endpoints (signup, login, Google OAuth)
from flask import Blueprint, request, jsonify, redirect, session, url_for
from datetime import datetime
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

        return jsonify({
            "status": "success", 
            "message": "Logged in successfully",
            "idToken": login_data['idToken'],
            "name": name
        })
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401
    

@auth_bp.route('/login/google')
def google_login():
    """Initiates the Google OAuth flow."""
    from google_auth_oauthlib.flow import Flow
    import secrets
    import os
    
    print("--- Starting Google OAuth flow ---")
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    
    try:
        flow = Flow.from_client_config(
            google_config,
            scopes=SCOPES,
            redirect_uri=url_for('auth.google_login_callback', _external=True)
        )
        
        state = secrets.token_urlsafe(32)
        session['state'] = state
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='select_account'
        )
        
        print(f"Redirecting to Google OAuth: {authorization_url}")
        return redirect(authorization_url)
        
    except Exception as e:
        print(f"Error starting Google OAuth flow: {e}")
        import traceback
        traceback.print_exc()
        error_url = f"{FRONTEND_BASE}/login?error=google_auth_failed"
        return redirect(error_url)
    

@auth_bp.route('/login/google/callback')
def google_login_callback():
    """
    Handles the redirect from Google, exchanges the code for tokens,
    and creates/signs in the user.
    """
    from google_auth_oauthlib.flow import Flow
    import requests
    import secrets
    
    print("--- Starting Google auth callback ---")
    
    state = session.pop('state', None)
    if state is None or state != request.args.get('state'):
        print("Error: State mismatch or missing.")
        return 'State mismatch. The request may have been forged.', 400
    print("State validation successful.")

    flow = Flow.from_client_config(
        google_config,
        scopes=SCOPES,
        redirect_uri=url_for('auth.google_login_callback', _external=True)
    )
    
    try:
        print(f"Attempting to fetch token with response URL: {request.url}")
        flow.fetch_token(authorization_response=request.url)
        print("Tokens fetched successfully from Google.")
        
        credentials = flow.credentials
        google_id_token = credentials.id_token
        google_access_token = credentials.token
        
        if not google_id_token:
            print("Error: Google ID token is missing from credentials.")
            raise Exception("Google ID token not found.")
            
        print("--- Processing Google user info ---")
        
        user_info_url = 'https://www.googleapis.com/oauth2/v3/userinfo'
        headers = {'Authorization': f'Bearer {google_access_token}'}
        user_info_response = requests.get(user_info_url, headers=headers)
        
        if user_info_response.status_code != 200:
            raise Exception("Failed to fetch user info from Google")
            
        user_info = user_info_response.json()
        
        name = user_info.get('name', 'User')
        email = user_info.get('email', '')
        google_user_id = user_info.get('sub', '')
        
        print(f"Google user info: name={name}, email={email}, id={google_user_id}")
        
        users_data_snapshot = db.child("users").order_by_child("email").equal_to(email).get()
        users_data = users_data_snapshot if users_data_snapshot else {}
        
        existing_user_uid = None
        
        for uid, user_data in users_data.items():
            if user_data.get('email') == email:
                existing_user_uid = uid
                print(f"Found existing user by email: {uid}")
                break
        
        if existing_user_uid:
            print(f"Updating existing user: {existing_user_uid}")
            db.child("users").child(existing_user_uid).update({
                "google_id": google_user_id,
                "auth_provider": "google",
                "last_login": {"google": True, "timestamp": str(datetime.now())}
            })
            user_uid = existing_user_uid
            existing_data = db.child("users").child(existing_user_uid).get()
            name = existing_data.get('name', name)
            
        else:
            user_uid = f"google_{google_user_id}"
            print(f"Creating new user: {user_uid}")
            db.child("users").child(user_uid).set({
                "name": name, 
                "email": email,
                "google_id": google_user_id,
                "auth_provider": "google",
                "created_at": str(datetime.now()),
                "last_login": {"google": True, "timestamp": str(datetime.now())}
            })
        
        try:
            import hashlib
            temp_password = hashlib.sha256(f"{google_user_id}_{email}_temp".encode()).hexdigest()[:16] + "Aa1!"
            
            try:
                firebase_user = auth.create_user_with_email_and_password(email, temp_password)
                firebase_id_token = firebase_user['idToken']
                firebase_local_id = firebase_user['localId']
                print("Created Firebase Auth user with temporary credentials")
                
                db.child("users").child(user_uid).update({
                    "firebase_uid": firebase_local_id
                })
                
            except Exception as firebase_create_error:
                print(f"Firebase user creation failed (user might exist): {firebase_create_error}")
                
                try:
                    firebase_user = auth.sign_in_with_email_and_password(email, temp_password)
                    firebase_id_token = firebase_user['idToken']
                    print("Signed in to existing Firebase Auth user")
                except Exception as firebase_signin_error:
                    print(f"Firebase signin also failed: {firebase_signin_error}")
                    firebase_id_token = f"session_{secrets.token_urlsafe(32)}"
                    print("Using session-based token as fallback")
            
        except Exception as firebase_error:
            print(f"Firebase integration error: {firebase_error}")
            firebase_id_token = f"session_{secrets.token_urlsafe(32)}"
        
        session['user_uid'] = user_uid
        session['user_name'] = name
        session['auth_provider'] = 'google'
        session['google_id'] = google_user_id
        session.permanent = True
        
        success_url = f"{FRONTEND_BASE}/#/auth/callback?idToken={firebase_id_token}&name={name}"
        print(f"Redirecting to success URL: {success_url}")
        return redirect(success_url)

    except Exception as e:
        print(f"An ERROR occurred during Google auth callback: {e}")
        import traceback
        traceback.print_exc()
        error_url = f"{FRONTEND_BASE}/login?error=google_auth_failed"
        print(f"Redirecting to error URL: {error_url}")
        return redirect(error_url)
