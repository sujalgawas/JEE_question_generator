// frontend/src/components/PlacementAnalytics.js
// Dedicated analytical dashboard for Campus Placement & Aptitude Tests

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    Award,
    Clock,
    Brain,
    Target,
    Zap,
    ChevronRight,
    X,
    CheckCircle,
    XCircle,
    BookOpen,
    AlertCircle,
    BrainCircuit,
    ArrowRight,
    Loader2,
    Calendar,
    BarChart3,
    Filter,
    HelpCircle
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

import API_URL from '../apiConfig';
import { getAuthSession } from './authUtils';

/* ── Helpers ── */
const fmtTime = (s) => {
    if (!s && s !== 0) return '0m';
    const num = Number(s);
    const m = Math.floor(num / 60);
    const sec = num % 60;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
};

const fmtDate = (d) => {
    if (!d) return 'Recent';
    try {
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Recent';
    }
};

const chartTooltipStyle = {
    backgroundColor: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '10px',
    color: '#f4f4f5',
    fontSize: '12px',
    padding: '8px 12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
};

/* ── Question-Wise Review Modal ── */
const PlacementTestDetailsModal = ({ test, onClose, onRetake }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'incorrect', 'correct'

    if (!test || !test.paper_details) return null;
    const paper = test.paper_details;
    const userAnswers = test.answers || [];
    const questionTexts = paper.question_text || [];
    const correctAnswers = paper.correct_answer || [];
    const optionsList = paper.option || [];
    const explanations = paper.explanation || [];
    const topics = paper.topic || [];

    const totalQ = test.total_questions || questionTexts.length || 0;
    const score = test.score || 0;
    const incorrect = totalQ - score;
    const percentage = test.percentage || (totalQ > 0 ? Math.round((score / totalQ) * 100) : 0);

    const questionsData = questionTexts.map((qText, i) => {
        const uAns = userAnswers[i] !== undefined ? userAnswers[i] : '';
        const cAns = correctAnswers[i] !== undefined ? correctAnswers[i] : '';
        const isCorrect = uAns && uAns === cAns;
        return {
            index: i,
            qNum: i + 1,
            qText,
            options: optionsList[i] || [],
            userAnswer: uAns,
            correctAnswer: cAns,
            explanation: explanations[i] || '',
            topic: topics[i] || test.target_topic || 'Aptitude',
            isCorrect
        };
    });

    const filteredQuestions = questionsData.filter((q) => {
        if (filter === 'correct') return q.isCorrect;
        if (filter === 'incorrect') return !q.isCorrect;
        return true;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-850 rounded-2xl max-w-4xl max-h-[92vh] overflow-hidden w-full border border-purple-500/20 shadow-2xl flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-surface-800/95 backdrop-blur-md px-6 py-4 border-b border-surface-700 z-10 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <BrainCircuit className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white leading-tight">Placement Test Review</h2>
                                <p className="text-xs text-surface-400">
                                    Topic: <span className="text-purple-300 font-medium">{test.target_topic || 'All Topics'}</span> • {fmtDate(test.completed_at)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-surface-700/50 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="p-3 rounded-xl bg-success-500/10 border border-success-500/20 text-center">
                            <div className="text-xl font-bold text-success-400">{score}</div>
                            <div className="text-xs text-surface-400 font-medium">Correct</div>
                        </div>
                        <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-center">
                            <div className="text-xl font-bold text-danger-400">{incorrect}</div>
                            <div className="text-xs text-surface-400 font-medium">Incorrect</div>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                            <div className="text-xl font-bold text-purple-400">{percentage}%</div>
                            <div className="text-xs text-surface-400 font-medium">Score</div>
                        </div>
                        <div className="p-3 rounded-xl bg-surface-700/50 border border-surface-600/30 text-center">
                            <div className="text-xl font-bold text-white">{fmtTime(test.total_time_spent)}</div>
                            <div className="text-xs text-surface-400 font-medium">Time Spent</div>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-surface-400 flex items-center gap-1 mr-1">
                            <Filter className="w-3.5 h-3.5" /> Filter:
                        </span>
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                filter === 'all'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-surface-700/50 text-surface-400 hover:text-surface-200'
                            }`}
                        >
                            All ({totalQ})
                        </button>
                        <button
                            onClick={() => setFilter('incorrect')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                filter === 'incorrect'
                                    ? 'bg-danger-500/20 text-danger-400 border border-danger-500/30'
                                    : 'bg-surface-700/50 text-surface-400 hover:text-surface-200'
                            }`}
                        >
                            Incorrect ({incorrect})
                        </button>
                        <button
                            onClick={() => setFilter('correct')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                filter === 'correct'
                                    ? 'bg-success-500/20 text-success-400 border border-success-500/30'
                                    : 'bg-surface-700/50 text-surface-400 hover:text-surface-200'
                            }`}
                        >
                            Correct ({score})
                        </button>
                    </div>
                </div>

                {/* Question List */}
                <div className="p-6 overflow-y-auto space-y-4 flex-grow">
                    {filteredQuestions.length === 0 ? (
                        <div className="text-center py-12 text-surface-400">
                            No questions match the current filter.
                        </div>
                    ) : (
                        filteredQuestions.map((q) => (
                            <div
                                key={q.index}
                                className={`rounded-xl border p-5 transition-all ${
                                    q.isCorrect
                                        ? 'border-success-500/30 bg-success-500/5'
                                        : 'border-danger-500/30 bg-danger-500/5'
                                }`}
                            >
                                {/* Question Title Bar */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded bg-surface-700 text-xs font-semibold text-surface-200">
                                                Q{q.qNum}
                                            </span>
                                            {q.topic && (
                                                <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-medium">
                                                    {q.topic}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-white leading-relaxed">{q.qText}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl shrink-0 ${q.isCorrect ? 'bg-success-500/15' : 'bg-danger-500/15'}`}>
                                        {q.isCorrect ? (
                                            <CheckCircle className="w-5 h-5 text-success-400" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-danger-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Options breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                    {q.options.map((opt, optIdx) => {
                                        const isChosen = q.userAnswer === opt;
                                        const isCorrect = q.correctAnswer === opt;

                                        let optClass = 'bg-surface-800/60 border-surface-700 text-surface-300';
                                        if (isCorrect) {
                                            optClass = 'bg-success-500/15 border-success-500/40 text-success-300 font-medium';
                                        } else if (isChosen && !isCorrect) {
                                            optClass = 'bg-danger-500/15 border-danger-500/40 text-danger-300 font-medium';
                                        }

                                        return (
                                            <div
                                                key={optIdx}
                                                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${optClass}`}
                                            >
                                                <span>{opt}</span>
                                                {isCorrect && (
                                                    <span className="px-1.5 py-0.5 rounded bg-success-500/20 text-[10px] text-success-400 font-semibold ml-2 shrink-0">
                                                        Correct Answer
                                                    </span>
                                                )}
                                                {isChosen && !isCorrect && (
                                                    <span className="px-1.5 py-0.5 rounded bg-danger-500/20 text-[10px] text-danger-400 font-semibold ml-2 shrink-0">
                                                        Your Choice
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* User vs Correct summary */}
                                {!q.userAnswer && (
                                    <p className="text-xs text-amber-400 mb-2 font-medium">⚠️ Unanswered</p>
                                )}

                                {/* Explanation box */}
                                {q.explanation && (
                                    <div className="p-3 rounded-lg bg-surface-800/80 border border-surface-700 text-xs text-surface-300">
                                        <span className="font-semibold text-purple-300 block mb-1 flex items-center gap-1.5">
                                            <HelpCircle className="w-3.5 h-3.5 text-purple-400" /> Explanation & Solution:
                                        </span>
                                        <p className="leading-relaxed text-surface-300">{q.explanation}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="bg-surface-800 px-6 py-3 border-t border-surface-700 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-white text-xs font-semibold transition-colors"
                    >
                        Close Review
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Stat Card Component ── */
const StatCard = ({ icon: Icon, title, value, subtext, color }) => (
    <div className="bg-surface-800 rounded-2xl border border-surface-700/70 p-5 hover:border-purple-500/30 transition-all duration-200">
        <div className={`p-2.5 rounded-xl ${color} mb-3 w-fit`}>
            <Icon className="w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-white mb-0.5 tracking-tight">{value}</p>
        <p className="text-sm font-medium text-surface-400">{title}</p>
        {subtext && <p className="text-xs text-surface-500 mt-1">{subtext}</p>}
    </div>
);

/* ══════════════════════════════════════════════════════
   Main PlacementAnalytics Component
   ══════════════════════════════════════════════════════ */
export default function PlacementAnalytics() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [analyticsData, setAnalyticsData] = useState(null);
    const [selectedTest, setSelectedTest] = useState(null);

    const fetchAnalytics = async () => {
        const { token } = getAuthSession();
        if (!token) {
            setError('User session missing. Please log in.');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/get-placement-analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ token })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || 'Failed to load placement analytics.');
                setLoading(false);
                return;
            }

            const data = await res.json();
            setAnalyticsData(data);
        } catch (err) {
            console.error('Error fetching placement analytics:', err);
            setError('Unable to connect to the analytics service.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center py-24">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                <p className="text-surface-400 font-medium text-sm">Computing your placement performance & weak concepts…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-900 py-12 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">Failed to Load Placement Analytics</p>
                            <p className="text-xs text-danger-300">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const summary = analyticsData?.summary || {
        total_tests: 0,
        total_questions: 0,
        total_correct: 0,
        average_percentage: 0,
        average_time: 0
    };

    const results = analyticsData?.results || [];
    const weakConcepts = analyticsData?.weak_concepts_detailed || [];
    const topicStats = analyticsData?.topic_stats || {};

    // Prepare line chart data (chronological)
    const progressData = [...results]
        .reverse()
        .map((r, i) => ({
            name: `Test ${i + 1}`,
            score: r.percentage,
            topic: r.target_topic || 'All Topics',
            date: fmtDate(r.completed_at)
        }));

    // Prepare topic bar chart data
    const topicChartData = Object.entries(topicStats).map(([topic, stats]) => ({
        name: topic.length > 18 ? topic.slice(0, 16) + '…' : topic,
        fullName: topic,
        accuracy: stats.accuracy || (stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0),
        total: stats.total,
        correct: stats.correct
    })).sort((a, b) => b.accuracy - a.accuracy);

    return (
        <div className="min-h-screen bg-surface-900 pb-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                <BrainCircuit className="w-6 h-6" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                Placement Analytics
                            </h1>
                            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                PlacePrep AI
                            </span>
                        </div>
                        <p className="text-surface-400 text-sm">
                            Analyze your aptitude test performance, topic strengths, and AI-identified weak areas.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/placement')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-600/20 hover:scale-[1.02]"
                        >
                            <Zap className="w-4 h-4" />
                            Take Placement Test
                        </button>
                    </div>
                </div>

                {/* Empty State */}
                {results.length === 0 ? (
                    <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-12 text-center max-w-xl mx-auto my-8">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto mb-4">
                            <BarChart3 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Placement Tests Completed Yet</h3>
                        <p className="text-surface-400 text-sm mb-6 leading-relaxed">
                            Once you complete an AMCAT-style placement or aptitude test, your accuracy, topic mastery breakdown, and personalized weak concept diagnostics will appear here.
                        </p>
                        <button
                            onClick={() => navigate('/placement')}
                            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all shadow-md shadow-purple-600/20"
                        >
                            Start Your First Placement Test
                        </button>
                    </div>
                ) : (
                    <>
                        {/* 1. Stat Cards Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                            <StatCard
                                icon={Award}
                                title="Tests Taken"
                                value={summary.total_tests}
                                subtext="Completed tests"
                                color="bg-purple-500/10 text-purple-400"
                            />
                            <StatCard
                                icon={Target}
                                title="Average Score"
                                value={`${summary.average_percentage}%`}
                                subtext="Overall accuracy"
                                color="bg-emerald-500/10 text-emerald-400"
                            />
                            <StatCard
                                icon={Brain}
                                title="Questions"
                                value={`${summary.total_correct}/${summary.total_questions}`}
                                subtext="Total correct answers"
                                color="bg-blue-500/10 text-blue-400"
                            />
                            <StatCard
                                icon={Clock}
                                title="Avg Time / Test"
                                value={fmtTime(summary.average_time)}
                                subtext="Speed metric"
                                color="bg-amber-500/10 text-amber-400"
                            />
                            <StatCard
                                icon={AlertCircle}
                                title="Weak Concepts"
                                value={weakConcepts.length}
                                subtext="Identified by AI"
                                color="bg-pink-500/10 text-pink-400"
                            />
                        </div>

                        {/* 2. Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Score Trend Line Chart */}
                            <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-purple-400" /> Performance Progression
                                        </h3>
                                        <p className="text-xs text-surface-400">Score percentage test-by-test</p>
                                    </div>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={progressData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                            <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                                            <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} unit="%" />
                                            <Tooltip
                                                contentStyle={chartTooltipStyle}
                                                formatter={(value) => [`${value}%`, 'Score']}
                                                labelFormatter={(label, payload) => {
                                                    const item = payload?.[0]?.payload;
                                                    return item ? `${label} (${item.topic})` : label;
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#a855f7"
                                                strokeWidth={3}
                                                dot={{ fill: '#c084fc', r: 5 }}
                                                activeDot={{ r: 7, fill: '#e9d5ff' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Topic Mastery Bar Chart */}
                            <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4 text-emerald-400" /> Topic Accuracy Breakdown
                                        </h3>
                                        <p className="text-xs text-surface-400">Performance percentage across tested topics</p>
                                    </div>
                                </div>
                                <div className="h-64">
                                    {topicChartData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-xs text-surface-500">
                                            No topic statistics yet
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topicChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                                <XAxis dataKey="name" stroke="#71717a" fontSize={10} interval={0} />
                                                <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} unit="%" />
                                                <Tooltip
                                                    contentStyle={chartTooltipStyle}
                                                    formatter={(val, name, item) => [
                                                        `${val}% (${item.payload.correct}/${item.payload.total} correct)`,
                                                        item.payload.fullName
                                                    ]}
                                                />
                                                <Bar dataKey="accuracy" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. AI-Identified Weak Concepts Section */}
                        {weakConcepts.length > 0 && (
                            <div className="bg-surface-800 rounded-2xl border border-pink-500/20 p-6 mb-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl -z-10" />
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">AI-Identified Weak Concepts</h3>
                                        <p className="text-xs text-surface-400">
                                            The placement engine detected lower accuracy in these specific topics. Focus your practice here:
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                                    {weakConcepts.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 rounded-xl bg-surface-850 border border-surface-700/80 flex items-center justify-between gap-3 hover:border-pink-500/40 transition-colors"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-white">{item.topic}</p>
                                                <p className="text-xs text-pink-400 mt-0.5">
                                                    Accuracy: {item.accuracy}% ({item.correct}/{item.total})
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate('/placement')}
                                                className="px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold flex items-center gap-1 transition-all shrink-0"
                                            >
                                                Practice <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. Past Placement Tests Table / Review Cards */}
                        <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-purple-400" /> Past Placement Test Results
                                    </h3>
                                    <p className="text-xs text-surface-400">
                                        Click on any test to review questions, chosen answers, and explanations.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {results.map((testItem, idx) => {
                                    const pct = testItem.percentage || 0;
                                    let badgeColor = 'bg-danger-500/10 text-danger-400 border-danger-500/20';
                                    if (pct >= 75) {
                                        badgeColor = 'bg-success-500/10 text-success-400 border-success-500/20';
                                    } else if (pct >= 50) {
                                        badgeColor = 'bg-warning-500/10 text-warning-400 border-warning-500/20';
                                    }

                                    return (
                                        <div
                                            key={testItem.result_id || idx}
                                            onClick={() => setSelectedTest(testItem)}
                                            className="p-4 rounded-xl bg-surface-850 border border-surface-700 hover:border-purple-500/40 cursor-pointer transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                                        >
                                            <div className="flex items-start sm:items-center gap-3">
                                                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                                                    <BrainCircuit className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold text-white">
                                                            {testItem.target_topic || 'All Topics'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                                                            {pct}% ({testItem.score}/{testItem.total_questions})
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5 text-surface-500" />
                                                            {fmtDate(testItem.completed_at)}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5 text-surface-500" />
                                                            {fmtTime(testItem.total_time_spent)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedTest(testItem);
                                                    }}
                                                    className="px-3.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-purple-500/20"
                                                >
                                                    Review Questions <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Test Details Modal */}
            {selectedTest && (
                <PlacementTestDetailsModal
                    test={selectedTest}
                    onClose={() => setSelectedTest(null)}
                />
            )}
        </div>
    );
}
