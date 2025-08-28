// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Cookies from 'js-cookie';                              // ← NEW

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

const Contact = () => (
    <div className="p-8 text-center text-white">
        <h1>Contact Page</h1>
    </div>
);

export default function App() {
    const [user, setUser] = useState(null);

    /* ---------- LOGIN ---------- */
    const handleLoginSuccess = (name, token) => {
        setUser({ name, token });

        // Persist for 7 days; restrict to HTTPS & same-site for basic CSRF protection
        Cookies.set('idToken', token, { expires: 7, secure: true, sameSite: 'strict' });
        Cookies.set('userName', name, { expires: 7, secure: true, sameSite: 'strict' });
    };

    /* ---------- LOG-OUT ---------- */
    const handleLogout = () => {
        setUser(null);
        Cookies.remove('idToken');
        Cookies.remove('userName');
    };

    /* ---------- API CALL EXAMPLE ---------- */
    const generatePaper = (paperData) => {
        const userToken = Cookies.get('idToken');
        const userName = Cookies.get('userName');

        if (!userToken || !userName) {
            console.error('User not authenticated');
            return;
        }

        const requestData = { ...paperData, token: userToken, name: userName };

        console.log('Generating paper with user data:', { name: userName });

        fetch('http://localhost:5000/generate-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => console.log('Paper generated successfully:', data))
            .catch(err => console.error('Error generating paper:', err));
    };

    /* ---------- CHECK AUTH ON MOUNT ---------- */
    useEffect(() => {
        const storedToken = Cookies.get('idToken');
        const storedName = Cookies.get('userName');
        setUser(storedToken && storedName ? { name: storedName, token: storedToken } : null);
    }, []);

    return (
        <div className="bg-gray-900 min-h-screen text-gray-200 font-sans">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); }
                             to   { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>

            <Router basename="/JEE_question_generator/frontend">
                <Navbar user={user} onLogout={handleLogout} />

                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<Homepage user={user} onLogout={handleLogout} />} />
                        <Route path="/login" element={user ? <Navigate to="/dashboard" />
                            : <Login onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/signup" element={user ? <Navigate to="/dashboard" />
                            : <SignUp onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/dashboard" element={user ? <Dashboard userName={user.name} />
                            : <Navigate to="/login" />} />
                        <Route path="/past-papers" element={user ? <PastPaper /> : <Navigate to="/login" />} />
                        <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/mcq-test/:paperId" element={<MCQTest />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </Router>
        </div>
    );
}
