import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            setIsError(true);
            setStatusMessage('An error occurred. Please try again.');
        }
    }, [searchParams]);

    useEffect(() => {
        const handleAuthMessage = (event) => {
            if (event.origin !== window.location.origin) {
                console.warn(`Ignored message from unexpected origin: ${event.origin}`);
                return;
            }

            const { type, token, name, error } = event.data;

            if (type === 'auth-success') {
                console.log('Login component received auth success message.');
                // Store in localStorage immediately
                localStorage.setItem('idToken', token);
                localStorage.setItem('userName', name);
                // Call the parent function
                onLoginSuccess(name, token);
                // Navigate to dashboard
                navigate('/dashboard');
            } else if (type === 'auth-error') {
                console.error('Login component received auth error message:', error);
                setIsError(true);
                setStatusMessage(`Google authentication failed: ${error}`);
            }
        };

        window.addEventListener('message', handleAuthMessage);

        return () => {
            window.removeEventListener('message', handleAuthMessage);
        };
    }, [onLoginSuccess, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatusMessage('');
        setIsError(false);
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:5000/login', { 
                email, 
                password 
            });
            
            if (response.data.status === "success") {
                const { name, idToken } = response.data;
                
                console.log('Manual login successful:', { name, idToken });
                
                // Store in localStorage first
                localStorage.setItem('idToken', idToken);
                localStorage.setItem('userName', name);
                
                // Trigger a custom event to notify App component
                window.dispatchEvent(new CustomEvent('authStateChanged'));
                
                // Call the parent function
                onLoginSuccess(name, idToken);
                
                setStatusMessage("Login successful!");
                setEmail('');
                setPassword('');
                
                // Navigate to dashboard after a short delay
                setTimeout(() => {
                    navigate('/dashboard');
                }, 500);
                
            } else {
                setIsError(true);
                setStatusMessage(response.data.message || "Login failed");
            }
        } catch (err) {
            console.error("Login failed:", err);
            setIsError(true);
            
            if (err.response && err.response.data && err.response.data.message) {
                setStatusMessage(err.response.data.message);
            } else {
                setStatusMessage("An unexpected error occurred. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const backendGoogleUrl = 'http://localhost:5000/login/google';
        const width = 600, height = 700;
        const left = (window.innerWidth / 2) - (width / 2);
        const top = (window.innerHeight / 2) - (height / 2);
        
        window.open(
            backendGoogleUrl, 
            'googleAuthPopup', 
            `width=${width},height=${height},top=${top},left=${left}`
        );
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl text-gray-200 animate-fade-in">
                <h2 className="text-3xl font-extrabold text-center text-white">
                    Sign in to your account
                </h2>

                <div>
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full inline-flex justify-center py-3 px-4 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-sm font-medium text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5 mr-3" role="img" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        Sign in with Google
                    </button>
                </div>
                
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-sm">Or continue with</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email address</label>
                        <input 
                            id="email" 
                            name="email" 
                            type="email" 
                            autoComplete="email" 
                            required 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50" 
                            placeholder="you@example.com" 
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
                        <input 
                            id="password" 
                            name="password" 
                            type="password" 
                            autoComplete="current-password" 
                            required 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50" 
                            placeholder="••••••••" 
                        />
                    </div>
                    
                    {statusMessage && (
                        <p className={`text-center text-sm ${isError ? 'text-red-400' : 'text-green-400'}`}>
                            {statusMessage}
                        </p>
                    )}
                    
                    <div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>
                </form>
                
                <p className="text-sm text-center text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none focus:underline transition ease-in-out duration-150">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Login;