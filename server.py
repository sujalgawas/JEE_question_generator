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
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, db as admin_db_sdk, auth as admin_auth_sdk
load_dotenv(dotenv_path=".env")

config_flask = os.getenv("FLASK_ENV")

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# 'config' MUST be your new Admin SDK key
file_path_admin = 'adminServiceKey.json' # <-- LOAD THE NEW FILE YOU JUST DOWNLOADED
with open(file_path_admin, 'r') as file:
    config = json.load(file)
    
# 'config2' is your client-side config (the one you posted)
file_path_client = 'googleAccountKey.json' 
with open(file_path_client, 'r') as file:
    config2 = json.load(file)

# 'config3' is your client-side config (the one you posted)
file_path_client = 'serviceAccountKey.json' 
with open(file_path_client, 'r') as file:
    config3 = json.load(file)


# --- 2. Initialize firebase-admin (For Admin Database Access) ---
# This will now work because 'config' has the correct "type": "service_account"
cred = credentials.Certificate(config) 
firebase_admin.initialize_app(cred, {
    'databaseURL': config3.get('databaseURL') 
})

# --- 3. Initialize pyrebase (For User Signup/Login) ---
# This uses 'config3', which is your main client config
firebase_client = pyrebase.initialize_app(config3)


# --- 4. Assign Your Variables ---
db = admin_db_sdk.reference() # <-- This is the admin DB reference
auth = firebase_client.auth() # <-- This is the pyrebase auth client
admin_auth = admin_auth_sdk # <-- This is the admin auth client
pending_verifications = {}

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))


# --- NEW: DYNAMIC CONFIGURATION ---
if config_flask == 'development':
    print("Running in development mode")
    FRONTEND_ORIGIN = "http://localhost:3000"  # origin for CORS checks
    FRONTEND_BASE = "http://localhost:3000"    # url used for redirects
    REDIRECT_URI = "http://localhost:5000/login/google/callback"
else:
    # production
    FRONTEND_ORIGIN = "https://sujalgawas.github.io"
    FRONTEND_BASE = "https://sujalgawas.github.io/JEE_question_generator"  # used for client redirects
    REDIRECT_URI = "https://jee-question-generator.onrender.com/login/google/callback"

# Only allow requests from your frontend origin
CORS(app, resources={r"/*": {"origins": [FRONTEND_ORIGIN]}}, supports_credentials=True)

# --- Google Auth setup (uses the dynamic REDIRECT_URI) ---
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']

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
        # Step 1: Create the user in Firebase Authentication (Pyrebase)
        user = auth.create_user_with_email_and_password(email, password)
        user_id = user['localId']
        
        # Step 2: Send the verification email (Pyrebase)
        auth.send_email_verification(user['idToken'])
        
        # Step 3: Save additional user data to the Realtime Database (Admin DB)
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

# --- Existing Login Endpoint (FIXED) ---
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
        
        # --- FIX: Removed .val() ---
        user_data = db.child("users").child(local_id).get()
        # --- END FIX ---
        
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
        error_url = f"{FRONTEND_BASE}/login?error=google_auth_failed"
        return redirect(error_url)
    
# --- Step 2 of Backend Google Login (The Callback) (FIXED) ---
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
        
        # --- FIX: Removed .val() ---
        users_data = db.child("users").get() or {}
        # --- END FIX ---
        
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
            
            # --- FIX: Removed .val() ---
            existing_data = db.child("users").child(existing_user_uid).get()
            # --- END FIX ---
            
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
        # and get an ID token.
        
        try:
            # Try to create a Firebase Auth user with a temporary password
            import hashlib
            
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
        session.permanent = True  # Make session persistent
        
        # 7. Redirect the user back to the frontend with the token
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
    
# ... (rest of your server.py file remains the same) ...
# --- Load the LangGraph Agent ---
print("Initializing LangGraph agent...")
langgraph_app = get_agent_graph()
print("Agent initialized successfully.")

