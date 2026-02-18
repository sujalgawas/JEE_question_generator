# services/firebase_service.py - Firebase initialization and client exports
import json
import firebase_admin
from firebase_admin import credentials, db as admin_db_sdk, auth as admin_auth_sdk
import pyrebase
from config import ADMIN_SERVICE_KEY_PATH, GOOGLE_ACCOUNT_KEY_PATH, SERVICE_ACCOUNT_KEY_PATH


# --- Load config files ---
with open(ADMIN_SERVICE_KEY_PATH, 'r') as f:
    admin_config = json.load(f)

with open(GOOGLE_ACCOUNT_KEY_PATH, 'r') as f:
    google_config = json.load(f)

with open(SERVICE_ACCOUNT_KEY_PATH, 'r') as f:
    service_config = json.load(f)


# --- Initialize Firebase Admin SDK ---
cred = credentials.Certificate(admin_config)
firebase_admin.initialize_app(cred, {
    'databaseURL': service_config.get('databaseURL')
})

# --- Initialize Pyrebase (for user signup/login) ---
firebase_client = pyrebase.initialize_app(service_config)


# --- Exports ---
db = admin_db_sdk.reference()          # Admin database reference
auth = firebase_client.auth()          # Pyrebase auth client
admin_auth = admin_auth_sdk            # Firebase Admin auth module
google_config = google_config          # Google OAuth client config (for auth routes)
