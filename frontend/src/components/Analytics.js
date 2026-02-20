import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Clock, Brain, Target, Zap, ChevronRight, X, CheckCircle, XCircle, BookOpen, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import API_URL from '../apiConfig';

/* ── helpers ── */
const convertOptionsToArray = (optionsObj) => {
    if (!optionsObj || typeof optionsObj !== 'object') return [];
    return Object.keys(optionsObj).sort().map((k) => optionsObj[k]);
};

const getCorrectOptionValue = (optionsObj, correctKey) => {
    if (!optionsObj || !correctKey) return null;
    return optionsObj[correctKey];
};

const calculateCorrectScore = (result) => {
    if (!result.paper_details || !result.answers) return { score: 0, total: 0, percentage: 0 };
    const options = result.paper_details.options;
    const correctAnswers = result.paper_details.correct_answer;
    const totalQuestions = result.paper_details.question_number?.length || 0;
    let score = 0;
    for (let i = 0; i < totalQuestions; i++) {
        const userAnswer = result.answers[i.toString()];
        const correctKey = correctAnswers[i];
        const correctValue = getCorrectOptionValue(options[i], correctKey);
        if (userAnswer === correctValue) score++;
    }
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 10000) / 100 : 0;
    return { score, total: totalQuestions, percentage };
};

/* ── stat card ── */
const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5 hover:border-surface-600 transition-colors">
        <div className={`p-2.5 rounded-lg ${color} mb-3 w-fit`}>
            <Icon className="w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
        <p className="text-sm text-surface-400">{title}</p>
    </div>
);

const chartTooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
};

