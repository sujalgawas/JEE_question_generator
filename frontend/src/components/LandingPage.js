import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Brain,
    Sparkles,
    Target,
    Zap,
    BrainCircuit,
    Calculator,
    TrendingUp,
    Briefcase,
} from 'lucide-react';

/* ── Mode Toggle ── */
const ModeToggle = ({ mode, onChange }) => (
    <div className="inline-flex rounded-2xl bg-surface-800/80 backdrop-blur-sm border border-surface-700 p-1.5 shadow-lg">
        <button
            onClick={() => onChange('placement')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${mode === 'placement'
                ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                : 'text-surface-400 hover:text-surface-300 hover:bg-surface-700/50'
                }`}
        >
            <Briefcase className="w-4 h-4" />
            Placements
        </button>
        <button
            onClick={() => onChange('jee')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${mode === 'jee'
                ? 'bg-gradient-to-r from-accent-600 to-indigo-600 text-white shadow-lg shadow-accent-500/30 scale-[1.02]'
                : 'text-surface-400 hover:text-surface-300 hover:bg-surface-700/50'
                }`}
        >
            <Zap className="w-4 h-4" />
            JEE
        </button>
    </div>
);

/* ═══════  Landing Page (Logged-Out)  ═══════ */
export default function LandingPage({ appMode, onModeChange }) {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    React.useEffect(() => { setIsVisible(true); }, []);

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
            <div className={`text-center max-w-2xl transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                {/* toggle */}
                <div className="mb-8">
                    <ModeToggle mode={appMode} onChange={onModeChange} />
                </div>

                {appMode === 'placement' ? (
                    /* ── Placement Landing ── */
                    <>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-6">
                            <BrainCircuit className="w-3.5 h-3.5" />
                            AI-Powered Placement Preparation
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4">
                            Crack Placements with
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-300">
                                Smart Practice
                            </span>
                        </h1>
                        <p className="text-surface-400 text-lg mb-8 max-w-xl mx-auto">
                            AI-generated AMCAT-style questions tailored to your level. Practice aptitude, reasoning, and verbal skills to ace your placements.
                        </p>

                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            {[
                                { icon: Calculator, label: 'Quantitative Aptitude' },
                                { icon: BrainCircuit, label: 'Logical Reasoning' },
                                { icon: TrendingUp, label: 'Track Progress' },
                            ].map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-purple-500/20 text-sm text-surface-300">
                                    <Icon className="w-4 h-4 text-purple-400" />
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/signup')}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/20"
                            >
                                Get Started Free
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 font-medium transition-colors"
                            >
                                I have an account
                            </button>
                        </div>
                    </>
                ) : (
                    /* ── JEE Landing ── */
                    <>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-semibold mb-6">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI-Powered JEE Preparation
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4">
                            Master JEE with
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-accent-300">
                                Smart Practice
                            </span>
                        </h1>
                        <p className="text-surface-400 text-lg mb-8 max-w-xl mx-auto">
                            Generate personalized MCQ papers tailored to your level. AI analyzes your strengths and weaknesses for focused prep.
                        </p>

                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            {[
                                { icon: Brain, label: 'AI-Generated Questions' },
                                { icon: Target, label: 'Adaptive Difficulty' },
                                { icon: Zap, label: 'Instant Results' },
                            ].map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-accent-500/20 text-sm text-surface-300">
                                    <Icon className="w-4 h-4 text-accent-400" />
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/signup')}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors"
                            >
                                Get Started Free
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 font-medium transition-colors"
                            >
                                I have an account
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
