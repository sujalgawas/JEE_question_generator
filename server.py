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
REDIRECT_URI = "https://jee-question-generator.onrender.com/login/google/callback"
# The URL your frontend is running on
FRONTEND_URL = "https://sujalgawas.github.io/JEE_question_generator/#/" # If your frontend also uses HTTPS

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
        # In your Google OAuth callback, ensure session data is set
        session['user_uid'] = user_uid
        session['user_name'] = name
        session['auth_provider'] = 'google'
        session['google_id'] = google_user_id
        session.permanent = True  # Make session persistent
        
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

def validate_user_token(token):
    """
    Validate user token and return user info
    """
    if token.startswith("session_"):
        # Session-based token
        return {
            'uid': session.get('user_uid'),
            'name': session.get('user_name'),
            'provider': 'google'
        }
    else:
        # Firebase ID token
        try:
            user_info = auth.get_account_info(token)
            uid = user_info['users'][0]['localId']
            # Get name from database
            user_data = db.child("users").child(uid).get().val()
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
        if user_name:
            user_test_data = get_user_data(user_name)
        
        print(user_test_data)

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
        return jsonify({"error": str(e)}), 500
    
@app.route('/get-paper-for-test', methods=['POST'])
def get_paper_for_test():
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paperId')

        if not token or not paper_id:
            return jsonify({'error': 'Missing token or paper ID'}), 400

        # Get paper from database
        paper_data = db.child('papers').child(paper_id).get()
        
        if paper_data.val() is None:
            return jsonify({'error': 'Paper not found'}), 404
            
        return jsonify({'paper': paper_data.val()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
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
                user_info = auth.get_account_info(token)
                user_uid = user_info['users'][0]['localId']
            except:
                user_uid = session.get('user_uid')

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        # Calculate score
        paper_id = test_result['paperId']
        user_answers = test_result['answers']
        
        # Get correct answers from paper
        paper_data = db.child('papers').child(paper_id).get().val()
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


@app.route('/retrieve-papers', methods=['POST'])
def retrieve_papers():
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('name')  # match your frontend naming

        if not token or not user_name:
            return jsonify({'error': 'Missing authentication data'}), 400
        
        # Decode Firebase ID token to get UID
        decoded_token = auth.get_account_info(token)
        user_uid = decoded_token['users'][0]['localId']

        # Fetch all papers from 'papers' collection
        all_papers = db.child('papers').get()

        # Filter papers that match this user's UID
        user_papers = []
        if all_papers.each() is not None:
            for paper_snapshot in all_papers.each():
                paper = paper_snapshot.val()
                if paper.get('created_by_uid') == user_uid or paper.get('created_by') == user_name:
                    user_papers.append(paper)

        return jsonify({'papers': user_papers}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
                user_info = auth.get_account_info(token)
                user_uid = user_info['users'][0]['localId']
            except:
                user_uid = session.get('user_uid')

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        # Fetch all test results for this user
        all_results = db.child('test_results').get()
        user_results = []
        
        if all_results.each() is not None:
            for result_snapshot in all_results.each():
                result = result_snapshot.val()
                if result.get('user_uid') == user_uid:
                    user_results.append(result)

        # Fetch paper details for each result
        detailed_results = []
        for result in user_results:
            paper_id = result.get('paper_id')
            if paper_id:
                paper_data = db.child('papers').child(paper_id).get().val()
                if paper_data:
                    result['paper_details'] = paper_data
            detailed_results.append(result)

        return jsonify({
            'results': detailed_results,
            'total_tests': len(detailed_results)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
def get_user_data(user_name):
    papers = db.child('papers').get()
    test_results = db.child('test_results').get()

    user_papers = []
    user_test_results = []

    # Get papers created by the user
    if papers.each():
        for paper in papers.each():
            paper_data = paper.val()
            # Fix: Use 'created_by_uid' instead of 'created_by' based on your DB structure
            if paper_data.get('created_by') == user_name:
                user_papers.append(paper_data)

    # Get test results - need to filter by a user identifier
    # Since there's no 'user_name' field visible, you might need to add one
    # or use a different field to identify the user
    if test_results.each():
        for result in test_results.each():
            result_data = result.val()
            # You'll need to add a user identifier field to test_results
            # For now, assuming you add 'user_id' or similar field
            if result_data.get('user_name') == user_name:
                user_test_results.append(result_data)
    
    final_concepts = {}
    
    # Process each test result
    for test_result in user_test_results:
        paper_id = test_result.get('paper_id')
        answers = test_result.get('answers', {})
        
        # Find the corresponding paper
        matching_paper = None
        for paper in user_papers:
            if paper.get('paper_id') == paper_id:
                matching_paper = paper
                break
        
        if matching_paper:
            # Get the concept for this paper
            concept = matching_paper.get('concept')
            correct_answer = matching_paper.get('correct_answer')
            
            """
            final_concepts[paper_id] = {
                'concept': concept,
                'correct_answer': correct_answer,
                'user_answers': answers,
                'question_text': matching_paper.get('question_text'),
                'options': matching_paper.get('options')
            }"""
        
    #analysis part
    final_concepts_matrix = {}

    for subject in ["Chemistry", "Physics", "Maths"]:
        final_concepts_matrix.update(concepts_for_paper[subject]["concepts"])  

    concept_names = list(final_concepts_matrix.keys())

    # 1. initialise counters at 0
    counts_dict = {name: 0 for name in concept_names}

    # 2. tally correct answers
    for c in concept:
        if c in counts_dict:          # ignore any stray concepts
            counts_dict[c] += 1

    # 3. convert to a list if you need a numeric vector / matrix row
    counts_list = [counts_dict[name] for name in concept_names]

    # 4. topics the learner still struggles with
    weak_topics = [name for name, cnt in counts_dict.items() if cnt == 0]

    #return counts_dict, counts_list, weak_topics
    return weak_topics

def save_user_paper(paper_json, user_token, user_name):
    """
    Save paper with proper user identification
    """
    if not user_token or not user_name:
        print("Error: Missing user data")
        return None

    try:
        users = db.child('users').get()

        matched_user = None
        if users.each():
            for node in users.each():                # node.key() is the push key; node.val() is the dict
                data = node.val()
                if data.get("name") == user_name:
                    matched_user = data              # keep the first match (or break after setting)
                    break

        if not matched_user:
            raise ValueError("No user found with that name")

        user_uid = matched_user.get("firebase_uid")

        """
        user_uid = None
        
        # Check if this is a session-based token (from Google OAuth)
        if user_token.startswith("session_"):
            print("Using session-based authentication")
            # For Google OAuth users, use session data
            user_uid = session.get('user_uid')
            if not user_uid:
                print("Error: No user_uid in session")
                return None
        else:
            # Try to validate as Firebase ID token
            try:
                user_info = auth.get_account_info(user_token)
                user_uid = user_info['users'][0]['localId']
                print(f"Decoded user UID from Firebase token: {user_uid}")
            except Exception as e:
                print(f"Invalid Firebase token: {e}")
                # Fallback to session data
                user_uid = session.get('user_uid')
                if not user_uid:
                    print("Error: Could not identify user")
                    return None
        """
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
        # Final fallback: save without user association
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
