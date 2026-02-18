// src/components/Login.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Chrome
} from 'lucide-react';
import API_URL from '../apiConfig';
import Cookies from 'js-cookie';
import { auth } from '../firebaseConfig';

// Input Field Component
const InputField = ({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  showPassword,
  onTogglePassword,
  disabled = false
}) => (
  <div className="space-y-2">
    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
      <Icon className="w-4 h-4 text-blue-400" />
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-3 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {onTogglePassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      )}
    </div>
  </div>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, delay }) => (
  <div
    className="flex items-start gap-3 animate-in slide-in-from-bottom"
    style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
  >
    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
      <Icon className="w-5 h-5 text-blue-400" />
    </div>
    <div>
      <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
      <p className="text-gray-400 text-xs">{description}</p>
    </div>
  </div>
);

// Main Login Component
function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    setIsError(false);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/login`, {
        email,
        password
      });

      if (response.data.status === "success") {
        const { name, idToken } = response.data;

        console.log('Manual login successful:', { name, idToken });

        localStorage.setItem('idToken', idToken);
        localStorage.setItem('userName', name);

        window.dispatchEvent(new CustomEvent('authStateChanged'));

        onLoginSuccess(name, idToken);

        setStatusMessage("Login successful!");
        setEmail('');
        setPassword('');

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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setStatusMessage('');
    setIsError(false);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log('Google login successful:', user.displayName);

      const idToken = await user.getIdToken();

      localStorage.setItem('idToken', idToken);
      localStorage.setItem('userName', user.displayName);
      Cookies.set('idToken', idToken, { expires: 7, secure: true, sameSite: 'strict' });
      Cookies.set('userName', user.displayName, { expires: 7, secure: true, sameSite: 'strict' });

      onLoginSuccess(user.displayName, idToken);
      navigate('/dashboard');
    } catch (error) {
      console.error('Google login error:', error);
      setIsError(true);

      // Provide user-friendly error messages
      if (error.code === 'auth/popup-closed-by-user') {
        setStatusMessage('Sign-in popup was closed. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        setStatusMessage('Popup was blocked by the browser. Please allow popups and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User clicked the button again while popup was open, ignore
        return;
      } else {
        setStatusMessage(`Google authentication failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

      <div className="w-full max-w-6xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding & Features */}
          <div className="hidden lg:block space-y-8 animate-in slide-in-from-left" style={{ animationDuration: '700ms' }}>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-6 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-blue-300 font-medium">Welcome Back</span>
              </div>
              <h1 className="text-5xl font-black mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  Continue Your Journey
                </span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed">
                Sign in to access your personalized JEE preparation dashboard and track your progress.
              </p>
            </div>

            <div className="space-y-4">
              <FeatureCard
                icon={TrendingUp}
                title="Track Your Progress"
                description="Monitor your performance with detailed analytics and insights"
                delay={100}
              />
              <FeatureCard
                icon={Zap}
                title="Instant Access"
                description="Jump right back into your practice sessions and tests"
                delay={200}
              />
              <FeatureCard
                icon={Shield}
                title="Secure Authentication"
                description="Your data is protected with enterprise-grade security"
                delay={300}
              />
            </div>

            {/* Testimonial */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-300 text-sm italic mb-2">
                    "JEE Genius helped me improve my scores by 40%. The analytics feature is incredible!"
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">Priya Sharma</p>
                    <span className="text-gray-500 text-xs">•</span>
                    <p className="text-gray-500 text-xs">JEE 2024 Qualifier</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="animate-in slide-in-from-right" style={{ animationDuration: '700ms' }}>
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50 shadow-2xl">
              {/* Mobile Header */}
              <div className="lg:hidden text-center mb-6">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-400 text-sm">Sign in to continue</p>
              </div>

              {/* Desktop Header */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Sign In</h2>
                <p className="text-gray-400">Welcome back! Please enter your details</p>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="group relative w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg mb-6"
              >
                <Chrome className="w-5 h-5 text-blue-600" />
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-700/50"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-sm font-medium">Or continue with email</span>
                <div className="flex-grow border-t border-gray-700/50"></div>
              </div>

              {/* Login Form */}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <InputField
                  icon={Mail}
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />

                <div>
                  <InputField
                    icon={Lock}
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  />
                  <div className="mt-2 flex justify-end">
                    <a href="#" className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200">
                      Forgot password?
                    </a>
                  </div>
                </div>

                {statusMessage && (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${isError
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-green-500/10 border-green-500/30 text-green-400'
                    }`}>
                    {isError ? (
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">{statusMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] shadow-lg shadow-blue-500/30"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:to-purple-500/20 rounded-xl blur-xl transition-all duration-300"></div>
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="relative z-10">Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Sign In</span>
                      <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </button>
              </form>

              {/* Sign Up Link */}
              <div className="mt-6 pt-6 border-t border-gray-700/50 text-center">
                <p className="text-gray-400 text-sm">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-300 hover:to-purple-400 transition-all duration-300"
                  >
                    Sign up for free
                  </Link>
                </p>
              </div>

              {/* Demo Credentials (Optional - Remove in production) */}
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 text-xs font-semibold mb-1">Demo Account</p>
                    <p className="text-gray-400 text-xs">
                      Email: demo@jeegenius.com<br />
                      Password: demo123
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
