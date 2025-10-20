// src/components/SignUp.js
import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Shield,
  Check,
  X
} from 'lucide-react';
import API_URL from '../apiConfig';

// Password Strength Indicator Component
const PasswordStrength = ({ password }) => {
  const getStrength = () => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  const strength = getStrength();
  const widthPercentage = (strength / 5) * 100;

  const getColor = () => {
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 2) return 'bg-orange-500';
    if (strength <= 3) return 'bg-yellow-500';
    if (strength <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getLabel = () => {
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength <= 3) return 'Good';
    if (strength <= 4) return 'Strong';
    return 'Very Strong';
  };

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">Password Strength:</span>
        <span className={`text-xs font-semibold ${
          strength <= 2 ? 'text-red-400' : 
          strength <= 3 ? 'text-yellow-400' : 
          'text-green-400'
        }`}>
          {getLabel()}
        </span>
      </div>
      <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-300 ease-out`}
          style={{ width: `${widthPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// Password Requirements Component
const PasswordRequirements = ({ password }) => {
  const requirements = [
    { label: 'At least 6 characters', test: password.length >= 6 },
    { label: 'Contains uppercase & lowercase', test: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Contains a number', test: /\d/.test(password) },
    { label: 'Contains special character', test: /[^a-zA-Z0-9]/.test(password) }
  ];

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2">
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          {req.test ? (
            <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
          ) : (
            <X className="w-3 h-3 text-gray-500 flex-shrink-0" />
          )}
          <span className={req.test ? 'text-green-400' : 'text-gray-500'}>
            {req.label}
          </span>
        </div>
      ))}
    </div>
  );
};

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
  error = ""
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
        className="w-full px-4 py-3 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
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
    {error && (
      <p className="text-red-400 text-xs flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
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

// Main SignUp Component
function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage('');
    setIsError(false);
    setIsSuccess(false);

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
      const response = await axios.post(`${API_URL}/signup`, { name, email, password });
      
      setStatusMessage(response.data.message);
      setIsError(false);
      setIsSuccess(true);
      
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
                <span className="text-sm text-blue-300 font-medium">Join JEE Genius Today</span>
              </div>
              <h1 className="text-5xl font-black mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  Start Your Journey
                </span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed">
                Join thousands of students preparing for JEE with our comprehensive practice platform.
              </p>
            </div>

            <div className="space-y-4">
              <FeatureCard 
                icon={Shield}
                title="Secure & Private"
                description="Your data is encrypted and protected with industry-standard security"
                delay={100}
              />
              <FeatureCard 
                icon={CheckCircle}
                title="Thousands of Questions"
                description="Access a vast library of JEE practice questions and past papers"
                delay={200}
              />
              <FeatureCard 
                icon={Sparkles}
                title="Track Your Progress"
                description="Advanced analytics to monitor your performance and improvement"
                delay={300}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-4 rounded-xl border border-gray-700/50">
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">10K+</div>
                <div className="text-xs text-gray-400 mt-1">Students</div>
              </div>
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-4 rounded-xl border border-gray-700/50">
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">50K+</div>
                <div className="text-xs text-gray-400 mt-1">Questions</div>
              </div>
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-4 rounded-xl border border-gray-700/50">
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">95%</div>
                <div className="text-xs text-gray-400 mt-1">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div className="animate-in slide-in-from-right" style={{ animationDuration: '700ms' }}>
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50 shadow-2xl">
              {/* Mobile Header */}
              <div className="lg:hidden text-center mb-6">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
                  Create Account
                </h2>
                <p className="text-gray-400 text-sm">Join JEE Genius today</p>
              </div>

              {/* Desktop Header */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Create Account</h2>
                <p className="text-gray-400">Start your preparation journey</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <InputField
                  icon={User}
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />

                <InputField
                  icon={Mail}
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
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
                  />
                  <PasswordStrength password={password} />
                  <PasswordRequirements password={password} />
                </div>

                <InputField
                  icon={Lock}
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  showPassword={showConfirmPassword}
                  onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                />

                {statusMessage && (
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                    isError 
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
                      <span className="relative z-10">Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Create Account</span>
                      <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </button>
              </form>

              {/* Terms & Privacy */}
              <p className="text-center text-xs text-gray-500 mt-4">
                By signing up, you agree to our{' '}
                <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</a>
              </p>

              {/* Sign In Link */}
              <div className="mt-6 pt-6 border-t border-gray-700/50 text-center">
                <p className="text-gray-400 text-sm">
                  Already have an account?{' '}
                  <Link 
                    to="/login" 
                    className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-300 hover:to-purple-400 transition-all duration-300"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
