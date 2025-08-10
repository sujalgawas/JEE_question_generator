import React, { useState } from 'react';
import axios from 'axios';
// 1. Import Link from react-router-dom
import { Link } from 'react-router-dom';

const StatusIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// 2. Remove onSwitchPage from the component's props
function SignUp() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [statusMessage, setStatusMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatusMessage('');
        setIsError(false);

        if (password !== confirmPassword) {
            setIsError(true);
            setStatusMessage("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setIsError(true);
            setStatusMessage("Password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post('http://localhost:5000/signup', { name, email, password });
            
            setStatusMessage(response.data.message);
            setIsError(false);
            
            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');

        } catch (err) {
            setIsError(true);
            setStatusMessage(err.response ? err.response.data.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Your original light-theme styling is preserved
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md text-gray-900">
            <h2 className="text-3xl font-extrabold text-center text-gray-900">
                Create a new account
            </h2>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="John Doe" />
                </div>

                <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">Email address</label>
                    <input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="you@example.com" />
                </div>

                <div>
                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700">Password</label>
                    <input id="signup-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="••••••••" />
                </div>

                <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                    <input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="••••••••" />
                </div>
                
                {statusMessage && (
                    <p className={`text-center text-sm font-semibold ${isError ? 'text-red-600' : 'text-green-600'}`}>
                        {statusMessage}
                    </p>
                )}

                <div>
                    <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {isLoading && <StatusIcon />}
                        Create account
                    </button>
                </div>
            </form>
            <p className="text-sm text-center text-gray-600">
                Already have an account?{' '}
                {/* 3. Replace button with Link component */}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline transition ease-in-out duration-150">
                    Sign in
                </Link>
            </p>
        </div>
    );
}

export default SignUp;