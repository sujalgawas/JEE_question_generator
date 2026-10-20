// App.jsx
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
import PlacementMCQTest from './components/PlacementMCQTest';
import PlacementInterview from './components/PlacementInterview';
import {
    clearAuthSession,
    getAuthSession,
    shouldRefreshToken,
    forceTokenRefresh,
    decodeTokenExpiration,
} from './components/authUtils';

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
    };

    /* ---------- LOG-OUT ---------- */
    const handleLogout = () => {
        setUser(null);
        clearAuthSession();
    };

    /* ---------- CHECK AUTH ON MOUNT & AUTO-REFRESH ---------- */
    useEffect(() => {
        const checkAuthOnMount = async () => {
            const { token: storedToken, name: storedName } = getAuthSession();
            if (!storedToken) {
                setUser(null);
                return;
            }

            // If token is about to expire or already expired, attempt seamless refresh
            if (shouldRefreshToken(storedToken)) {
                try {
                    const freshToken = await forceTokenRefresh();
                    if (freshToken) {
                        const { name: refreshedName } = getAuthSession();
                        setUser({ name: refreshedName || storedName, token: freshToken });
                        return;
                    }
                } catch (err) {
                    console.error('Error during auto-refresh on mount:', err);
                }
            }

            // Verify if the token is completely expired and refresh could not be performed
            const exp = decodeTokenExpiration(storedToken);
            const now = Math.floor(Date.now() / 1000);
            if (exp && now >= exp) {
                console.warn('Authentication token is expired. Logging out.');
                clearAuthSession();
                setUser(null);
                return;
            }

            setUser(storedName ? { name: storedName, token: storedToken } : null);
        };

        checkAuthOnMount();
    }, []);

    /* ---------- PERIODIC TOKEN REFRESH (EVERY 15 MINUTES) ---------- */
    useEffect(() => {
        const interval = setInterval(async () => {
            const { token: storedToken } = getAuthSession();
            if (storedToken && shouldRefreshToken(storedToken)) {
                try {
                    const freshToken = await forceTokenRefresh();
                    if (freshToken) {
                        const { name: refreshedName } = getAuthSession();
                        setUser({ name: refreshedName || 'Student', token: freshToken });
                    }
                } catch (err) {
                    console.error('Error during periodic token refresh:', err);
                }
            }
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
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
                        <Route path="/placementMCQ-test/:paperId" element={user ? <PlacementMCQTest /> : <Navigate to="/login" />} />
                        <Route path="/placement" element={user ? <PlacementHome /> : <Navigate to="/login" />} />
                        <Route path="/placement-test" element={user ? <PlacementTest /> : <Navigate to="/login" />} />
                        <Route path="/placement-history" element={user ? <PlacementPastPapers /> : <Navigate to="/login" />} />
                        <Route path="/placement-interview" element={user ? <PlacementInterview /> : <Navigate to="/login" />} />
                        <Route path="/interview" element={user ? <PlacementInterview /> : <Navigate to="/login" />} />

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </Router>
        </div>
    );
}
