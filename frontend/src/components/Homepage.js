import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Sparkles,
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Target,
  Cloud,
  Cpu,
  Loader2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import API_URL from '../apiConfig';
import { getAuthSession } from './authUtils';

/* ── Stage Config for Timeline ── */
const stagesConfig = [
  { key: 'analyzing', label: 'Analyze' },
  { key: 'planning', label: 'Plan' },
  { key: 'generating', label: 'Questions' },
  { key: 'distractors', label: 'Options' },
  { key: 'finalizing', label: 'Review' },
  { key: 'saving', label: 'Save' },
];

const stageOrder = [
  'initializing',
  'analyzing',
  'planning',
  'generating',
  'distractors',
  'finalizing',
  'saving',
  'complete',
];

/* ── Real-Time Continuous Progress Bar Component ── */
const RealTimeProgressBar = ({ job, onCancel, onStartTest, onGenerateNew }) => {
  const {
    progress = 0,
    stage = 'initializing',
    message = '',
    questions_generated = 0,
    total_questions = 0,
    job_id,
    status,
    paper_id,
  } = job || {};

  const isComplete = status === 'completed';
  const currentStageIndex = stageOrder.indexOf(stage);

  const getStageDisplayTitle = () => {
    if (isComplete) return 'Paper Ready!';
    if (stage === 'generating') {
      return total_questions > 0
        ? `Drafting Questions (${questions_generated || 0}/${total_questions})`
        : 'Drafting Questions';
    }
    if (stage === 'planning') return 'Structuring Question Distribution';
    if (stage === 'analyzing') return 'Analyzing Profile & Weak Areas';
    if (stage === 'distractors') return 'Formulating Answer Distractors';
    if (stage === 'finalizing') return 'Finalizing Assessment';
    if (stage === 'saving') return 'Saving To Account';
    return 'Initializing AI Agent...';
  };

  return (
    <div className="space-y-6">
      {/* Top Header: Status & Cancel */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/60">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isComplete ? 'bg-success-400' : 'bg-accent-400 animate-pulse'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-300">
            {isComplete ? 'Generation Complete' : 'AI Agent Working In Background'}
          </span>
          {job_id && (
            <span className="text-[10px] font-mono text-surface-500 hidden sm:inline">
              #{job_id.slice(0, 8)}
            </span>
          )}
        </div>

        {!isComplete && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-danger-400 hover:text-danger-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-danger-500/10 hover:bg-danger-500/20 border border-danger-500/20 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      {/* Stage Label & Percentage */}
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-white">{getStageDisplayTitle()}</span>
          <span className="text-xl font-bold text-accent-400 font-mono">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-3 bg-surface-700/80 rounded-full overflow-hidden p-0.5 border border-surface-600/30">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete
                ? 'bg-gradient-to-r from-success-500 to-emerald-400'
                : 'bg-gradient-to-r from-accent-600 to-accent-400'
            }`}
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      </div>

      {/* Message Box */}
      <div className="p-4 rounded-xl bg-surface-700/30 border border-surface-700/50 flex items-start gap-3">
        {isComplete ? (
          <CheckCircle className="w-5 h-5 text-success-400 shrink-0 mt-0.5" />
        ) : (
          <Loader2 className="w-5 h-5 text-accent-400 animate-spin shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-200 font-medium">
            {message || (isComplete ? 'Your paper is ready!' : 'Preparing paper...')}
          </p>
          {total_questions > 0 && questions_generated > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-400 rounded-full transition-all duration-300"
                  style={{ width: `${(questions_generated / total_questions) * 100}%` }}
                />
              </div>
              <span className="text-xs text-surface-400 font-mono">
                {questions_generated}/{total_questions}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step Timeline */}
      <div className="grid grid-cols-6 gap-1.5 pt-1">
        {stagesConfig.map(({ key, label }) => {
          const stepIndex = stageOrder.indexOf(key);
          const isPast = currentStageIndex > stepIndex || isComplete;
          const isCurrent = currentStageIndex === stepIndex && !isComplete;

          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                  isPast
                    ? 'bg-success-500'
                    : isCurrent
                    ? 'bg-accent-400 animate-pulse'
                    : 'bg-surface-700'
                }`}
              />
              <span
                className={`text-[11px] truncate ${
                  isPast
                    ? 'text-success-400 font-medium'
                    : isCurrent
                    ? 'text-accent-300 font-semibold'
                    : 'text-surface-500'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Completion Actions */}
      {isComplete && (
        <div className="space-y-2 pt-2">
          {paper_id && (
            <button
              type="button"
              onClick={() => onStartTest(paper_id)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-success-600 hover:bg-success-500 text-white font-semibold transition-colors shadow-lg shadow-success-600/20"
            >
              <Sparkles className="w-4 h-4" />
              Start Test Now
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          )}
          <button
            type="button"
            onClick={onGenerateNew}
            className="w-full py-2.5 rounded-xl bg-surface-700/50 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium transition-colors"
          >
            Generate Another Paper
          </button>
        </div>
      )}

      {/* Background Generation Notice */}
      {!isComplete && (
        <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-300 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-accent-400" />
          <span>
            <strong>Background Generation:</strong> You can safely switch tabs or navigate across the app. Progress continues seamlessly.
          </span>
        </div>
      )}
    </div>
  );
};

/* ═══════  Homepage Component (JEE only)  ═══════ */
export default function Homepage({ user, onLogout }) {
  const navigate = useNavigate();
  const [activeJob, setActiveJob] = useState(null);
  const [isCheckingJobs, setIsCheckingJobs] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modelMode, setModelMode] = useState(
    () => localStorage.getItem('jeeModelMode') || 'api'
  );

  const pollingIntervalRef = useRef(null);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Poll status every 1.5 seconds
  const startPolling = useCallback(
    (jobId) => {
      stopPolling();

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/paper-generation-status/${jobId}`);
          if (!res.ok) {
            if (res.status === 404) {
              stopPolling();
              localStorage.removeItem('jee_active_job_id');
              setActiveJob(null);
            }
            return;
          }

          const job = await res.json();
          setActiveJob(job);

          if (job.status === 'completed') {
            stopPolling();
            localStorage.removeItem('jee_active_job_id');
            setSuccess('Paper generated successfully! You can take the test now.');
          } else if (job.status === 'failed') {
            stopPolling();
            localStorage.removeItem('jee_active_job_id');
            setError(job.error || 'Paper generation failed. Please try again.');
          } else if (job.status === 'cancelled') {
            stopPolling();
            localStorage.removeItem('jee_active_job_id');
            setActiveJob(null);
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      }, 1500);
    },
    [stopPolling]
  );

  // Check for active background jobs on mount
  const checkForActiveJobs = useCallback(async () => {
    const { token, name } = getAuthSession();
    if (!token || !name) {
      setIsCheckingJobs(false);
      return;
    }

    const savedJobId = localStorage.getItem('jee_active_job_id');

    // Priority 1: Check savedJobId directly if present
    if (savedJobId) {
      try {
        const res = await fetch(`${API_URL}/paper-generation-status/${savedJobId}`);
        if (res.ok) {
          const job = await res.json();
          if (job && (job.status === 'running' || job.status === 'pending')) {
            setActiveJob(job);
            startPolling(savedJobId);
            setIsCheckingJobs(false);
            return;
          } else if (job && job.status === 'completed' && job.paper_id) {
            setActiveJob(job);
            setSuccess('Your paper was generated successfully!');
            setIsCheckingJobs(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Error checking saved job status:', e);
      }
    }

    // Priority 2: Ask backend for all active jobs of this user
    try {
      const res = await fetch(`${API_URL}/user-active-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        const jobs = data.jobs || [];

        // Find running or pending job
        const runningJob = jobs.find(
          (j) => j.status === 'running' || j.status === 'pending'
        );

        if (runningJob) {
          setActiveJob(runningJob);
          localStorage.setItem('jee_active_job_id', runningJob.job_id);
          startPolling(runningJob.job_id);
        } else {
          localStorage.removeItem('jee_active_job_id');
        }
      }
    } catch (err) {
      console.error('Error checking active jobs:', err);
    } finally {
      setIsCheckingJobs(false);
    }
  }, [startPolling]);

  // Set up mount checks & visibility change listeners
  useEffect(() => {
    checkForActiveJobs();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const savedId = localStorage.getItem('jee_active_job_id');
        if (savedId) {
          fetch(`${API_URL}/paper-generation-status/${savedId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((job) => {
              if (job) setActiveJob(job);
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForActiveJobs, stopPolling]);

  // Start background paper generation
  const handleGenerate = async () => {
    const { token, name } = getAuthSession();
    if (!token || !name) {
      navigate('/login');
      return;
    }

    setIsStarting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_URL}/start-paper-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, model_mode: modelMode }),
      });

      const data = await res.json();

      if (res.ok && data.job_id) {
        const initialJob = data.job || {
          job_id: data.job_id,
          status: 'running',
          stage: 'analyzing',
          progress: 5,
          message: 'Starting paper generation...',
          questions_generated: 0,
          total_questions: 30,
        };

        setActiveJob(initialJob);
        localStorage.setItem('jee_active_job_id', data.job_id);
        startPolling(data.job_id);
      } else {
        setError(data.error || 'Failed to start paper generation');
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  // Cancel generation
  const handleCancel = async () => {
    if (!activeJob || !activeJob.job_id) return;
    if (!window.confirm('Are you sure you want to cancel paper generation?')) return;

    try {
      await fetch(`${API_URL}/cancel-paper-generation/${activeJob.job_id}`, {
        method: 'POST',
      });
    } catch (e) {
      console.warn('Error cancelling job on server:', e);
    } finally {
      stopPolling();
      localStorage.removeItem('jee_active_job_id');
      setActiveJob(null);
      setError('');
    }
  };

  const handleStartTest = (paperId) => {
    navigate(`/mcq-test/${paperId}`);
  };

  const handleGenerateNew = () => {
    stopPolling();
    localStorage.removeItem('jee_active_job_id');
    setActiveJob(null);
    setSuccess('');
    setError('');
  };

  const isGenerating = Boolean(
    activeJob && (activeJob.status === 'running' || activeJob.status === 'pending')
  );

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Generate Practice Paper
          </h1>
          <p className="text-surface-400 text-sm">
            AI will create a personalized JEE-style MCQ paper based on your profile.
          </p>
        </div>

        {/* generator card */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 sm:p-8">
          {/* error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* success banner */}
          {success && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {/* Loading check state */}
          {isCheckingJobs && !activeJob ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-accent-400 animate-spin" />
              <p className="text-sm text-surface-400">Checking for active generation jobs...</p>
            </div>
          ) : isGenerating || (activeJob && activeJob.status === 'completed') ? (
            /* Active / Completed Job Progress Bar */
            <RealTimeProgressBar
              job={activeJob}
              onCancel={handleCancel}
              onStartTest={handleStartTest}
              onGenerateNew={handleGenerateNew}
            />
          ) : (
            /* Idle Generator Form */
            <>
              {/* info items */}
              <div className="space-y-3 mb-6">
                {[
                  {
                    icon: BookOpen,
                    label: 'Physics, Chemistry & Maths',
                    desc: 'Mixed subject paper',
                  },
                  {
                    icon: GraduationCap,
                    label: 'JEE Main Level',
                    desc: 'Calibrated difficulty',
                  },
                  {
                    icon: Target,
                    label: '30 Questions',
                    desc: '90 minutes time limit',
                  },
                ].map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/40"
                  >
                    <Icon className="w-5 h-5 text-accent-400 shrink-0" />
                    <div>
                      <p className="text-sm text-white font-medium">{label}</p>
                      <p className="text-xs text-surface-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* model selector */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-accent-400" />
                  Generation Model
                </label>
                <div className="flex gap-2">
                  {[
                    {
                      value: 'api',
                      label: 'API',
                      description: 'Groq/Gemini with fallback',
                      icon: Cloud,
                    },
                    {
                      value: 'local',
                      label: 'Local',
                      description: 'Ollama on this computer',
                      icon: Cpu,
                    },
                  ].map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setModelMode(value);
                        localStorage.setItem('jeeModelMode', value);
                      }}
                      className={`flex-1 flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                        modelMode === value
                          ? 'border-accent-500 bg-accent-500/10'
                          : 'border-surface-700 bg-surface-700/30 hover:border-surface-600'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          modelMode === value ? 'text-accent-400' : 'text-surface-400'
                        }`}
                      />
                      <span>
                        <span
                          className={`block text-sm font-semibold ${
                            modelMode === value ? 'text-white' : 'text-surface-300'
                          }`}
                        >
                          {label}
                        </span>
                        <span className="block text-xs text-surface-500">
                          {description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {modelMode === 'local' && (
                  <p className="text-xs text-surface-500 mt-2">
                    Requires Ollama to be running with qwen2.5:3b or qwen3:4b installed.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isStarting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Generation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Paper
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}