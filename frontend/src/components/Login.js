import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebaseConfig';
import axios from 'axios';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle,
  GraduationCap,
} from 'lucide-react';
import API_URL from '../apiConfig';

/* ── input field ── */
const InputField = ({ icon: Icon, label, type, value, onChange, placeholder, required, showPassword, onTogglePassword }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-surface-300 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-accent-400" />
      {label}
    </label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 bg-surface-700/50 border border-surface-600 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all text-sm"
      />
      {onTogglePassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
);

/* ═══════  Login Component  ═══════ */
function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage('');
    setIsError(false);

    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      console.log(res.data.idToken)
      if (res.data.idToken) {
        const name = res.data.name || email.split('@')[0];
        localStorage.setItem('idToken', res.data.idToken);
        localStorage.setItem('userName', name);
        if (typeof onLoginSuccess === 'function') onLoginSuccess(name, res.data.token);
        navigate('/dashboard');
      } else {
        setIsError(true);
        setStatusMessage(res.data.message || 'Login failed');
      }
    } catch (err) {
      setIsError(true);
      setStatusMessage(err.response?.data?.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setStatusMessage('');
    setIsError(false);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      const idToken = await result.user.getIdToken();
      const displayName = result.user.displayName || result.user.email.split('@')[0];

      localStorage.setItem('idToken', idToken);
      localStorage.setItem('userName', displayName);
      if (typeof onLoginSuccess === 'function') onLoginSuccess(displayName, idToken);
      navigate('/dashboard');
    } catch (err) {
      setIsError(true);
      setStatusMessage(err.message || 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('demo@jeegenius.com');
    setPassword('demo123');
    setIsLoading(true);
    setStatusMessage('');

    try {
      const res = await axios.post(`${API_URL}/login`, { email: 'demo@jeegenius.com', password: 'demo123' });
      if (res.data.token) {
        localStorage.setItem('idToken', res.data.token);
        localStorage.setItem('userName', 'Demo User');
        if (typeof onLoginSuccess === 'function') onLoginSuccess('Demo User', res.data.token);
        navigate('/dashboard');
      } else {
        setIsError(true);
        setStatusMessage('Demo login not available');
      }
    } catch {
      setIsError(true);
      setStatusMessage('Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-500/10 border border-accent-500/20 mb-4">
            <GraduationCap className="w-6 h-6 text-accent-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-surface-400 text-sm">Sign in to continue your preparation</p>
        </div>

        {/* form card */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <InputField
              icon={Mail}
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <InputField
              icon={Lock}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            {/* status */}
            {statusMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isError
                ? 'bg-danger-500/10 border border-danger-500/20 text-danger-400'
                : 'bg-success-500/10 border border-success-500/20 text-success-400'
                }`}>
                {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                {statusMessage}
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-surface-700" />
            <span className="text-xs text-surface-500">or</span>
            <div className="flex-1 h-px bg-surface-700" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 border border-surface-600 text-surface-300 font-medium transition-colors disabled:opacity-50 text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.91 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* demo */}
          <button
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-surface-500 hover:text-surface-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Try Demo Account
          </button>
        </div>

        {/* sign up link */}
        <p className="text-center text-surface-400 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
