# --- OPTIMIZATION: Moved imports to be lazy-loaded where possible ---
from flask import Flask, request, jsonify, redirect, session, url_for
from flask_cors import CORS
# from agent import get_agent_graph  # <-- REMOVED: Will be lazy-loaded
# from concept_weight import concepts_for_paper # <-- REMOVED: Will be lazy-loaded
import pyrebase
import os
import json
# from google_auth_oauthlib.flow import Flow # <-- REMOVED: Will be lazy-loaded
# import requests # <-- REMOVED: Will be lazy-loaded
# import secrets # <-- REMOVED: Will be lazy-loaded
from datetime import datetime
import uuid
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, db as admin_db_sdk, auth as admin_auth_sdk
from flask import Response, stream_with_context
import time
import threading
# import psutil # <-- REMOVED: Will be lazy-loaded
import gc # --- OPTIMIZATION (6): Import garbage collector ---

def log_memory_usage(label=""):
    # --- OPTIMIZATION (1): Lazy import for psutil ---
    import psutil 
    process = psutil.Process(os.getpid())
    mem_bytes = process.memory_info().rss  # Resident Set Size
    mem_mb = mem_bytes / (1024 ** 2)
    print(f"[MEMORY] {label} - Current memory usage: {mem_mb:.2f} MB")


load_dotenv(dotenv_path=".env")
log_memory_usage("Initial startup")

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
cred = credentials.Certificate(config) 
firebase_admin.initialize_app(cred, {
    'databaseURL': config3.get('databaseURL') 
})

# --- 3. Initialize pyrebase (For User Signup/Login) ---
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

CORS(app, resources={r"/*": {"origins": [FRONTEND_ORIGIN]}}, supports_credentials=True)

SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']

# --- Existing Signup Endpoint (No changes needed) ---
@app.route('/signup', methods=['POST'])
def signup():
    # ... (No memory optimizations needed here)
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

# --- Existing Login Endpoint (No changes needed) ---
@app.route('/login', methods=['POST'])
def login():
    # ... (No memory optimizations needed here)
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
    
