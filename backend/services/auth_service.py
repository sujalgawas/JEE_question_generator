# services/auth_service.py - Authentication helpers
from flask import session
from services.firebase_service import db, admin_auth


def verify_firebase_token(token):
    """
    Verifies a Firebase token.
    First tries verify_session_cookie (valid up to 14 days, bypasses 1-hour ID token limit).
    If that fails, tries verify_id_token (standard 1-hour token).
    Returns decoded token dict with 'uid', or None if invalid.
    """
    if not token or not isinstance(token, str):
        return None

    # 1. Try Firebase Session Cookie (bypasses 1-hour ID token limit, valid up to 14 days)
    try:
        decoded = admin_auth.verify_session_cookie(token, check_revoked=False)
        return decoded
    except Exception:
        pass

    # 2. Try standard Firebase ID token
    try:
        decoded = admin_auth.verify_id_token(token)
        return decoded
    except Exception:
        pass

    return None


def validate_user_token(token):
    """
    Validate user token and return user info dict, or None if invalid.
    Returns: {'uid': str, 'name': str, 'provider': str} or None
    """
    if not token or not isinstance(token, str):
        return None

    if token.startswith("session_"):
        uid = session.get('user_uid')
        if not uid:
            return None
        return {
            'uid': uid,
            'name': session.get('user_name', 'User'),
            'provider': 'google'
        }
    else:
        user_info = verify_firebase_token(token)
        if not user_info:
            return None

        uid = user_info['uid']
        user_data = db.child("users").child(uid).get()
        name = (user_data.get('name') if user_data else None) or user_info.get('name') or user_info.get('email', 'User').split('@')[0]
        return {
            'uid': uid,
            'name': name,
            'provider': 'firebase'
        }
