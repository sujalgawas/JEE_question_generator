from flask import Flask, request, jsonify, redirect, session, url_for
from flask_cors import CORS
from agent import get_agent_graph
from concept_weight import concepts_for_paper
import pyrebase
import os
import json
from google_auth_oauthlib.flow import Flow
import requests # Make sure to install this
import secrets
from datetime import datetime
import uuid

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

#setting up fire base for signup/login
file_path = 'serviceAccountKey.json'
with open(file_path, 'r') as file:
    config = json.load(file)
    
file_path = 'googleAccountKey.json'
with open(file_path, 'r') as file:
    config2 = json.load(file)

firebase = pyrebase.initialize_app(config)    
auth = firebase.auth()

# Add this line to connect to the database
db = firebase.database()
pending_verifications = {}

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))
# Enable CORS to allow requests from your React frontend
CORS(app)

SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
REDIRECT_URI = "http://localhost:5000/login/google/callback"
# The URL your frontend is running on
FRONTEND_URL = "http://localhost:3000" # If your frontend also uses HTTPS

# --- Existing Signup Endpoint (No changes needed) ---
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')

    if not all([email, password, name]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        # Step 1: Create the user in Firebase Authentication
        user = auth.create_user_with_email_and_password(email, password)
        user_id = user['localId']
        
        # Step 2: Send the verification email
        auth.send_email_verification(user['idToken'])
        
        # Step 3: Save additional user data to the Realtime Database
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

# --- Existing Login Endpoint (No changes needed) ---
@app.route('/login', methods=['POST'])
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
        user_data = db.child("users").child(local_id).get().val()
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
    
@app.route('/login/google')
def google_login():
    """
    Initiates the Google OAuth flow.
    """
    print("--- Starting Google OAuth flow ---")
    
    # Set insecure transport for development
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    
    try:
        # Create the flow using the client secrets
        flow = Flow.from_client_config(
            config2,  # Your Google client configuration
            scopes=SCOPES,
            redirect_uri=url_for('google_login_callback', _external=True)
        )
        
        # Generate and store state for CSRF protection
        state = secrets.token_urlsafe(32)
        session['state'] = state
        
        # Get the authorization URL
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='select_account'  # Always show account selection
        )
        
        print(f"Redirecting to Google OAuth: {authorization_url}")
        return redirect(authorization_url)
        
    except Exception as e:
        print(f"Error starting Google OAuth flow: {e}")
        import traceback
        traceback.print_exc()
        error_url = f"{FRONTEND_URL}/login?error=google_auth_failed"
        return redirect(error_url)
    
# --- Step 2 of Backend Google Login (The Callback) ---
@app.route('/login/google/callback')
def google_login_callback():
    """
    Handles the redirect from Google, exchanges the code for tokens,
    and creates/signs in the user.
    """
    print("--- Starting Google auth callback ---")
    
    # 1. State validation to protect against CSRF attacks
    state = session.pop('state', None)
    if state is None or state != request.args.get('state'):
        print("Error: State mismatch or missing.")
        return 'State mismatch. The request may have been forged.', 400
    print("State validation successful.")

    flow = Flow.from_client_config(
        config2,
        scopes=SCOPES,
        redirect_uri=url_for('google_login_callback', _external=True)
    )
    
    try:
        # 2. Exchange the authorization code for Google tokens
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
        
        # 3. Get user info from Google
        user_info_url = 'https://www.googleapis.com/oauth2/v3/userinfo'
        headers = {'Authorization': f'Bearer {google_access_token}'}
        user_info_response = requests.get(user_info_url, headers=headers)
        
        if user_info_response.status_code != 200:
            raise Exception("Failed to fetch user info from Google")
            
        user_info = user_info_response.json()
        
        name = user_info.get('name', 'User')
        email = user_info.get('email', '')
        google_user_id = user_info.get('sub', '')  # Google's unique user ID
        
        print(f"Google user info: name={name}, email={email}, id={google_user_id}")
        
        # 4. Check if user exists in our database
        users_data = db.child("users").get().val() or {}
        existing_user_uid = None
        
        # Look for existing user by email
        for uid, user_data in users_data.items():
            if user_data.get('email') == email:
                existing_user_uid = uid
                print(f"Found existing user by email: {uid}")
                break
        
        if existing_user_uid:
            # Update existing user with Google info
            print(f"Updating existing user: {existing_user_uid}")
            db.child("users").child(existing_user_uid).update({
                "google_id": google_user_id,
                "auth_provider": "google",
                "last_login": {"google": True, "timestamp": str(datetime.now())}
            })
            user_uid = existing_user_uid
            
            # Get the existing name from database
            existing_data = db.child("users").child(existing_user_uid).get().val()
            name = existing_data.get('name', name)
            
        else:
            # Create new user with Google ID as unique identifier
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
        
        # 5. For compatibility with your existing frontend, we'll create a Firebase user
        # and get an ID token. This is a workaround since we can't use the 
        # sign_in_with_idp_access_token method.
        
        try:
            # Try to create a Firebase Auth user with a temporary password
            import hashlib
            import time
            
            # Create a deterministic but secure password based on Google user ID
            temp_password = hashlib.sha256(f"{google_user_id}_{email}_temp".encode()).hexdigest()[:16] + "Aa1!"
            
            try:
                # Try to create the user
                firebase_user = auth.create_user_with_email_and_password(email, temp_password)
                firebase_id_token = firebase_user['idToken']
                firebase_local_id = firebase_user['localId']
                print("Created Firebase Auth user with temporary credentials")
                
                # Update our database entry to link with Firebase UID
                db.child("users").child(user_uid).update({
                    "firebase_uid": firebase_local_id
                })
                
            except Exception as firebase_create_error:
                print(f"Firebase user creation failed (user might exist): {firebase_create_error}")
                
                # Try to sign in with the temporary password
                try:
                    firebase_user = auth.sign_in_with_email_and_password(email, temp_password)
                    firebase_id_token = firebase_user['idToken']
                    print("Signed in to existing Firebase Auth user")
                except Exception as firebase_signin_error:
                    print(f"Firebase signin also failed: {firebase_signin_error}")
                    # If both fail, we'll use a session-based approach
                    firebase_id_token = f"session_{secrets.token_urlsafe(32)}"
                    print("Using session-based token as fallback")
            
        except Exception as firebase_error:
            print(f"Firebase integration error: {firebase_error}")
            # Fallback to session-based authentication
            firebase_id_token = f"session_{secrets.token_urlsafe(32)}"
        
        # 6. Store session information for backend validation
        session['user_uid'] = user_uid
        session['user_name'] = name
        session['auth_provider'] = 'google'
        session['google_id'] = google_user_id
        
        # 7. Redirect the user back to the frontend with the token
        success_url = f"{FRONTEND_URL}/auth/callback?idToken={firebase_id_token}&name={name}"
        print(f"Redirecting to success URL: {success_url}")
        return redirect(success_url)

    except Exception as e:
        print(f"An ERROR occurred during Google auth callback: {e}")
        import traceback
        traceback.print_exc()
        error_url = f"{FRONTEND_URL}/login?error=google_auth_failed"
        print(f"Redirecting to error URL: {error_url}")
        return redirect(error_url)
    