/* ── test details modal ── */
const TestDetailsModal = ({ test, onClose }) => {
    if (!test || !test.paper_details) return null;
    const paper = test.paper_details;
    const userAnswers = test.answers;
    const calc = calculateCorrectScore(test);

    const fmt = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-800 rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden w-full border border-surface-700 shadow-2xl">
                {/* header */}
                <div className="sticky top-0 bg-surface-800 px-6 py-4 border-b border-surface-700 z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Test Analysis</h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 transition-colors">
                            <X className="w-5 h-5 text-surface-400" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-success-500/10 border border-success-500/20 text-center">
                            <div className="text-xl font-bold text-success-400">{calc.score}</div>
                            <div className="text-xs text-surface-400">Correct</div>
                        </div>
                        <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-center">
                            <div className="text-xl font-bold text-danger-400">{calc.total - calc.score}</div>
                            <div className="text-xs text-surface-400">Incorrect</div>
                        </div>
                        <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 text-center">
                            <div className="text-xl font-bold text-accent-400">{calc.percentage}%</div>
                            <div className="text-xs text-surface-400">Score</div>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-700/60 text-center">
                            <div className="text-xl font-bold text-white">{fmt(test.time_spent || 0)}</div>
                            <div className="text-xs text-surface-400">Time</div>
                        </div>
                    </div>
                </div>

                {/* questions */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <h3 className="text-sm font-semibold text-surface-400 mb-4 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Question-wise Analysis
                    </h3>
                    <div className="space-y-3">
                        {paper.question_number?.map((qNum, i) => {
                            const userAnswer = userAnswers[i.toString()];
                            const correctKey = paper.correct_answer[i];
                            const correctValue = getCorrectOptionValue(paper.options[i], correctKey);
                            const ok = userAnswer === correctValue;

                            return (
                                <div key={i} className={`rounded-xl border p-4 ${ok ? 'border-success-500/30 bg-success-500/5' : 'border-danger-500/30 bg-danger-500/5'}`}>
                                    {/* q header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-surface-700 text-xs font-semibold text-surface-300">Q{qNum}</span>
                                                {paper.subject?.[i] && <span className="px-2 py-0.5 rounded bg-accent-500/10 text-xs text-accent-400">{paper.subject[i]}</span>}
                                                {paper.difficulty?.[i] && (
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${paper.difficulty[i] === 'easy' ? 'bg-success-500/10 text-success-400'
                                                            : paper.difficulty[i] === 'medium' ? 'bg-warning-500/10 text-warning-400'
                                                                : 'bg-danger-500/10 text-danger-400'
                                                        }`}>{paper.difficulty[i]}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-white">{paper.question_text[i]}</p>
                                        </div>
                                        <div className={`p-1.5 rounded-lg ml-3 shrink-0 ${ok ? 'bg-success-500/15' : 'bg-danger-500/15'}`}>
                                            {ok ? <CheckCircle className="w-5 h-5 text-success-400" /> : <XCircle className="w-5 h-5 text-danger-400" />}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-surface-500 text-xs mb-1">Your Answer</p>
                                            <div className={`p-2.5 rounded-lg ${ok ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'}`}>
                                                {userAnswer || 'Not answered'}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-surface-500 text-xs mb-1">Correct Answer</p>
                                            <div className="p-2.5 rounded-lg bg-success-500/10 text-success-400">
                                                {correctValue} <span className="text-surface-500">({correctKey})</span>
                                            </div>
                                        </div>
                                    </div>

                                    {paper.explanation?.[i] && (
                                        <div className="mt-3 p-3 rounded-lg bg-surface-700/40 text-xs text-surface-300 leading-relaxed">
                                            <span className="text-accent-400 font-medium">Explanation: </span>
                                            {paper.explanation[i]}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════  Analytics Component  ═══════ */
export default function Analytics() {
    const navigate = useNavigate();
    const [testResults, setTestResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTest, setSelectedTest] = useState(null);
    const [analytics, setAnalytics] = useState({});

    useEffect(() => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');
        if (!token || !userName) { setError('Not authenticated'); setLoading(false); return; }

        fetch(`${API_URL}/get-user-analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userName }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.results) { setTestResults(data.results); calcAnalytics(data.results); }
                else setError(data.error || 'Failed to fetch results');
                setLoading(false);
            })
            .catch(() => { setError('Failed to fetch analytics'); setLoading(false); });
    }, []);

    const calcAnalytics = (results) => {
        if (!results.length) { setAnalytics({}); return; }

        let totalQ = 0, totalCorrect = 0;
        const subjectStats = {}, diffStats = {};

        results.forEach((r) => {
            if (!r.paper_details?.question_number) return;
            const n = r.paper_details.question_number.length;
            totalQ += n;

            for (let i = 0; i < n; i++) {
                const ua = r.answers[i.toString()];
                const ck = r.paper_details.correct_answer[i];
                const cv = getCorrectOptionValue(r.paper_details.options[i], ck);
                const ok = ua === cv;
                if (ok) totalCorrect++;

                const subj = r.paper_details.subject?.[i];
                if (subj) {
                    if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, total: 0 };
                    subjectStats[subj].total++;
                    if (ok) subjectStats[subj].correct++;
                }

                const diff = r.paper_details.difficulty?.[i];
                if (diff) {
                    if (!diffStats[diff]) diffStats[diff] = { correct: 0, total: 0 };
                    diffStats[diff].total++;
                    if (ok) diffStats[diff].correct++;
                }
            }
        });

        const progressData = results
            .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
            .map((r, i) => ({ test: `Test ${i + 1}`, score: calculateCorrectScore(r).percentage }));

        setAnalytics({
            totalTests: results.length,
            totalQuestions: totalQ,
            totalCorrect,
            averagePercentage: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 10000) / 100 : 0,
            averageTime: Math.round(results.reduce((s, r) => s + (r.time_spent || 0), 0) / results.length / 60),
            subjectStats, diffStats, progressData,
        });
    };

    const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-surface-400 text-sm">Loading analytics…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="w-10 h-10 text-danger-400 mx-auto mb-3" />
                    <p className="text-danger-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-900">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                {/* header */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Analytics</h1>
                    <p className="text-surface-400 text-sm">Track your progress and identify areas for improvement</p>
                </div>

                {testResults.length === 0 ? (
                    <div className="text-center py-16">
                        <TrendingUp className="w-12 h-12 text-surface-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-surface-400 mb-1">No Analytics Yet</h3>
                        <p className="text-surface-500 text-sm mb-6">Take your first test to see performance insights</p>
                        <button
                            onClick={() => navigate('/past-papers')}
                            className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold transition-colors"
                        >
                            Start a Test
                        </button>
                    </div>
                ) : (
                    <>
                        {/* stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                            <StatCard icon={Award} title="Tests Taken" value={analytics.totalTests} color="bg-accent-500/10 text-accent-400" />
                            <StatCard icon={Target} title="Correct" value={analytics.totalCorrect} color="bg-success-500/10 text-success-400" />
                            <StatCard icon={TrendingUp} title="Avg Score" value={`${analytics.averagePercentage}%`} color="bg-warning-500/10 text-warning-400" />
                            <StatCard icon={Brain} title="Questions" value={analytics.totalQuestions} color="bg-accent-500/10 text-accent-300" />
                            <StatCard icon={Clock} title="Avg Time" value={`${analytics.averageTime}m`} color="bg-surface-600/30 text-surface-300" />
                        </div>

                        {/* charts */}
                        <div className="grid lg:grid-cols-2 gap-6 mb-8">
                            {analytics.progressData?.length > 0 && (
                                <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
                                    <h3 className="text-sm font-semibold text-surface-300 mb-4 flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-accent-400" /> Progress Over Time
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={analytics.progressData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="test" stroke="#64748b" style={{ fontSize: '11px' }} />
                                            <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                                            <Tooltip contentStyle={chartTooltipStyle} />
                                            <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {analytics.subjectStats && Object.keys(analytics.subjectStats).length > 0 && (
                                <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
                                    <h3 className="text-sm font-semibold text-surface-300 mb-4 flex items-center gap-1.5">
                                        <Brain className="w-4 h-4 text-accent-400" /> Subject Performance
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={Object.entries(analytics.subjectStats).map(([name, s]) => ({ name, pct: Math.round((s.correct / s.total) * 100) }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px' }} />
                                            <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                                            <Tooltip contentStyle={chartTooltipStyle} />
                                            <Bar dataKey="pct" fill="#818cf8" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* difficulty breakdown */}
                        {analytics.diffStats && Object.keys(analytics.diffStats).length > 0 && (
                            <div className="bg-surface-800 rounded-xl border border-surface-700 p-5 mb-8">
                                <h3 className="text-sm font-semibold text-surface-300 mb-4 flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-warning-400" /> Difficulty Breakdown
                                </h3>
                                <div className="grid sm:grid-cols-3 gap-4">
                                    {Object.entries(analytics.diffStats).map(([diff, s]) => {
                                        const pct = Math.round((s.correct / s.total) * 100);
                                        const color = diff === 'easy' ? 'success' : diff === 'medium' ? 'warning' : 'danger';
                                        return (
                                            <div key={diff} className="p-4 rounded-lg bg-surface-700/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-medium capitalize">{diff}</span>
                                                    <span className={`text-${color}-400 text-sm font-semibold`}>{pct}%</span>
                                                </div>
                                                <div className="text-xs text-surface-500 mb-2">{s.correct}/{s.total} correct</div>
                                                <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full bg-${color}-500 transition-all duration-700`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* recent tests */}
                        <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
                            <div className="px-5 py-4 border-b border-surface-700/50">
                                <h3 className="text-sm font-semibold text-surface-300 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-accent-400" /> Recent Tests
                                </h3>
                            </div>
                            <div className="divide-y divide-surface-700/50">
                                {testResults
                                    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
                                    .slice(0, 10)
                                    .map((test, i) => {
                                        const sc = calculateCorrectScore(test);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedTest(test)}
                                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-700/30 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-accent-500/10">
                                                        <Activity className="w-4 h-4 text-accent-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">Test #{testResults.length - i}</p>
                                                        <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                                                            <span>{fmtDate(test.completed_at)}</span>
                                                            <span>{sc.score}/{sc.total} questions</span>
                                                            <span>{fmtTime(test.time_spent || 0)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-lg font-bold ${sc.percentage >= 70 ? 'text-success-400' : sc.percentage >= 40 ? 'text-warning-400' : 'text-danger-400'}`}>
                                                        {sc.percentage}%
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-surface-600" />
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {selectedTest && <TestDetailsModal test={selectedTest} onClose={() => setSelectedTest(null)} />}
        </div>
    );
}
