import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function AuthCallback() {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const idToken = searchParams.get('idToken');
        const name = searchParams.get('name');
        const error = searchParams.get('error');

        // Check if this window was opened by another window
        if (window.opener) {
            if (error) {
                console.error('Authentication error from callback:', error);
                // Send an error message back to the main window
                window.opener.postMessage({
                    type: 'auth-error',
                    error: error,
                }, window.location.origin); // Use window.location.origin instead of hardcoded URL
            } else if (idToken && name) {
                console.log('Authentication successful. Posting message to opener.');
                
                // Store the user data in localStorage immediately
                // This ensures the data persists even if the message doesn't reach the parent
                localStorage.setItem('idToken', idToken);
                localStorage.setItem('userName', name);
                
                // Send the success data back to the main window
                window.opener.postMessage({
                    type: 'auth-success',
                    token: idToken,
                    name: name,
                }, window.location.origin);
                
                // Also trigger a storage event to notify other windows/tabs
                window.opener.dispatchEvent(new StorageEvent('storage', {
                    key: 'idToken',
                    newValue: idToken,
                    storageArea: localStorage
                }));
                
            } else {
                // Handle cases where params are missing
                window.opener.postMessage({
                    type: 'auth-error',
                    error: 'Missing authentication parameters.',
                }, window.location.origin);
            }
            
            // Close the popup window after a short delay to ensure message is sent
            setTimeout(() => {
                window.close();
            }, 100);
        } else {
            console.error('This callback page was not opened by a popup.');
            // If not a popup, store data and redirect
            if (idToken && name) {
                localStorage.setItem('idToken', idToken);
                localStorage.setItem('userName', name);
                window.location.href = '/dashboard';
            } else if (error) {
                window.location.href = '/login?error=' + encodeURIComponent(error);
            }
        }
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