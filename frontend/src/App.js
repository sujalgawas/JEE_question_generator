// App.jsx
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Cookies from 'js-cookie';

// Components
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import Homepage from './components/Homepage';
import Login from './components/Login';
import SignUp from './components/SignUp';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import PastPaper from './components/PastPapers';
import MCQTest from './components/MCQTest';
import Analytics from './components/Analytics';
import Contact from './components/Contact';
import PlacementHome from './components/PlacementHome';
import PlacementTest from './components/PlacementTest';
import PlacementPastPapers from './components/PlacementPastPapers';
import API_URL from './apiConfig';

export default function App() {
    const [user, setUser] = useState(null);
    const [appMode, setAppMode] = useState(() => localStorage.getItem('appMode') || 'placement');

    /* ---------- MODE ---------- */
    const handleModeChange = (newMode) => {
        setAppMode(newMode);
        localStorage.setItem('appMode', newMode);
    };

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

        fetch(`${API_URL}/generate-paper`, {
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

    /* ---------- Determine home route based on mode ---------- */
    const HomeElement = () => {
        if (!user) return <LandingPage appMode={appMode} onModeChange={handleModeChange} />;
        if (appMode === 'placement') return <PlacementHome />;
        return <Homepage user={user} onLogout={handleLogout} />;
    };

    return (
        <div className="min-h-screen bg-surface-900 text-surface-200 font-sans">
            <Router>
                <Navbar user={user} onLogout={handleLogout} appMode={appMode} onModeChange={handleModeChange} />

                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<HomeElement />} />
                        <Route path="/login" element={user ? <Navigate to="/dashboard" />
                            : <Login onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/signup" element={user ? <Navigate to="/dashboard" />
                            : <SignUp onLoginSuccess={handleLoginSuccess} />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/dashboard" element={user ? <Dashboard userName={user.name} appMode={appMode} onModeChange={handleModeChange} />
                            : <Navigate to="/login" />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/mcq-test/:paperId" element={<MCQTest />} />

                        {/* JEE routes */}
                        <Route path="/past-papers" element={user ? <PastPaper /> : <Navigate to="/login" />} />
                        <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />

                        {/* Placement routes */}
                        <Route path="/placement" element={user ? <PlacementHome /> : <Navigate to="/login" />} />
                        <Route path="/placement-test" element={user ? <PlacementTest /> : <Navigate to="/login" />} />
                        <Route path="/placement-history" element={user ? <PlacementPastPapers /> : <Navigate to="/login" />} />

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </Router>
        </div>
    );
}