# ... (rest of your server.py file remains the same) ...
# --- Load the LangGraph Agent ---
print("Initializing LangGraph agent...")
langgraph_app = get_agent_graph()
print("Agent initialized successfully.")

# In production, you should use a database or secure session storage
user_data_store = {}

@app.route('/get_user_data', methods=['POST'])
def my_endpoint():
    data = request.json  # Access the posted data
    token = data.get('token')
    name = data.get('name')

    # Save it somewhere for later
    user_data_store['token'] = token
    user_data_store['name'] = name

    return jsonify({"status": "success"})

def save_user_paper(paper_json):
    # Retrieve stored token & name
    token = user_data_store.get('token')
    name = user_data_store.get('name')

    if not token or not name:
        print("Error: Missing user data")
        return

    # Create unique ID for the paper
    paper_id = str(uuid.uuid4())  # Example: '3f9e8d48-7f17-4a83-a93f-2d2e8341e5b6'

    # Add metadata to paper JSON
    paper_json['paper_id'] = paper_id
    paper_json['created_by'] = name
    paper_json['created_at'] = datetime.utcnow().isoformat()

    # Save paper in a global "papers" collection
    db.child("papers").child(paper_id).set(paper_json)

    # (Optional) Save reference to this paper under the user's profile
    db.child("users").child(token).child("papers").child(paper_id).set(True)

    print(f"Paper saved with ID {paper_id} for user {name}")
    return paper_id

    
@app.route('/generate-paper', methods=['POST'])
def generate_paper_endpoint():
    """
    This endpoint triggers the question generation agent and returns the
    final structured paper data as JSON.
    """
    print("\n--- Received request at /generate-paper ---")
    
    try:
        # The initial state for the agent, using the imported paper structure.
        initial_state = {
            "paper_structure": concepts_for_paper,
        }

        print("Invoking the agent... This may take a while.")
        # --- Invoke the Agent ---
        final_state = langgraph_app.invoke(initial_state)
        
        # The final_paper key now holds the dictionary of lists.
        paper_data = final_state.get('final_paper')

        if not paper_data:
            print("Error: Agent finished but 'final_paper' key is missing or empty.")
            return jsonify({"error": "Agent failed to produce paper data."}), 500

        print(f"Agent finished. Total questions generated: {len(paper_data.get('question_number', []))}")
        
        save_user_paper(paper_data)
        
        # --- Return the successful response ---
        return jsonify(paper_data)

    except Exception as e:
        # --- Handle any errors during the process ---
        print(f"An error occurred during agent invocation: {e}")
        # It's helpful to return a specific error message for debugging.
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Run the Flask app on port 5000, accessible from any IP on your network.
    # Use debug=True for development to get auto-reloading and helpful error pages.
    # In a production environment, you would use a proper WSGI server like Gunicorn.
    app.run(host='0.0.0.0', port=5000, debug=True)
