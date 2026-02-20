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
  ArrowRight,
  Check,
  X,
  GraduationCap,
} from 'lucide-react';
import API_URL from '../apiConfig';

/* ── password strength ── */
const PasswordStrength = ({ password }) => {
  if (!password) return null;

  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  const pct = (strength / 5) * 100;
  const color = strength <= 1 ? 'bg-danger-500' : strength <= 2 ? 'bg-warning-500' : strength <= 3 ? 'bg-warning-400' : 'bg-success-500';
  const label = strength <= 1 ? 'Weak' : strength <= 2 ? 'Fair' : strength <= 3 ? 'Good' : strength <= 4 ? 'Strong' : 'Very Strong';
  const textColor = strength <= 2 ? 'text-danger-400' : strength <= 3 ? 'text-warning-400' : 'text-success-400';

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-surface-500">Strength</span>
        <span className={`font-medium ${textColor}`}>{label}</span>
      </div>
      <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ── password requirements ── */
const PasswordRequirements = ({ password }) => {
  if (!password) return null;

  const reqs = [
    { label: 'At least 6 characters', ok: password.length >= 6 },
    { label: 'Upper & lowercase', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Contains a number', ok: /\d/.test(password) },
    { label: 'Special character', ok: /[^a-zA-Z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 space-y-1">
      {reqs.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          {r.ok ? <Check className="w-3 h-3 text-success-400" /> : <X className="w-3 h-3 text-surface-600" />}
          <span className={r.ok ? 'text-success-400' : 'text-surface-500'}>{r.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ── input ── */
const InputField = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required, showPassword, onTogglePassword }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-surface-300 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-accent-400" />
      {label}
      {required && <span className="text-danger-400">*</span>}
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

/* ═══════  SignUp Component  ═══════ */
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

    if (password !== confirmPassword) { setIsError(true); setStatusMessage("Passwords don't match."); return; }
    if (password.length < 6) { setIsError(true); setStatusMessage('Password must be at least 6 characters.'); return; }

    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/signup`, { name, email, password });
      setStatusMessage(res.data.message);
      setIsError(false);
      setIsSuccess(true);
      setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    } catch (err) {
      setIsError(true);
      setStatusMessage(err.response?.data?.message || 'An unexpected error occurred.');
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
          <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
          <p className="text-surface-400 text-sm">Start your JEE preparation journey</p>
        </div>

        {/* form card */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <InputField icon={User} label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            <InputField icon={Mail} label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />

            <div>
              <InputField
                icon={Lock} label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required
                showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)}
              />
              <PasswordStrength password={password} />
              <PasswordRequirements password={password} />
            </div>

            <InputField
              icon={Lock} label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••" required
              showPassword={showConfirmPassword} onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            />

            {/* status */}
            {statusMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isError
                  ? 'bg-danger-500/10 border border-danger-500/20 text-danger-400'
                  : 'bg-success-500/10 border border-success-500/20 text-success-400'
                }`}>
                {isError ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
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
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-surface-500 mt-4">
            By signing up, you agree to our <a href="#" className="text-accent-400 hover:text-accent-300">Terms</a> and <a href="#" className="text-accent-400 hover:text-accent-300">Privacy Policy</a>.
          </p>
        </div>

        <p className="text-center text-surface-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default SignUp;
