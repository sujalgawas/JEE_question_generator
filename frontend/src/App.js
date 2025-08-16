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
import PastPaper from './components/PastPapers';
import MCQTest from './components/MCQTest';
import Analytics from './components/Analytics';

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

    const generatePaper = (paperData) => {
        // Get user data from localStorage
        const userToken = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        if (!userToken || !userName) {
            console.error("User not authenticated");
            return;
        }

        // Include user data in the request payload
        const requestData = {
            ...paperData,
            token: userToken,
            name: userName
        };

        console.log("Generating paper with user data:", { name: userName });

        // Single request to generate paper with user data
        fetch("http://localhost:5000/generate-paper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log("Paper generated successfully:", data);
                // You can add success handling here
                // For example, redirect to a results page or show a success message
            })
            .catch(err => {
                console.error("Error generating paper:", err);
                // Add error handling here
            });
    };


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
                        <Route path="/past-papers" element={user ? <PastPaper /> : <Navigate to="/login" />} />
                        <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="*" element={<Navigate to="/" />} />
                        <Route path="/mcq-test/:paperId" element={<MCQTest />} />
                    </Routes>
                </main>
            </Router>
        </div>
    );
}
