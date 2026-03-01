import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Sparkles,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
  GraduationCap,
  Target,
  Zap,
} from 'lucide-react';
import API_URL from '../apiConfig';

/* ── progress bar ── */
const ProgressBar = ({ progress, stage, message, onCancel }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between text-sm">
      <span className="text-surface-300 font-medium">{stage || 'Processing...'}</span>
      <span className="text-accent-400 font-semibold">{progress}%</span>
    </div>
    <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
    {message && <p className="text-xs text-surface-500">{message}</p>}
    <button
      onClick={onCancel}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-sm text-surface-400 transition-colors"
    >
      <X className="w-3.5 h-3.5" />
      Cancel
    </button>
  </div>
);

/* ═══════  Homepage Component (JEE only)  ═══════ */
export default function Homepage({ user, onLogout }) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pollingRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => { setIsVisible(true); return () => { if (pollingRef.current) clearInterval(pollingRef.current); }; }, []);

  const handleGenerate = async () => {
    const token = localStorage.getItem('idToken');
    const name = localStorage.getItem('userName');
    if (!token || !name) { navigate('/login'); return; }

    setIsGenerating(true); setProgress(0); setStage('Starting...'); setError('');

    try {
      const res = await fetch(`${API_URL}/generate-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name }),
      });
      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        pollProgress(data.job_id);
      } else {
        setError(data.error || 'Failed to start'); setIsGenerating(false);
      }
    } catch { setError('Failed to start generation'); setIsGenerating(false); }
  };

  const pollProgress = (id) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/job-progress/${id}`);
        const data = await res.json();
        setProgress(data.progress || 0);
        setStage(data.stage || '');
        setMessage(data.message || '');
        if (data.status === 'completed') {
          clearInterval(pollingRef.current);
          setIsGenerating(false);
          setSuccess('Paper generated! Taking you to the test...');
          if (data.paper_id) setTimeout(() => navigate(`/mcq-test/${data.paper_id}`), 1500);
          else setTimeout(() => navigate('/past-papers'), 1500);
        }
        if (data.status === 'failed') {
          clearInterval(pollingRef.current);
          setIsGenerating(false);
          setError(data.error || 'Generation failed');
        }
      } catch {
        clearInterval(pollingRef.current);
        setIsGenerating(false);
        setError('Lost connection to server');
      }
    }, 2000);
  };

  const handleCancel = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setIsGenerating(false); setJobId(null); setProgress(0);
  };

  /* ── Logged-In — Paper Generator ── */
  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Generate Practice Paper</h1>
          <p className="text-surface-400 text-sm">
            AI will create a personalized JEE-style MCQ paper based on your profile.
          </p>
        </div>

        {/* generator card */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 sm:p-8">
          {/* error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* success */}
          {success && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {isGenerating ? (
            <ProgressBar progress={progress} stage={stage} message={message} onCancel={handleCancel} />
          ) : (
            <>
              {/* info items */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: BookOpen, label: 'Physics, Chemistry & Maths', desc: 'Mixed subject paper' },
                  { icon: GraduationCap, label: 'JEE Main Level', desc: 'Calibrated difficulty' },
                  { icon: Target, label: '30 Questions', desc: '90 minutes time limit' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/40">
                    <Icon className="w-5 h-5 text-accent-400 shrink-0" />
                    <div>
                      <p className="text-sm text-white font-medium">{label}</p>
                      <p className="text-xs text-surface-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Generate Paper
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}