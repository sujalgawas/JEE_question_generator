// authUtils.js
// Central helpers for cookie-based auth persistence.
// Login sessions are kept for up to 14 days via Firebase Session Cookies and cookies instead of localStorage.
// Token refresh logic ensures tokens are refreshed before they expire (Firebase 1-hour bypass).

import Cookies from 'js-cookie';
import axios from 'axios';
import API_URL from '../apiConfig';
import { auth as firebaseAuth } from '../firebaseConfig';

// Maximum lifetime of a Firebase session cookie is 14 days
export const AUTH_COOKIE_MAX_AGE_DAYS = 14;

// Token buffer: refresh the token if within 30 minutes of expiration
const TOKEN_REFRESH_BUFFER_SECONDS = 30 * 60;

// Cookie options: 14 days validity, secure over HTTPS, Lax for OAuth redirects
const cookieOptions = {
    expires: AUTH_COOKIE_MAX_AGE_DAYS,
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https:',
};

/**
 * Decodes a JWT token without verification to get its expiration (exp claim).
 * Returns the expiration timestamp in seconds, or null if invalid.
 */
export const decodeTokenExpiration = (token) => {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window
                .atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const parsed = JSON.parse(jsonPayload);
        return parsed.exp || null;
    } catch (e) {
        console.warn('Failed to decode token expiration:', e);
        return null;
    }
};

/**
 * Checks if the token is about to expire (within the refresh buffer) or already expired.
 * @param {string} token - The Firebase ID or Session token
 * @returns {boolean} True if the token should be refreshed
 */
export const shouldRefreshToken = (token) => {
    if (!token) return true;
    const exp = decodeTokenExpiration(token);
    if (exp === null) return false;
    const now = Math.floor(Date.now() / 1000);
    return now >= exp - TOKEN_REFRESH_BUFFER_SECONDS;
};

/**
 * Persists the login session (token + user name + optional refresh token) in cookies.
 * Also clears any legacy localStorage values from old auth flows.
 */
export const saveAuthSession = (token, name, refreshToken) => {
    if (token) Cookies.set('idToken', token, cookieOptions);
    if (name) Cookies.set('userName', name, cookieOptions);
    if (refreshToken) Cookies.set('refreshToken', refreshToken, cookieOptions);

    // Remove stale values written by any legacy localStorage-based flows
    localStorage.removeItem('idToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('refreshToken');
};

/** Clears the persisted login session across all auth cookies and storage. */
export const clearAuthSession = () => {
    Cookies.remove('idToken', { path: '/' });
    Cookies.remove('userName', { path: '/' });
    Cookies.remove('refreshToken', { path: '/' });
    localStorage.removeItem('idToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('refreshToken');
};

/** Returns the current session as { token, name, refreshToken }. */
export const getAuthSession = () => ({
    token: Cookies.get('idToken'),
    name: Cookies.get('userName'),
    refreshToken: Cookies.get('refreshToken'),
});

/**
 * Checks if a user is currently logged in based on the presence of auth cookies.
 * @returns {boolean} True if a user is logged in, false otherwise.
 */
export const checkLoginStatus = () => {
    const { token, name } = getAuthSession();
    if (!token || !name) return false;
    const exp = decodeTokenExpiration(token);
    if (exp !== null) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= exp) {
            // Token expired: check if refresh is possible
            const refreshToken = Cookies.get('refreshToken');
            const hasFirebaseUser = Boolean(firebaseAuth && firebaseAuth.currentUser);
            return Boolean(refreshToken || hasFirebaseUser);
        }
    }
    return true;
};

/**
 * Refreshes the Firebase authentication session.
 * Supports:
 * 1. Firebase client SDK (e.g. Google Sign-In) -> forces fresh ID token and exchanges for 14-day session cookie.
 * 2. Pyrebase refresh token (Email/Password) -> calls /refresh-token backend endpoint for a new 14-day session cookie.
 * @returns {Promise<string|null>} The new refreshed token, or null if refresh fails
 */
export const forceTokenRefresh = async () => {
    try {
        // Strategy 1: Firebase Client SDK (Google Sign-In)
        if (firebaseAuth && firebaseAuth.currentUser) {
            try {
                const freshIdToken = await firebaseAuth.currentUser.getIdToken(true);
                // Exchange 1-hour ID token for a 14-day session cookie
                try {
                    const res = await axios.post(`${API_URL}/session-login`, {
                        idToken: freshIdToken,
                    });
                    if (res.data && res.data.idToken) {
                        const { name: currentName } = getAuthSession();
                        saveAuthSession(res.data.idToken, res.data.name || currentName);
                        return res.data.idToken;
                    }
                } catch (exchErr) {
                    console.warn('Session exchange during refresh failed, fallback to fresh ID token:', exchErr);
                }
                const { name: currentName } = getAuthSession();
                saveAuthSession(freshIdToken, currentName);
                return freshIdToken;
            } catch (err) {
                console.warn('Firebase currentUser token refresh failed:', err);
            }
        }

        // Strategy 2: Backend refresh token (Pyrebase Email/Password login)
        const storedRefreshToken = Cookies.get('refreshToken');
        if (storedRefreshToken) {
            try {
                const res = await axios.post(`${API_URL}/refresh-token`, {
                    refreshToken: storedRefreshToken,
                });
                if (res.data && res.data.idToken) {
                    const { name: currentName } = getAuthSession();
                    saveAuthSession(
                        res.data.idToken,
                        res.data.name || currentName,
                        res.data.refreshToken || storedRefreshToken
                    );
                    return res.data.idToken;
                }
            } catch (refErr) {
                console.error('Backend refresh token failed:', refErr);
            }
        }

        return null;
    } catch (error) {
        console.error('forceTokenRefresh unexpected error:', error);
        return null;
    }
};

/**
 * Returns a guaranteed valid token.
 * Refreshes automatically if the current token is near expiration or expired.
 */
export const getValidToken = async () => {
    let { token } = getAuthSession();
    if (!token) return null;
    if (shouldRefreshToken(token)) {
        const refreshed = await forceTokenRefresh();
        if (refreshed) {
            token = refreshed;
        }
    }
    return token;
};

