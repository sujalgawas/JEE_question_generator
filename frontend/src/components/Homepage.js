import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, TrendingUp, Award, Zap, ArrowRight, LogOut, Check, Loader, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import API_URL from '../apiConfig';

// Real-time Progress Bar Component
const RealTimeProgressBar = ({ progress, stage, message, questionsGenerated, totalQuestions, jobId, onCancel }) => {
  const stages = {
    'initializing': { label: 'Initializing', color: 'from-blue-500 to-cyan-500', icon: Loader },
    'analyzing': { label: 'Analyzing Profile', color: 'from-cyan-500 to-blue-500', icon: Loader },
    'planning': { label: 'Planning Structure', color: 'from-blue-500 to-purple-500', icon: Loader },
    'generating': { label: 'Generating Questions', color: 'from-purple-500 to-pink-500', icon: Loader },
    'distractors': { label: 'Adding Options', color: 'from-pink-500 to-orange-500', icon: Loader },
    'finalizing': { label: 'Finalizing', color: 'from-orange-500 to-yellow-500', icon: Loader },
    'saving': { label: 'Saving', color: 'from-yellow-500 to-green-500', icon: Loader },
    'complete': { label: 'Complete', color: 'from-green-500 to-emerald-500', icon: Check }
  };

  const currentStage = stages[stage] || stages['initializing'];
  const StageIcon = currentStage.icon;

  return (
    <div className="w-full space-y-6">
      {/* Job ID and Status */}
      <div className="flex items-center justify-between" style={{ paddingBottom: '20px' }}>
        <div className="text-xs text-gray-500 font-mono">
          Job ID: {jobId?.substring(0, 8)}...
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors duration-200"
        >
          <XCircle className="w-3 h-3" />
          Cancel
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full h-4 bg-gray-700/50 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${currentStage.color} rounded-full transition-all duration-500 ease-out relative`}
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
          </div>
        </div>
        <div className="absolute -top-10 right-0 flex items-center gap-2">
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Current Stage */}
      <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/50">
        <div className={`flex-shrink-0 p-4 bg-gradient-to-br ${currentStage.color} bg-opacity-20 rounded-xl`}>
          <StageIcon className={`w-8 h-8 text-white ${stage !== 'complete' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1">
          <h4 className="text-xl font-bold text-white mb-1">{currentStage.label}</h4>
          <p className="text-gray-400 text-sm">{message}</p>
          {questionsGenerated !== undefined && totalQuestions > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(questionsGenerated / totalQuestions) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {questionsGenerated}/{totalQuestions}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="grid grid-cols-7 gap-2">
        {Object.entries(stages).map(([key, { label }], index) => {
          const isCompleted = progress > (index / 7) * 100;
          const isCurrent = stage === key;
          
          return (
            <div key={key} className="flex flex-col items-center gap-2">
              <div className={`w-full h-2 rounded-full transition-all duration-500 ${
                isCompleted 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : isCurrent
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse'
                  : 'bg-gray-700/50'
              }`}></div>
              <span className={`text-xs text-center transition-colors duration-500 ${
                isCompleted 
                  ? 'text-green-400 font-semibold' 
                  : isCurrent
                  ? 'text-blue-400 font-semibold'
                  : 'text-gray-600'
              }`}>
                {label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Background Processing Notice */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-400 text-xs font-semibold mb-1">Running in Background</p>
            <p className="text-gray-400 text-xs">
              You can leave this page. Your paper is being generated in the background. Come back anytime to check progress.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Floating orbs background animation
const FloatingOrbs = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
    </div>
);

// Stat Card Component
const StatCard = ({ icon: Icon, title, value, delay }) => (
    <div 
        className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                <Icon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    </div>
);

// Feature Badge Component
const FeatureBadge = ({ text, delay }) => (
    <div 
        className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full text-sm text-blue-300 backdrop-blur-sm hover:scale-105 transition-transform duration-300"
        style={{ animationDelay: `${delay}ms` }}
    >
        {text}
    </div>
);

// Logged-Out View
const LoggedOutView = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <div className={`text-center max-w-5xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-8 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">AI-Powered Test Generation</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 animate-gradient">
                    Master JEE
                </span>
                <br />
                <span className="text-white">With AI Precision</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
                Personalized practice tests powered by cutting-edge AI. 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-semibold"> Elevate your preparation</span> to the next level.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
                <FeatureBadge text="✨ Smart Question Bank" delay={100} />
                <FeatureBadge text="📊 Performance Analytics" delay={200} />
                <FeatureBadge text="🎯 Adaptive Difficulty" delay={300} />
                <FeatureBadge text="⚡ Instant Results" delay={400} />
            </div>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
                <button
                    onClick={() => alert("Redirecting to login...")}
                    className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl overflow-hidden shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative flex items-center gap-2">
                        Get Started Now
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                </button>
                <button
                    onClick={() => alert("Learn more about features...")}
                    className="px-8 py-4 bg-gray-800/50 backdrop-blur-sm text-white font-semibold rounded-xl border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all duration-300"
                >
                    Learn More
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                <StatCard icon={TrendingUp} title="Success Rate" value="94%" delay={100} />
                <StatCard icon={Award} title="Tests Generated" value="50K+" delay={200} />
                <StatCard icon={Zap} title="Active Students" value="10K+" delay={300} />
            </div>
        </div>
    );
};

// Logged-In View with Background Job Support
const LoggedInView = ({ user, onLogout }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [paperGenerated, setPaperGenerated] = useState(false);
  const [isCheckingJobs, setIsCheckingJobs] = useState(true);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
    checkForActiveJobs();
  }, []);

  const checkForActiveJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/user-active-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: user.token, name: user.name })
      });

      const data = await response.json();
      
      if (data.jobs && data.jobs.length > 0) {
        // Get the most recent job
        const latestJob = data.jobs[0];
        
        if (latestJob.status === 'running' || latestJob.status === 'pending') {
          setActiveJob(latestJob);
          startPolling(latestJob.job_id);
        } else if (latestJob.status === 'completed') {
          setPaperGenerated(true);
        }
      }
    } catch (error) {
      console.error('Error checking for active jobs:', error);
    } finally {
      setIsCheckingJobs(false);
    }
  };

  const startPolling = (jobId) => {
    // Clear existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/paper-generation-status/${jobId}`);
        const job = await response.json();

        setActiveJob(job);

        if (job.status === 'completed') {
          clearInterval(pollingIntervalRef.current);
          setPaperGenerated(true);
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(pollingIntervalRef.current);
          alert(`Paper generation ${job.status}: ${job.error || job.message}`);
          setActiveJob(null);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);
  };

  const handleGenerate = async () => {
    try {
      const response = await fetch(`${API_URL}/start-paper-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: user.token, name: user.name })
      });

      const data = await response.json();

      if (data.job_id) {
        setActiveJob(data.job);
        setPaperGenerated(false);
        startPolling(data.job_id);
      } else {
        alert('Failed to start paper generation');
      }
    } catch (error) {
      console.error('Error starting paper generation:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;

    if (!window.confirm('Are you sure you want to cancel this paper generation?')) return;

    try {
      await fetch(`${API_URL}/cancel-paper-generation/${activeJob.job_id}`, {
        method: 'POST'
      });

      clearInterval(pollingIntervalRef.current);
      setActiveJob(null);
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const isLoading = activeJob && (activeJob.status === 'running' || activeJob.status === 'pending');

  if (isCheckingJobs) {
    return (
      <div className="text-center">
        <Loader className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Checking for active jobs...</p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-3xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
      {/* Welcome Header */}
      <div className="text-center mb-12 relative">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-full mb-6 backdrop-blur-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-300 font-medium">Active Session</span>
        </div>
        <h2 className="text-5xl md:text-6xl font-black mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Welcome back,
          </span>
          <br />
          <span className="text-white">{user.name}!</span>
        </h2>
        <p className="text-lg text-gray-400">Ready to crush your next practice session?</p>
      </div>

      {/* Main Control Panel */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl rounded-3xl"></div>
        <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50 shadow-2xl">
          {!isLoading ? (
            <div className="flex flex-col items-center gap-6">
              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-5 px-8 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center gap-3 text-lg">
                  <Sparkles className="w-6 h-6" />
                  Generate New Paper
                  <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
                  Generating Your Paper
                </h3>
                <p className="text-gray-400 text-sm">Running in the background - feel free to explore</p>
              </div>
              <RealTimeProgressBar 
                progress={activeJob.progress} 
                stage={activeJob.stage}
                message={activeJob.message}
                questionsGenerated={activeJob.questions_generated}
                totalQuestions={activeJob.total_questions}
                jobId={activeJob.job_id}
                onCancel={handleCancelJob}
              />
            </div>
          )}
        </div>
      </div>

      {/* Success Message */}
      {paperGenerated && (
        <div className="mb-8 relative overflow-hidden animate-in slide-in-from-bottom duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-xl rounded-2xl"></div>
          <div className="relative bg-gradient-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-sm border border-green-500/30 p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Award className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-300 font-bold text-lg">Success!</p>
                <p className="text-green-400/80 text-sm">Your paper is ready to tackle</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/past-papers'}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-green-500/30 transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              View Your Papers
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-blue-500/50 transition-all duration-300">
          <p className="text-3xl font-bold text-blue-400">12</p>
          <p className="text-xs text-gray-400 mt-1">Papers Done</p>
        </div>
        <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-purple-500/50 transition-all duration-300">
          <p className="text-3xl font-bold text-purple-400">87%</p>
          <p className="text-xs text-gray-400 mt-1">Avg Score</p>
        </div>
        <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-cyan-500/50 transition-all duration-300">
          <p className="text-3xl font-bold text-cyan-400">24h</p>
          <p className="text-xs text-gray-400 mt-1">Study Time</p>
        </div>
      </div>

      {/* Logout Button */}
      <div className="text-center">
        <button
          onClick={onLogout}
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 bg-gray-800/50 hover:bg-red-600/20 border border-gray-700 hover:border-red-500/50 px-6 py-3 rounded-xl backdrop-blur-sm"
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform duration-300" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

// Main Homepage Component (simplified - job management moved to LoggedInView)
export default function Homepage({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
      <FloatingOrbs />
      
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>
      
      <div className="relative z-10 w-full">
        {user ? (
          <LoggedInView user={user} onLogout={onLogout} />
        ) : (
          <LoggedOutView />
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}