import json
import requests
from requests.exceptions import HTTPError
import firebase_admin
from firebase_admin import credentials, db as admin_db_sdk, auth as admin_auth_sdk
from config import ADMIN_SERVICE_KEY_PATH, GOOGLE_ACCOUNT_KEY_PATH, SERVICE_ACCOUNT_KEY_PATH


def _raise_detailed_error(response):
    """Raise HTTPError containing response text so e.args[1] matches Pyrebase error format."""
    try:
        response.raise_for_status()
    except HTTPError as e:
        raise HTTPError(e, response.text)


class FirebaseAuthClient:
    """
    Direct, lightweight Firebase Auth REST client replacing Pyrebase.
    Uses Google Identity Toolkit REST API without obsolete requests_toolbelt / AppEngine dependencies.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()

    def sign_in_with_email_and_password(self, email, password):
        url = f"https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key={self.api_key}"
        res = self.session.post(url, json={"email": email, "password": password, "returnSecureToken": True})
        _raise_detailed_error(res)
        return res.json()

    def create_user_with_email_and_password(self, email, password):
        url = f"https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key={self.api_key}"
        res = self.session.post(url, json={"email": email, "password": password, "returnSecureToken": True})
        _raise_detailed_error(res)
        return res.json()

    def send_email_verification(self, id_token):
        url = f"https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key={self.api_key}"
        res = self.session.post(url, json={"requestType": "VERIFY_EMAIL", "idToken": id_token})
        _raise_detailed_error(res)
        return res.json()

    def get_account_info(self, id_token):
        url = f"https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key={self.api_key}"
        res = self.session.post(url, json={"idToken": id_token})
        _raise_detailed_error(res)
        return res.json()

    def refresh(self, refresh_token):
        url = f"https://securetoken.googleapis.com/v1/token?key={self.api_key}"
        res = self.session.post(url, json={"grantType": "refresh_token", "refreshToken": refresh_token})
        _raise_detailed_error(res)
        data = res.json()
        return {
            "userId": data.get("user_id"),
            "idToken": data.get("id_token"),
            "refreshToken": data.get("refresh_token")
        }

    def send_password_reset_email(self, email):
        url = f"https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key={self.api_key}"
        res = self.session.post(url, json={"requestType": "PASSWORD_RESET", "email": email})
        _raise_detailed_error(res)
        return res.json()


class FirebaseClient:
    """Compatibility wrapper mimicking pyrebase.initialize_app()"""
    def __init__(self, config):
        self.config = config
        self._auth = FirebaseAuthClient(config.get("apiKey", ""))

    def auth(self):
        return self._auth


# --- Load config files ---
with open(ADMIN_SERVICE_KEY_PATH, 'r') as f:
    admin_config = json.load(f)

with open(GOOGLE_ACCOUNT_KEY_PATH, 'r') as f:
    google_config = json.load(f)

with open(SERVICE_ACCOUNT_KEY_PATH, 'r') as f:
    service_config = json.load(f)


# --- Initialize Firebase Admin SDK ---
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(admin_config)
    firebase_admin.initialize_app(cred, {
        'databaseURL': service_config.get('databaseURL')
    })

# --- Initialize Auth Client ---
firebase_client = FirebaseClient(service_config)


# --- Exports ---
db = admin_db_sdk.reference()          # Admin database reference
auth = firebase_client.auth()          # Firebase auth client
admin_auth = admin_auth_sdk            # Firebase Admin auth module
google_config = google_config          # Google OAuth client config (for auth routes)
