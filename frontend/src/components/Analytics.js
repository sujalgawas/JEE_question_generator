import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, Clock, Brain, Target, Zap, ChevronRight, X, CheckCircle, XCircle, BookOpen, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// Mock API URL
const API_URL = 'http://localhost:5000';

// Helper functions
const convertOptionsToArray = (optionsObj) => {
    if (!optionsObj || typeof optionsObj !== 'object') return [];
    return Object.keys(optionsObj).sort().map(key => optionsObj[key]);
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

    for (let index = 0; index < totalQuestions; index++) {
        const userAnswer = result.answers[index.toString()];
        const correctKey = correctAnswers[index];
        const correctValue = getCorrectOptionValue(options[index], correctKey);
        
        if (userAnswer === correctValue) {
            score += 1;
        }
    }

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100 * 100) / 100 : 0;
    return { score, total: totalQuestions, percentage };
};

// Stat Card Component
const StatCard = ({ icon: Icon, title, value, subtitle, color, delay }) => (
    <div 
        className="group relative animate-in slide-in-from-bottom"
        style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
    >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
            <div>
                <div className="text-3xl font-black text-white mb-1">{value}</div>
                <div className="text-sm text-gray-400">{title}</div>
                {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
            </div>
        </div>
    </div>
);

// Test Details Modal
const TestDetailsModal = ({ test, onClose }) => {
    if (!test || !test.paper_details) return null;

    const paper = test.paper_details;
    const userAnswers = test.answers;
    const calculatedScore = calculateCorrectScore(test);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-5xl max-h-[90vh] overflow-hidden w-full border border-gray-700/50 shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl p-6 border-b border-gray-700/50 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                            Test Analysis
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-700/50 rounded-xl transition-colors duration-200"
                        >
                            <X className="w-6 h-6 text-gray-400 hover:text-white" />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-green-400">{calculatedScore.score}</div>
                            <div className="text-xs text-gray-400 mt-1">Correct</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-red-400">{calculatedScore.total - calculatedScore.score}</div>
                            <div className="text-xs text-gray-400 mt-1">Incorrect</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-blue-400">{calculatedScore.percentage}%</div>
                            <div className="text-xs text-gray-400 mt-1">Score</div>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-purple-400">{formatTime(test.time_spent || 0)}</div>
                            <div className="text-xs text-gray-400 mt-1">Time Taken</div>
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-400" />
                        Question-wise Analysis
                    </h3>
                    <div className="space-y-4">
                        {paper.question_number?.map((qNum, index) => {
                            const userAnswer = userAnswers[index.toString()];
                            const correctKey = paper.correct_answer[index];
                            const correctValue = getCorrectOptionValue(paper.options[index], correctKey);
                            const isCorrect = userAnswer === correctValue;

                            return (
                                <div 
                                    key={index} 
                                    className={`relative overflow-hidden rounded-2xl border ${
                                        isCorrect 
                                            ? 'border-green-500/50 bg-gradient-to-r from-green-900/20 to-green-800/10' 
                                            : 'border-red-500/50 bg-gradient-to-r from-red-900/20 to-red-800/10'
                                    }`}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-1 bg-gray-700/50 rounded-lg text-xs font-bold text-gray-300">
                                                        Q{qNum}
                                                    </span>
                                                    {paper.subject && paper.subject[index] && (
                                                        <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                                                            {paper.subject[index]}
                                                        </span>
                                                    )}
                                                    {paper.difficulty && paper.difficulty[index] && (
                                                        <span className={`px-2 py-1 rounded-lg text-xs ${
                                                            paper.difficulty[index] === 'easy' 
                                                                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                                                                : paper.difficulty[index] === 'medium'
                                                                ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300'
                                                                : 'bg-red-500/20 border border-red-500/30 text-red-300'
                                                        }`}>
                                                            {paper.difficulty[index]}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-white font-medium">{paper.question_text[index]}</p>
                                            </div>
                                            <div className={`p-2 rounded-xl ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                                {isCorrect ? (
                                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                                ) : (
                                                    <XCircle className="w-6 h-6 text-red-400" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-gray-400 text-sm mb-2 font-semibold">Your Answer:</p>
                                                <div className={`p-3 rounded-xl ${
                                                    isCorrect 
                                                        ? 'bg-green-500/20 border border-green-500/30' 
                                                        : 'bg-red-500/20 border border-red-500/30'
                                                }`}>
                                                    <p className={`${isCorrect ? 'text-green-300' : 'text-red-300'} font-medium`}>
                                                        {userAnswer || 'Not answered'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-sm mb-2 font-semibold">Correct Answer:</p>
                                                <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30">
                                                    <p className="text-green-300 font-medium">
                                                        {correctValue} <span className="text-gray-400">({correctKey})</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {paper.explanation && paper.explanation[index] && (
                                            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                                <p className="text-blue-400 text-sm font-semibold mb-2">💡 Explanation:</p>
                                                <p className="text-gray-300 text-sm leading-relaxed">{paper.explanation[index]}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Analytics Component
export default function Analytics() {
    const [testResults, setTestResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTest, setSelectedTest] = useState(null);
    const [analytics, setAnalytics] = useState({});

    useEffect(() => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        if (!token || !userName) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        fetch(`${API_URL}/get-user-analytics`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, userName })
        })
            .then(res => res.json())
            .then(data => {
                if (data.results) {
                    setTestResults(data.results);
                    calculateAnalytics(data.results);
                } else {
                    setError(data.error || 'Failed to fetch results');
                }
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to fetch analytics data');
                setLoading(false);
            });
    }, []);

    const calculateAnalytics = (results) => {
        if (results.length === 0) {
            setAnalytics({});
            return;
        }

        const totalTests = results.length;
        let totalQuestions = 0;
        let totalCorrect = 0;

        results.forEach(result => {
            if (result.paper_details && result.paper_details.question_number) {
                const questionCount = result.paper_details.question_number.length;
                totalQuestions += questionCount;

                const options = result.paper_details.options;
                const correctAnswers = result.paper_details.correct_answer;

                for (let index = 0; index < questionCount; index++) {
                    const userAnswer = result.answers[index.toString()];
                    const correctKey = correctAnswers[index];
                    const correctValue = getCorrectOptionValue(options[index], correctKey);

                    if (userAnswer === correctValue) {
                        totalCorrect += 1;
                    }
                }
            }
        });

        const averagePercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
        const averageTime = results.reduce((sum, result) => sum + (result.time_spent || 0), 0) / totalTests;

        // Subject-wise analytics
        const subjectStats = {};
        results.forEach(result => {
            if (result.paper_details && result.paper_details.subject) {
                const subjects = result.paper_details.subject;
                const options = result.paper_details.options;
                const correctAnswers = result.paper_details.correct_answer;

                subjects.forEach((subject, index) => {
                    if (!subjectStats[subject]) {
                        subjectStats[subject] = { correct: 0, total: 0 };
                    }
                    subjectStats[subject].total += 1;

                    const userAnswer = result.answers[index.toString()];
                    const correctKey = correctAnswers[index];
                    const correctValue = getCorrectOptionValue(options[index], correctKey);

                    if (userAnswer === correctValue) {
                        subjectStats[subject].correct += 1;
                    }
                });
            }
        });

        // Difficulty-wise analytics
        const difficultyStats = {};
        results.forEach(result => {
            if (result.paper_details && result.paper_details.difficulty) {
                const difficulties = result.paper_details.difficulty;
                const options = result.paper_details.options;
                const correctAnswers = result.paper_details.correct_answer;

                difficulties.forEach((difficulty, index) => {
                    if (!difficultyStats[difficulty]) {
                        difficultyStats[difficulty] = { correct: 0, total: 0 };
                    }
                    difficultyStats[difficulty].total += 1;

                    const userAnswer = result.answers[index.toString()];
                    const correctKey = correctAnswers[index];
                    const correctValue = getCorrectOptionValue(options[index], correctKey);

                    if (userAnswer === correctValue) {
                        difficultyStats[difficulty].correct += 1;
                    }
                });
            }
        });

        // Progress over time
        const progressData = results
            .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
            .map((result, index) => {
                const score = calculateCorrectScore(result);
                return {
                    test: `Test ${index + 1}`,
                    score: score.percentage
                };
            });

        setAnalytics({
            totalTests,
            totalQuestions,
            totalCorrect,
            averagePercentage: Math.round(averagePercentage * 100) / 100,
            averageTime: Math.round(averageTime / 60),
            subjectStats,
            difficultyStats,
            progressData
        });
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 text-lg">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-red-400 text-lg">{error}</p>
                </div>
            </div>
        );
    }

    const COLORS = ['#60A5FA', '#A855F7', '#EC4899', '#F59E0B', '#10B981'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-6 backdrop-blur-sm">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-300 font-medium">Performance Insights</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-4">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                            Analytics Dashboard
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg">Track your progress and identify areas for improvement</p>
                </div>

                {testResults.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-800/50 rounded-full mb-6 border border-gray-700/50">
                            <TrendingUp className="w-12 h-12 text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-400 mb-4">No Analytics Yet</h3>
                        <p className="text-gray-500 mb-8">Take your first test to see your performance insights</p>
                        <button
                            onClick={() => alert("Navigate to past papers")}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform duration-300 shadow-lg shadow-blue-500/30"
                        >
                            Start Your First Test
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                            <StatCard 
                                icon={Award} 
                                title="Tests Taken" 
                                value={analytics.totalTests}
                                color="from-blue-500/20 to-blue-600/20"
                                delay={0}
                            />
                            <StatCard 
                                icon={Target} 
                                title="Total Correct" 
                                value={analytics.totalCorrect}
                                color="from-green-500/20 to-green-600/20"
                                delay={100}
                            />
                            <StatCard 
                                icon={TrendingUp} 
                                title="Average Score" 
                                value={`${analytics.averagePercentage}%`}
                                color="from-purple-500/20 to-purple-600/20"
                                delay={200}
                            />
                            <StatCard 
                                icon={Brain} 
                                title="Total Questions" 
                                value={analytics.totalQuestions}
                                color="from-pink-500/20 to-pink-600/20"
                                delay={300}
                            />
                            <StatCard 
                                icon={Clock} 
                                title="Avg Time" 
                                value={`${analytics.averageTime}m`}
                                color="from-orange-500/20 to-orange-600/20"
                                delay={400}
                            />
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                            {/* Progress Chart */}
                            {analytics.progressData && analytics.progressData.length > 0 && (
                                <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-blue-400" />
                                        Progress Over Time
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={analytics.progressData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="test" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#1F2937', 
                                                    border: '1px solid #374151',
                                                    borderRadius: '12px',
                                                    color: '#fff'
                                                }} 
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="score" 
                                                stroke="#60A5FA" 
                                                strokeWidth={3}
                                                dot={{ fill: '#60A5FA', r: 5 }}
                                                activeDot={{ r: 7 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Subject Performance */}
                            {analytics.subjectStats && Object.keys(analytics.subjectStats).length > 0 && (
                                <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-purple-400" />
                                        Subject Performance
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={Object.entries(analytics.subjectStats).map(([name, stats]) => ({
                                            name,
                                            percentage: Math.round((stats.correct / stats.total) * 100)
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="name" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#1F2937', 
                                                    border: '1px solid #374151',
                                                    borderRadius: '12px',
                                                    color: '#fff'
                                                }} 
                                            />
                                            <Bar dataKey="percentage" fill="#A855F7" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Difficulty Distribution */}
                        {analytics.difficultyStats && Object.keys(analytics.difficultyStats).length > 0 && (
                            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50 mb-12">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-yellow-400" />
                                    Difficulty Breakdown
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {Object.entries(analytics.difficultyStats).map(([difficulty, stats]) => {
                                        const percentage = Math.round((stats.correct / stats.total) * 100);
                                        return (
                                            <div key={difficulty} className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/50">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="font-bold text-white capitalize text-lg">{difficulty}</h4>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                                                        difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {percentage}%
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm text-gray-400">
                                                        <span>Correct: {stats.correct}</span>
                                                        <span>Total: {stats.total}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                                difficulty === 'easy' ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                                difficulty === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                                'bg-gradient-to-r from-red-500 to-red-400'
                                                            }`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Recent Tests */}
                        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-400" />
                                Recent Tests
                            </h3>
                            <div className="space-y-4">
                                {testResults
                                    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
                                    .slice(0, 10)
                                    .map((test, index) => {
                                        const score = calculateCorrectScore(test);
                                        return (
                                            <div 
                                                key={index}
                                                className="group relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                                                onClick={() => setSelectedTest(test)}
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold text-blue-300">
                                                                Test #{testResults.length - index}
                                                            </span>
                                                            <span className="text-gray-400 text-sm">
                                                                {formatDate(test.completed_at)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                <Target className="w-4 h-4" />
                                                                {score.score}/{score.total} Questions
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-4 h-4" />
                                                                {formatTime(test.time_spent || 0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className={`text-3xl font-black ${
                                                                score.percentage >= 80 ? 'text-green-400' :
                                                                score.percentage >= 60 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>
                                                                {score.percentage}%
                                                            </div>
                                                            <div className="text-xs text-gray-500">Score</div>
                                                        </div>
                                                        <button className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-colors duration-200 group-hover:scale-110">
                                                            <ChevronRight className="w-5 h-5 text-blue-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="mt-4 w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${
                                                            score.percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                            score.percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                            'bg-gradient-to-r from-red-500 to-red-400'
                                                        }`}
                                                        style={{ width: `${score.percentage}%` }}
                                                    ></div>
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
                <TestDetailsModal 
                    test={selectedTest} 
                    onClose={() => setSelectedTest(null)} 
                />
            )}
        </div>
    );
}