# --- (FIXED) ---
def validate_user_token(token):
    """
    Validate user token and return user info
    """
    if token.startswith("session_"):
        # Session-based token (from Google Sign-in)
        return {
            'uid': session.get('user_uid'),
            'name': session.get('user_name'),
            'provider': 'google'
        }
    else:
        # Firebase ID token (from email/password signup)
        try:
            # USE ADMIN AUTH TO SECURELY VERIFY
            user_info = admin_auth.verify_id_token(token)
            uid = user_info['uid']
            
            # Get name from database
            # --- FIX: Removed .val() ---
            user_data = db.child("users").child(uid).get()
            # --- END FIX ---
            
            name = user_data.get('name', 'User') if user_data else 'User'
            return {
                'uid': uid,
                'name': name,
                'provider': 'firebase'
            }
        except Exception as e:
            print(f"Firebase token validation failed: {e}")
            return None


# In production, you should use a database or secure session storage
user_data_store = {}

#this is useless endpoint
@app.route('/get_user_data', methods=['POST'])
def my_endpoint():
    data = request.json  # Access the posted data
    token = data.get('token')
    name = data.get('name')

    # Save it somewhere for later
    user_data_store['token'] = token
    user_data_store['name'] = name

    return jsonify({"status": "success"})

# Fixed server.py sections
@app.route('/generate-paper', methods=['POST'])
def generate_paper_endpoint():
    """
    This endpoint triggers the question generation agent and returns the
    final structured paper data as JSON.
    """
    print("\n--- Received request at /generate-paper ---")
    
    try:
        data = request.get_json()
        user_token = data.get('token')
        user_name = data.get('name')

        # Validate user
        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401

        # Store user data for this request
        user_data_store['token'] = user_token
        user_data_store['name'] = user_info['name']

        print(f"User data received: name={user_name}, token={'***' if user_token else 'None'}")

        # Manipulation concepts_for_paper as per users before sending to the agent
        user_test_data = [] # Default to empty list
        if user_name:
            user_test_data = get_weak_concepts(user_name)
        
        print(f"Weak concepts for user: {user_test_data}")

        # The initial state for the agent
        initial_state = {
            "paper_structure": concepts_for_paper,
            "weak_concepts" : user_test_data,
        }

        print("Invoking the agent... This may take a while.")
        # Invoke the Agent
        final_state = langgraph_app.invoke(initial_state)
        
        paper_data = final_state.get('final_paper')

        if not paper_data:
            print("Error: Agent finished but 'final_paper' key is missing or empty.")
            return jsonify({"error": "Agent failed to produce paper data."}), 500

        print(f"Agent finished. Total questions generated: {len(paper_data.get('question_number', []))}")
        
        # Save the paper with user data
        paper_id = save_user_paper(paper_data, user_token, user_name)
        
        # Add paper_id to response
        paper_data['paper_id'] = paper_id
        
        return jsonify(paper_data)

    except Exception as e:
        print(f"An error occurred during agent invocation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
# --- (FIXED) ---
@app.route('/get-paper-for-test', methods=['POST'])
def get_paper_for_test():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paperId')

        if not token or not paper_id:
            return jsonify({'error': 'Missing token or paper ID'}), 400

        # Get paper from database
        # --- FIX: Removed .val() ---
        paper_data = db.child('papers').child(paper_id).get()
        
        if paper_data is None: # <-- FIX
            return jsonify({'error': 'Paper not found'}), 404
            
        return jsonify({'paper': paper_data}), 200 # <-- FIX
        # --- END FIX ---

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# --- (FIXED) ---
@app.route('/submit-test-result', methods=['POST'])
def submit_test_result():
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('userName')
        test_result = data.get('testResult')

        if not token or not user_name or not test_result:
            return jsonify({'error': 'Missing required data'}), 400

        # Get user UID
        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                # USE ADMIN AUTH (SECURE WAY)
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid') # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        # Calculate score
        paper_id = test_result['paperId']
        user_answers = test_result['answers']
        
        # Get correct answers from paper
        # --- FIX: Removed .val() ---
        paper_data = db.child('papers').child(paper_id).get()
        # --- END FIX ---
        
        if not paper_data:
            return jsonify({'error': 'Paper not found'}), 404

        correct_answer_keys = paper_data.get('correct_answer', [])
        options_data = paper_data.get('options', [])
        score = 0
        total_questions = len(correct_answer_keys)

        # Helper function to get option value from key
        def get_option_value(options_obj, key):
            if not options_obj or not key:
                return None
            return options_obj.get(key)

        # Calculate score by converting correct answer keys to values
        for index, correct_key in enumerate(correct_answer_keys):
            user_answer = user_answers.get(str(index))
            
            # Get the actual correct answer value from options
            if index < len(options_data):
                correct_value = get_option_value(options_data[index], correct_key)
                if user_answer == correct_value:
                    score += 1

        # Create result ID
        result_id = str(uuid.uuid4())

        # Save test result
        result_data = {
            'result_id': result_id,
            'user_uid': user_uid,
            'user_name': user_name,
            'paper_id': paper_id,
            'answers': user_answers,
            'score': score,
            'total_questions': total_questions,
            'percentage': round((score / total_questions) * 100, 2) if total_questions > 0 else 0,
            'time_spent': test_result['timeSpent'],
            'completed_at': test_result['completedAt'],
            'created_at': datetime.utcnow().isoformat()
        }

        # Save to results collection
        db.child("test_results").child(result_id).set(result_data)

        # Save reference under user's profile
        db.child("users").child(user_uid).child("test_results").child(result_id).set({
            'paper_id': paper_id,
            'score': score,
            'total_questions': total_questions,
            'percentage': result_data['percentage'],
            'completed_at': test_result['completedAt']
        })

        return jsonify({
            'success': True, 
            'resultId': result_id,
            'score': score,
            'totalQuestions': total_questions,
            'percentage': result_data['percentage']
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# --- (FIXED) ---
@app.route('/delete-paper', methods=['POST'])
def delete_paper():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paper_id')
        
        if not token or not paper_id:
            return jsonify({'error': 'Missing required data'}), 400
        
        # Decode Firebase ID token to get UID (SECURE WAY)
        decoded_token = admin_auth.verify_id_token(token)
        user_uid = decoded_token['uid']
        
        # Fetch the paper to verify it exists
        # --- FIX: Removed .val() ---
        paper = db.child('papers').child(paper_id).get()
        
        if not paper: # <-- FIX
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper # <-- FIX
        # --- END FIX ---
        
        # Verify that the user owns this paper
        if paper_data.get('created_by_uid') != user_uid:
            return jsonify({'error': 'Unauthorized to delete this paper'}), 403
        
        # --- NEW LOGIC: Add to deleted index ---
        db.child('deleted_paper_index').child(user_uid).child(paper_id).set(True)
        
        return jsonify({
            'success': True, 
            'message': 'Paper marked as deleted successfully',
            'paper_id': paper_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

#
# --- (FIXED) ---
#
@app.route('/retrieve-papers', methods=['POST'])
def retrieve_papers():
    try:
        data = request.json
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Missing token'}), 400
            
        # Decode Firebase ID token to get UID (SECURE WAY)
        decoded_token = admin_auth.verify_id_token(token)
        user_uid = decoded_token['uid']

        # 1. Fetch all papers created by this user
        all_papers_snapshot = db.child('papers').order_by_child('created_by_uid').equal_to(user_uid).get()
        
        papers_list = []
        
        # --- FIX: Removed .val() and fixed loop ---
        if all_papers_snapshot: # <-- FIX
            # Convert the dictionary of papers into a list
            for paper_id, paper_data in all_papers_snapshot.items(): # <-- FIX
                paper_data['paper_id'] = paper_id # Ensure the ID is in the object
                papers_list.append(paper_data)
        # --- END FIX ---
            
            # Sort by creation date, newest first (optional, but good)
            papers_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # 2. Fetch the index of deleted papers for this user
        deleted_index_snapshot = db.child('deleted_paper_index').child(user_uid).get()
        
        deleted_ids = []
        
        # --- FIX: Removed .val() and fixed list conversion ---
        if deleted_index_snapshot: # <-- FIX
            # Get all the keys (which are the paper_ids)
            deleted_ids = list(deleted_index_snapshot.keys()) # <-- FIX
        # --- END FIX ---
            
        # 3. Return BOTH lists to the frontend
        return jsonify({
            'papers': papers_list,
            'deleted_ids': deleted_ids
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- (FIXED) ---
@app.route('/get-user-analytics', methods=['POST'])
def get_user_analytics():
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('userName')

        if not token or not user_name:
            return jsonify({'error': 'Missing authentication data'}), 400

        # Get user UID
        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                # USE ADMIN AUTH (SECURE WAY)
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid') # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        # Fetch all test results for this user
        all_results_snapshot = db.child('test_results').get() 
        user_results = []
        
        # --- FIX: Removed .val() and fixed loop ---
        if all_results_snapshot is not None:
            for result_key, result in all_results_snapshot.items(): # <-- FIX
                if result.get('user_uid') == user_uid:
                    user_results.append(result)
        # --- END FIX ---

        # Fetch paper details for each result
        detailed_results = []
        for result in user_results:
            paper_id = result.get('paper_id')
            if paper_id:
                # --- FIX: Removed .val() ---
                paper_data = db.child('papers').child(paper_id).get()
                # --- END FIX ---
                if paper_data:
                    result['paper_details'] = paper_data
            detailed_results.append(result)

        return jsonify({
            'results': detailed_results,
            'total_tests': len(detailed_results)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# --- (FIXED) ---
def get_weak_concepts(user_name: str) -> list:
    """
    Analyzes a user's test results to find the top 10 concepts they answer incorrectly most often.
    ...
    """
    print(f"\n--- 🕵️‍♂️ Starting weak concept analysis for user: '{user_name}' ---")
    
    try:
        all_papers_snapshot = db.child('papers').get()
        all_results_snapshot = db.child('test_results').get()
        
        user_test_results = []
        # --- FIX: Removed .val() and fixed loop ---
        if all_results_snapshot: # <-- FIX
            for result_key, result_val in all_results_snapshot.items(): # <-- FIX
                if result_val.get('user_name') == user_name:
                    user_test_results.append(result_val)
        # --- END FIX ---

        if not user_test_results:
            print(f"   - ‼️ No test results found for user '{user_name}' after filtering.")
            return []

        # --- FIX: Removed .val() ---
        all_papers = all_papers_snapshot if all_papers_snapshot else {} # <-- FIX
        # --- END FIX ---
        
        wrong_answer_counts = {}

        for result in user_test_results:
            paper_id = result.get('paper_id')
            user_answers = result.get('answers', {})

            paper_data = all_papers.get(paper_id)
            if not paper_data:
                print(f"   - ⚠️ WARNING: Paper ID '{paper_id}' not found for a test result. Skipping.")
                continue

            # ... (rest of the function logic is correct) ...
            correct_answer_keys = paper_data.get('correct_answer', [])
            options_list = paper_data.get('options', [])
            concepts_list = paper_data.get('concept', [])
            
            for i in range(len(correct_answer_keys)):
                if i >= len(options_list) or i >= len(concepts_list):
                    continue
                
                user_answer_value = None
                if isinstance(user_answers, dict):
                    user_answer_value = user_answers.get(str(i))
                elif isinstance(user_answers, list):
                    if i < len(user_answers): # Prevent IndexError
                        user_answer_value = user_answers[i]

                correct_key = correct_answer_keys[i]
                options_for_question = options_list[i]

                if isinstance(options_for_question, str):
                    try:
                        options_for_question = json.loads(options_for_question)
                    except json.JSONDecodeError:
                        print(f"   - ⚠️ WARNING: Could not parse options JSON for Q{i} in Paper {paper_id}.")
                        continue
                
                if not isinstance(options_for_question, dict):
                     print(f"   - ⚠️ WARNING: Options for Q{i} in Paper {paper_id} is not a dict. Skipping.")
                     continue
                     
                correct_answer_value = options_for_question.get(correct_key)

                if user_answer_value != correct_answer_value:
                    concept = concepts_list[i]
                    if concept:
                        wrong_answer_counts[concept] = wrong_answer_counts.get(concept, 0) + 1
        
        sorted_weak_concepts = sorted(wrong_answer_counts.items(), key=lambda item: item[1], reverse=True)
        top_10_concepts = [concept for concept, count in sorted_weak_concepts[:10]]

        print(f"   - ✅ Analysis complete. Top weak concepts: {top_10_concepts}")
        return top_10_concepts

    except Exception as e:
        print(f"   - 💥 An unexpected error occurred during weak concept analysis: {e}")
        import traceback
        traceback.print_exc()
        return []

# --- (FIXED) ---
def save_user_paper(paper_json, user_token, user_name):
    """
    Save paper with proper user identification
    """
    if not user_token or not user_name:
        print("Error: Missing user data")
        return None

    try:
        users_snapshot = db.child('users').get() 

        matched_user = None
        user_uid = None # <-- Initialize user_uid

        # --- FIX: Removed .val() and fixed loop ---
        if users_snapshot: # <-- FIX
            for node_key, data in users_snapshot.items(): # <-- FIX
                if data.get("name") == user_name:
                    matched_user = data
                    user_uid = node_key # <-- Get the user's actual UID (the key)
                    break
        # --- END FIX ---
        
        if not matched_user:
            # Fallback check using validate_user_token
            user_info = validate_user_token(user_token)
            if user_info:
                 user_uid = user_info.get('uid')
                 print(f"Could not find user by name, using token UID: {user_uid}")
            else:
                 raise ValueError("No user found with that name and token is invalid.")
        
        if not user_uid:
             raise ValueError("User UID could not be determined.")

        # ... (Your commented-out block is no longer needed) ...
        
        # Create unique ID for the paper
        paper_id = str(uuid.uuid4())

        # Add metadata to paper JSON
        paper_json['paper_id'] = paper_id
        paper_json['created_by'] = user_name
        paper_json['created_by_uid'] = user_uid
        paper_json['created_at'] = datetime.utcnow().isoformat()

        # Save paper in global "papers" collection
        db.child("papers").child(paper_id).set(paper_json)

        # Save reference under user's profile
        db.child("users").child(user_uid).child("papers").child(paper_id).set({
            'title': f"Paper {paper_id[:8]}",
            'created_at': datetime.utcnow().isoformat(),
            'question_count': len(paper_json.get('question_number', []))
        })

        print(f"Paper saved with ID {paper_id} for user {user_name} (UID: {user_uid})")
        return paper_id
        
    except Exception as e:
        print(f"Error saving paper: {e}")
        import traceback
        traceback.print_exc()
        
        # ... (rest of your fallback logic is fine) ...
        paper_id = str(uuid.uuid4())
        paper_json['paper_id'] = paper_id
        paper_json['created_by'] = user_name
        paper_json['created_at'] = datetime.utcnow().isoformat()
        
        db.child("papers").child(paper_id).set(paper_json)
        print(f"Paper saved with fallback method: {paper_id}")
        return paper_id

# Remove the separate /get_user_data endpoint as it's no longer needed
# @app.route('/get_user_data', methods=['POST'])
# def my_endpoint():
#     # This endpoint is no longer needed
#     pass


if __name__ == '__main__':
    # Run the Flask app on port 5000, accessible from any IP on your network.
    # Use debug=True for development to get auto-reloading and helpful error pages.
    # In a production environment, you would use a proper WSGI server like Gunicorn.
    port = int(os.environ.get("PORT", 5000))  # use Render's port or fallback to 5000 locally
    app.run(host="0.0.0.0", port=port, debug=True)