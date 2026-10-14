import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveAuthSession } from './authUtils';
import API_URL from '../apiConfig';

function AuthCallback() {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const processAuth = async () => {
            const idToken = searchParams.get('idToken');
            const name = searchParams.get('name');
            const error = searchParams.get('error');

            if (window.opener) {
                if (error) {
                    console.error('Authentication error from callback:', error);
                    window.opener.postMessage({
                        type: 'auth-error',
                        error: error,
                    }, window.location.origin);
                } else if (idToken && name) {
                    console.log('Authentication successful. Exchanging session.');
                    let sessionToken = idToken;
                    try {
                        const res = await fetch(`${API_URL}/session-login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ idToken, name }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.idToken) sessionToken = data.idToken;
                        }
                    } catch (e) {
                        console.warn('Session exchange in callback failed, fallback:', e);
                    }

                    saveAuthSession(sessionToken, name);
                    
                    window.opener.postMessage({
                        type: 'auth-success',
                        token: sessionToken,
                        name: name,
                    }, window.location.origin);
                } else {
                    window.opener.postMessage({
                        type: 'auth-error',
                        error: 'Missing authentication parameters.',
                    }, window.location.origin);
                }
                
                setTimeout(() => {
                    window.close();
                }, 100);
            } else {
                console.error('This callback page was not opened by a popup.');
                if (idToken && name) {
                    let sessionToken = idToken;
                    try {
                        const res = await fetch(`${API_URL}/session-login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ idToken, name }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.idToken) sessionToken = data.idToken;
                        }
                    } catch (e) {
                        console.warn('Session exchange failed:', e);
                    }
                    saveAuthSession(sessionToken, name);
                    window.location.href = '/dashboard';
                } else if (error) {
                    window.location.href = '/login?error=' + encodeURIComponent(error);
                }
            }
        };

        processAuth();
    }, [searchParams]);

    // Render a simple loading/processing state
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-300">Processing authentication...</p>
            </div>
        </div>
    );
}

export default AuthCallback;