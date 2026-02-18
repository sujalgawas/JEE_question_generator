# services/auth_service.py - Authentication helpers
from flask import session
from services.firebase_service import db, admin_auth


def validate_user_token(token):
    """
    Validate user token and return user info dict, or None if invalid.
    Returns: {'uid': str, 'name': str, 'provider': str} or None
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