@app.route('/login/google')
def google_login():
    """
    Initiates the Google OAuth flow.
    """
    # --- OPTIMIZATION (1): Lazy loading auth/request libraries ---
    from google_auth_oauthlib.flow import Flow
    import secrets
    
    print("--- Starting Google OAuth flow ---")
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    
    try:
        flow = Flow.from_client_config(
            config2,
            scopes=SCOPES,
            redirect_uri=url_for('google_login_callback', _external=True)
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
    
@app.route('/login/google/callback')
def google_login_callback():
    """
    Handles the redirect from Google, exchanges the code for tokens,
    and creates/signs in the user.
    """
    # --- OPTIMIZATION (1): Lazy loading auth/request libraries ---
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
        config2,
        scopes=SCOPES,
        redirect_uri=url_for('google_login_callback', _external=True)
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
        
        # --- OPTIMIZATION (2): Memory-Efficient Firebase Access ---
        # Use a query to find the user by email instead of loading all users
        users_data_snapshot = db.child("users").order_by_child("email").equal_to(email).get()
        users_data = users_data_snapshot if users_data_snapshot else {}
        # --- END OPTIMIZATION ---
        
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
    
# --- OPTIMIZATION (7): Lazy LangGraph Initialization ---
print("Deferring LangGraph initialization...")
_langgraph_app_instance = None
_langgraph_lock = threading.Lock()

def get_langgraph_app():
    """
    Lazily initializes and returns the LangGraph app instance.
    This is thread-safe and ensures the model is loaded only when needed.
    """
    global _langgraph_app_instance
    # Use a lock to prevent race conditions during initialization
    with _langgraph_lock:
        if _langgraph_app_instance is None:
            log_memory_usage("Before LangGraph import")
            print("Initializing LangGraph agent (first use)...")
            # 1. Lazy import
            from agent import get_agent_graph
            _langgraph_app_instance = get_agent_graph()
            log_memory_usage("After LangGraph initialized")
            print("Agent initialized successfully.")
        return _langgraph_app_instance
# --- END OPTIMIZATION (7) ---


def validate_user_token(token):
    """
    Validate user token and return user info
    """
    if token.startswith("session_"):
        return {
            'uid': session.get('user_uid'),
            'name': session.get('user_name'),
            'provider': 'google'
        }
    else:
        try:
            user_info = admin_auth.verify_id_token(token)
            uid = user_info['uid']
            user_data = db.child("users").child(uid).get()
            name = user_data.get('name', 'User') if user_data else 'User'
            return {
                'uid': uid,
                'name': name,
                'provider': 'firebase'
            }
        except Exception as e:
            print(f"Firebase token validation failed: {e}")
            return None


# --- OPTIMIZATION (5): Removed In-Memory Duplicates ---
# Removed the global `user_data_store = {}` dictionary
# Removed the useless `/get_user_data` endpoint
# --- END OPTIMIZATION (5) ---

# Job storage (in production, use Redis or a database)
paper_generation_jobs = {}

class PaperGenerationJob:
    # --- OPTIMIZATION (3): Light-Weight Job Tracking ---
    # Storing user_uid instead of the full user_token
    def __init__(self, job_id, user_uid, user_name):
        self.job_id = job_id
        self.user_uid = user_uid # <-- CHANGED
        self.user_name = user_name
        self.status = 'pending'  # pending, running, completed, failed
        self.progress = 0
        self.stage = 'initializing'
        self.message = 'Job created'
        self.questions_generated = 0
        self.total_questions = 0
        self.paper_id = None
        self.error = None
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    # --- END OPTIMIZATION (3) ---

    def update(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            'job_id': self.job_id,
            'status': self.status,
            'progress': self.progress,
            'stage': self.stage,
            'message': self.message,
            'questions_generated': self.questions_generated,
            'total_questions': self.total_questions,
            'paper_id': self.paper_id,
            'error': self.error,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


# --- OPTIMIZATION (4): Streamlined Threads ---
# Function now only takes job_id, as all other info is in the job object
def generate_paper_background(job_id):
    """
    Background function that generates the paper and updates job status
    """
    log_memory_usage(f"Job {job_id} thread started")
    job = paper_generation_jobs.get(job_id)
    if not job:
        return

    # --- OPTIMIZATION (3): Get user info from the job object ---
    user_uid = job.user_uid
    user_name = job.user_name
    
    # --- OPTIMIZATION (6): Prepare for cleanup ---
    final_state = None
    paper_data = None
    app_instance = None
    
    try:
        job.update(status='running', stage='analyzing', progress=5, 
                   message='Analyzing your profile and weak areas...')

        # --- OPTIMIZATION (1): Lazy import ---
        from concept_weight import concepts_for_paper

        # Get weak concepts
        user_test_data = []
        if user_name:
            # --- OPTIMIZATION (2): Pass user_uid for efficient query ---
            user_test_data = get_weak_concepts(user_uid)
        
        job.update(progress=10, message='Weak concepts identified')

        total_questions_target = sum(
            subject_data.get('total_questions', 0) 
            for subject_data in concepts_for_paper.values()
        )
        job.update(total_questions=total_questions_target)

        initial_state = {
            "paper_structure": concepts_for_paper,
            "weak_concepts": user_test_data,
            "errors_encountered": []  # <-- ADD THIS LINE
        }

        job.update(stage='planning', progress=15, 
                   message='Planning paper structure...')

        # --- OPTIMIZATION (7): Get the lazy-loaded agent ---
        app_instance = get_langgraph_app()
        
        questions_generated = 0
        current_subject = None
        
        # Stream through the agent
        for event in app_instance.stream(initial_state):
            for node_name, node_output in event.items():
                
                if node_name == "plan_paper":
                    job.update(stage='planning', progress=20, 
                               message='Paper structure planned. Starting question generation...')
                
                elif node_name == "process_subject":
                    if 'final_paper' in node_output:
                        questions_generated = len(node_output['final_paper'].get('question_number', []))
                        
                        if total_questions_target > 0:
                            gen_progress = int(20 + (questions_generated / total_questions_target) * 50)
                        else:
                            gen_progress = 20
                        
                        if node_output.get('subjects_to_process'):
                            subjects_remaining = len(node_output['subjects_to_process'])
                            current_subject = list(concepts_for_paper.keys())[len(concepts_for_paper) - subjects_remaining - 1]
                        else:
                            current_subject = "Final subject"
                        
                        job.update(
                            stage='generating',
                            progress=gen_progress,
                            message=f'Generating questions for {current_subject}... ({questions_generated}/{total_questions_target})',
                            questions_generated=questions_generated
                        )
                
                elif node_name == "process_distractor":
                    job.update(stage='distractors', progress=75, 
                               message='Adding answer options and distractors...')

        job.update(stage='finalizing', progress=90, 
                   message='Finalizing paper...')
        
        final_state = app_instance.invoke(initial_state)
        paper_data = final_state.get('final_paper')

        if not paper_data:
            job.update(status='failed', error='Agent failed to produce paper data')
            return

        job.update(stage='saving', progress=95, 
                   message='Saving to your account...')
        
        # --- OPTIMIZATION (2): Pass user_uid for efficient save ---
        paper_id = save_user_paper(paper_data, user_uid, user_name)
        
        job.update(
            status='completed',
            stage='complete',
            progress=100,
            message='Paper generated successfully!',
            paper_id=paper_id
        )

        print(f"✅ Job {job_id} completed successfully. Paper ID: {paper_id}")

    except Exception as e:
        print(f"❌ Error in job {job_id}: {e}")
        import traceback
        traceback.print_exc()
        job.update(status='failed', error=str(e))
        
    finally:
        # --- OPTIMIZATION (6): Garbage Collection & Object Cleanup ---
        # Explicitly delete large objects and run garbage collection
        # to free memory immediately after the job.
        del paper_data
        del final_state
        del app_instance # Dereference the app
        gc.collect()
        log_memory_usage(f"Job {job_id} finished. GC run.")


@app.route('/start-paper-generation', methods=['POST'])
def start_paper_generation():
    """
    Start a background paper generation job
    """
    try:
        data = request.get_json()
        user_token = data.get('token')
        # user_name = data.get('name') # <-- No longer needed from request

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401

        # --- OPTIMIZATION (3): Get uid and name from validator ---
        user_uid = user_info['uid']
        user_name = user_info['name']

        for job_id, job in paper_generation_jobs.items():
            # Check by UID for more reliability
            if job.user_uid == user_uid and job.status in ['pending', 'running']:
                return jsonify({
                    "message": "Job already running",
                    "job_id": job_id,
                    "job": job.to_dict()
                }), 200

        job_id = str(uuid.uuid4())
        # --- OPTIMIZATION (3): Create job with uid ---
        job = PaperGenerationJob(job_id, user_uid, user_name)
        paper_generation_jobs[job_id] = job

        # --- OPTIMIZATION (4): Streamlined thread args ---
        thread = threading.Thread(
            target=generate_paper_background,
            args=(job_id,), # Only pass the job_id
            daemon=True
        )
        thread.start()

        print(f"🚀 Started job {job_id} for user {user_name} (UID: {user_uid})")

        return jsonify({
            "message": "Paper generation started",
            "job_id": job_id,
            "job": job.to_dict()
        }), 200

    except Exception as e:
        print(f"Error starting paper generation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/paper-generation-status/<job_id>', methods=['GET'])
def get_paper_generation_status(job_id):
    job = paper_generation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job.to_dict()), 200


@app.route('/user-active-jobs', methods=['POST'])
def get_user_active_jobs():
    try:
        data = request.get_json()
        user_token = data.get('token')
        # user_name = data.get('name') # No longer needed

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        user_uid = user_info['uid']

        user_jobs = []
        for job_id, job in paper_generation_jobs.items():
            # --- OPTIMIZATION (3): Find jobs by uid ---
            if job.user_uid == user_uid:
                user_jobs.append(job.to_dict())

        user_jobs.sort(key=lambda x: x['created_at'], reverse=True)
        return jsonify({"jobs": user_jobs}), 200

    except Exception as e:
        print(f"Error getting user jobs: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/cancel-paper-generation/<job_id>', methods=['POST'])
def cancel_paper_generation(job_id):
    # ... (No memory optimizations needed here)
    job = paper_generation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job.status in ['completed', 'failed']:
        return jsonify({"error": "Job already finished"}), 400
    job.update(status='cancelled', message='Job cancelled by user')
    return jsonify({"message": "Job cancelled", "job": job.to_dict()}), 200


@app.route('/cleanup-old-jobs', methods=['POST'])
def cleanup_old_jobs():
    from datetime import timedelta
    
    cutoff_time = datetime.now() - timedelta(hours=24)
    jobs_to_remove = []
    
    for job_id, job in paper_generation_jobs.items():
        if job.created_at < cutoff_time:
            jobs_to_remove.append(job_id)
    
    for job_id in jobs_to_remove:
        del paper_generation_jobs[job_id]
    
    # --- OPTIMIZATION (6): Run GC after deleting objects ---
    gc.collect()
    
    return jsonify({
        "message": f"Cleaned up {len(jobs_to_remove)} old jobs"
    }), 200

@app.route('/generate-paper', methods=['POST'])
def generate_paper_endpoint():
    print("\n--- Received request at /generate-paper ---")
    
    # --- OPTIMIZATION (6): Prepare for cleanup ---
    final_state = None
    paper_data = None
    app_instance = None

    try:
        data = request.get_json()
        user_token = data.get('token')
        # user_name = data.get('name') # <-- Redundant

        user_info = validate_user_token(user_token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401

        # --- OPTIMIZATION (5): Use validated user info directly ---
        user_uid = user_info['uid']
        user_name = user_info['name']

        print(f"User data received: name={user_name}, token={'***' if user_token else 'None'}")

        # --- OPTIMIZATION (1): Lazy import ---
        from concept_weight import concepts_for_paper
        
        # --- OPTIMIZATION (2): Pass user_uid ---
        user_test_data = []
        if user_name:
            user_test_data = get_weak_concepts(user_uid)
        
        print(f"Weak concepts for user: {user_test_data}")

        initial_state = {
            "paper_structure": concepts_for_paper,
            "weak_concepts" : user_test_data,
            "errors_encountered": []  # <-- ADD THIS LINE
        }

        print("Invoking the agent... This may take a while.")
        
        # --- OPTIMIZATION (7): Get lazy-loaded agent ---
        app_instance = get_langgraph_app()
        final_state = app_instance.invoke(initial_state)
        
        paper_data = final_state.get('final_paper')

        if not paper_data:
            print("Error: Agent finished but 'final_paper' key is missing or empty.")
            return jsonify({"error": "Agent failed to produce paper data."}), 500

        print(f"Agent finished. Total questions generated: {len(paper_data.get('question_number', []))}")
        
        # --- OPTIMIZATION (2): Pass user_uid for efficient save ---
        paper_id = save_user_paper(paper_data, user_uid, user_name)
        
        paper_data['paper_id'] = paper_id
        
        # --- OPTIMIZATION (6): Run GC before returning ---
        del final_state
        del paper_data
        del app_instance
        gc.collect()
        log_memory_usage("After /generate-paper GC")
        # ---
        
        return jsonify(paper_data)

    except Exception as e:
        print(f"An error occurred during agent invocation: {e}")
        import traceback
        traceback.print_exc()
        
        # --- OPTIMIZATION (6): Run GC on error ---
        del final_state
        del paper_data
        del app_instance
        gc.collect()
        log_memory_usage("After /generate-paper ERROR GC")
        # ---
        
        return jsonify({"error": str(e)}), 500
    
@app.route('/get-paper-for-test', methods=['POST'])
def get_paper_for_test():
    # ... (This endpoint is efficient, no changes needed)
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paperId')

        if not token or not paper_id:
            return jsonify({'error': 'Missing token or paper ID'}), 400

        paper_data = db.child('papers').child(paper_id).get()
        
        if paper_data is None:
            return jsonify({'error': 'Paper not found'}), 404
            
        return jsonify({'paper': paper_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/submit-test-result', methods=['POST'])
def submit_test_result():
    # ... (This endpoint is efficient, no changes needed)
    try:
        data = request.json
        token = data.get('token')
        user_name = data.get('userName')
        test_result = data.get('testResult')

        if not token or not user_name or not test_result:
            return jsonify({'error': 'Missing required data'}), 400

        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid') # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        paper_id = test_result['paperId']
        user_answers = test_result['answers']
        
        paper_data = db.child('papers').child(paper_id).get()
        
        if not paper_data:
            return jsonify({'error': 'Paper not found'}), 404

        correct_answer_keys = paper_data.get('correct_answer', [])
        options_data = paper_data.get('options', [])
        score = 0
        total_questions = len(correct_answer_keys)

        def get_option_value(options_obj, key):
            if not options_obj or not key:
                return None
            return options_obj.get(key)

        for index, correct_key in enumerate(correct_answer_keys):
            user_answer = user_answers.get(str(index))
            
            if index < len(options_data):
                correct_value = get_option_value(options_data[index], correct_key)
                if user_answer == correct_value:
                    score += 1

        result_id = str(uuid.uuid4())

        result_data = {
            'result_id': result_id,
            'user_uid': user_uid, # <-- Good, this is indexed
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

        db.child("test_results").child(result_id).set(result_data)

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
    
@app.route('/delete-paper', methods=['POST'])
def delete_paper():
    # ... (This endpoint is efficient, no changes needed)
    try:
        data = request.json
        token = data.get('token')
        paper_id = data.get('paper_id')
        
        if not token or not paper_id:
            return jsonify({'error': 'Missing required data'}), 400
        
        decoded_token = admin_auth.verify_id_token(token)
        user_uid = decoded_token['uid']
        
        paper = db.child('papers').child(paper_id).get()
        
        if not paper:
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper
        
        if paper_data.get('created_by_uid') != user_uid:
            return jsonify({'error': 'Unauthorized to delete this paper'}), 403
        
        db.child('deleted_paper_index').child(user_uid).child(paper_id).set(True)
        
        return jsonify({
            'success': True, 
            'message': 'Paper marked as deleted successfully',
            'paper_id': paper_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/retrieve-papers', methods=['POST'])
def retrieve_papers():
    # ... (This endpoint is efficient, no changes needed)
    try:
        data = request.json
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Missing token'}), 400
            
        decoded_token = admin_auth.verify_id_token(token)
        user_uid = decoded_token['uid']

        all_papers_snapshot = db.child('papers').order_by_child('created_by_uid').equal_to(user_uid).get()
        
        papers_list = []
        
        if all_papers_snapshot:
            for paper_id, paper_data in all_papers_snapshot.items():
                paper_data['paper_id'] = paper_id
                papers_list.append(paper_data)
            
            papers_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        deleted_index_snapshot = db.child('deleted_paper_index').child(user_uid).get()
        
        deleted_ids = []
        
        if deleted_index_snapshot:
            deleted_ids = list(deleted_index_snapshot.keys())
            
        return jsonify({
            'papers': papers_list,
            'deleted_ids': deleted_ids
        }), 200

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

        user_uid = None
        if token.startswith("session_"):
            user_uid = session.get('user_uid')
        else:
            try:
                decoded_token = admin_auth.verify_id_token(token)
                user_uid = decoded_token['uid']
            except:
                user_uid = session.get('user_uid') # Fallback

        if not user_uid:
            return jsonify({'error': 'Could not identify user'}), 400

        # --- OPTIMIZATION (2): Memory-Efficient Firebase Access ---
        # Use a query to get only this user's results
        all_results_snapshot = db.child('test_results').order_by_child('user_uid').equal_to(user_uid).get()
        # --- END OPTIMIZATION ---

        user_results = []
        
        if all_results_snapshot is not None:
            # --- OPTIMIZATION: Convert snapshot values to list ---
            user_results = list(all_results_snapshot.values())
            # ---
            
        detailed_results = []
        for result in user_results:
            paper_id = result.get('paper_id')
            if paper_id:
                # This N+1 query pattern is memory-safe
                paper_data = db.child('papers').child(paper_id).get()
                if paper_data:
                    result['paper_details'] = paper_data
            detailed_results.append(result)

        return jsonify({
            'results': detailed_results,
            'total_tests': len(detailed_results)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# --- OPTIMIZATION (2): Function now accepts user_uid for efficient querying ---
def get_weak_concepts(user_uid: str) -> list:
    """
    Analyzes a user's test results to find the top 10 concepts they answer incorrectly most often.
    """
    print(f"\n--- 🕵️‍♂️ Starting weak concept analysis for user UID: '{user_uid}' ---")
    
    try:
        # --- OPTIMIZATION (2): Memory-Efficient Firebase Access ---
        # Query for results matching the user_uid instead of loading all results
        all_results_snapshot = db.child('test_results').order_by_child('user_uid').equal_to(user_uid).get()
        # --- END OPTIMIZATION ---

        user_test_results = []
        if all_results_snapshot:
            user_test_results = list(all_results_snapshot.values())

        if not user_test_results:
            print(f"   - ‼️ No test results found for user UID '{user_uid}'.")
            return []

        # --- OPTIMIZATION (2): Removed loading all papers ---
        # all_papers = all_papers_snapshot if all_papers_snapshot else {} # <-- REMOVED
        
        wrong_answer_counts = {}

        for result in user_test_results:
            paper_id = result.get('paper_id')
            user_answers = result.get('answers', {})

            # --- OPTIMIZATION (2): Fetch only the single paper required ---
            paper_data = db.child('papers').child(paper_id).get()
            
            if not paper_data:
                print(f"   - ⚠️ WARNING: Paper ID '{paper_id}' not found for a test result. Skipping.")
                continue
            # --- END OPTIMIZATION ---

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
                    if i < len(user_answers):
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

# --- OPTIMIZATION (2): Function now accepts uid/name directly ---
def save_user_paper(paper_json, user_uid, user_name):
    """
    Save paper with proper user identification (now memory-efficient)
    """
    if not user_uid or not user_name:
        print("Error: Missing user_uid or user_name")
        return None

    try:
        # The complex logic to find the user is no longer needed,
        # as we now pass the UID directly.

        paper_id = str(uuid.uuid4())

        paper_json['paper_id'] = paper_id
        paper_json['created_by'] = user_name
        paper_json['created_by_uid'] = user_uid
        paper_json['created_at'] = datetime.utcnow().isoformat()

        db.child("papers").child(paper_id).set(paper_json)

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
        return None # Return None on failure


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    # --- OPTIMIZATION: Tie debug mode to FLASK_ENV ---
    # Render will use a WSGI server, but this is good practice
    # debug=True reloads and can consume more memory.
    app.run(host="0.0.0.0", port=port, debug=(config_flask == 'development'))