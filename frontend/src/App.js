// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Navbar from './components/Navbar';
import Homepage from './components/Homepage';
import Login from './components/Login';
import SignUp from './components/SignUp';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';

const PastPapers = () => <div className="p-8 text-center text-white"><h1>Past Papers Page</h1></div>;
const Analytics = () => <div className="p-8 text-center text-white"><h1>Analytics Page</h1></div>;
const Contact = () => <div className="p-8 text-center text-white"><h1>Contact Page</h1></div>;

export default function App() {
    const [user, setUser] = useState(null);

    // Login success handler
    const handleLoginSuccess = (name, token) => {
        setUser({ name, token });
        localStorage.setItem('idToken', token);
        localStorage.setItem('userName', name);
    };

    // Logout handler (shared by Navbar & Homepage)
    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('idToken');
        localStorage.removeItem('userName');
    };

    fetch("http://localhost:5000/get_user_data", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            token: localStorage.getItem('idToken'), // Replace with actual token
            name: localStorage.getItem('userName')    // Replace with actual name
        }),
    })
        .then(res => res.json())
        .then(data => console.log(data))
        .catch(err => console.error(err));


    // Check auth state on mount and when localStorage changes
    useEffect(() => {
        const checkAuthState = () => {
            const storedToken = localStorage.getItem('idToken');
            const storedName = localStorage.getItem('userName');
            if (storedToken && storedName) {
                setUser({ name: storedName, token: storedToken });
            } else {
                setUser(null);
            }
        };

        checkAuthState();
        window.addEventListener('storage', checkAuthState);

        return () => {
            window.removeEventListener('storage', checkAuthState);
        };
    }, []);

    return (
        <div className="bg-gray-900 min-h-screen text-gray-200 font-sans">
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
                    body { font-family: 'Inter', sans-serif; }
                    @keyframes fade-in {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                `}
            </style>

            <Router>
                <Navbar user={user} onLogout={handleLogout} />

                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<Homepage user={user} onLogout={handleLogout} />} />
                        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignUp onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/dashboard" element={user ? <Dashboard userName={user.name} /> : <Navigate to="/login" />} />
                        <Route path="/past-papers" element={user ? <PastPapers /> : <Navigate to="/login" />} />
                        <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </Router>
        </div>
    );
}
