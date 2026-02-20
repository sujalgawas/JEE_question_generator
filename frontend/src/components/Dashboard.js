import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  BarChart3,
  Trophy,
  ArrowRight,
  Zap,
} from 'lucide-react';

/* ── quick action card ── */
const QuickAction = ({ icon: Icon, title, description, onClick, color }) => (
  <button
    onClick={onClick}
    className="group flex items-start gap-3 p-4 rounded-xl bg-surface-800 border border-surface-700 hover:border-surface-600 transition-all duration-200 text-left w-full"
  >
    <div className={`p-2 rounded-lg shrink-0 ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-surface-400 mt-0.5">{description}</p>
    </div>
    <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
  </button>
);

/* ═══════  Dashboard Component  ═══════ */
export default function Dashboard({ userName }) {
  const navigate = useNavigate();

  const displayName = userName || localStorage.getItem('userName') || 'Student';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* greeting */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {greeting}, <span className="text-accent-400">{displayName}</span>
          </h1>
          <p className="text-surface-400 text-sm">Here's an overview of your preparation progress.</p>
        </div>

        {/* two-col layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* quick actions */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <QuickAction
                icon={Zap}
                title="New Practice Paper"
                description="Generate a JEE question set"
                onClick={() => navigate('/')}
                color="bg-accent-500/10 text-accent-400"
              />
              <QuickAction
                icon={BookOpen}
                title="Past Papers"
                description="Review completed tests"
                onClick={() => navigate('/past-papers')}
                color="bg-success-500/10 text-success-400"
              />
              <QuickAction
                icon={BarChart3}
                title="Analytics"
                description="View detailed performance"
                onClick={() => navigate('/analytics')}
                color="bg-warning-500/10 text-warning-400"
              />
            </div>
          </div>

          {/* recent activity placeholder */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Trophy className="w-10 h-10 text-surface-600 mb-3" />
                <p className="text-surface-400 text-sm font-medium">No activity yet</p>
                <p className="text-surface-500 text-xs mt-1">Generate your first paper to get started!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
