// Analytics.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper function to convert options object to array (same as MCQTest)
const convertOptionsToArray = (optionsObj) => {
    if (!optionsObj || typeof optionsObj !== 'object') return [];
    return Object.keys(optionsObj)
        .sort()
        .map(key => optionsObj[key]);
};

// Helper function to get correct option value from key
const getCorrectOptionValue = (optionsObj, correctKey) => {
    if (!optionsObj || !correctKey) return null;
    return optionsObj[correctKey];
};

// Helper function to calculate correct score for a test result
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

        if (!token || !userName) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        fetch("https://jee-question-generator.onrender.com/get-user-analytics", {
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

        // Calculate total questions and total correct manually
        results.forEach(result => {
            if (result.paper_details && result.paper_details.question_number) {
                const questionCount = result.paper_details.question_number.length;
                totalQuestions += questionCount;

                // Calculate correct answers for this test
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

        // Calculate average percentage from our manually calculated totals
        const averagePercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
        const averageTime = results.reduce((sum, result) => sum + (result.time_spent || 0), 0) / totalTests;

        // Subject-wise analytics (keep existing logic)
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

                    // Check if user got this question correct
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

        setAnalytics({
            totalTests,
            totalQuestions,
            totalCorrect,
            averagePercentage: Math.round(averagePercentage * 100) / 100,
            averageTime: Math.round(averageTime / 60), // Convert to minutes
            subjectStats,
            difficultyStats
        });
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const viewTestDetails = (result) => {
        setSelectedTest(result);
    };

    const closeTestDetails = () => {
        setSelectedTest(null);
    };

    const renderTestDetails = () => {
        if (!selectedTest || !selectedTest.paper_details) return null;

        const paper = selectedTest.paper_details;
        const userAnswers = selectedTest.answers;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                    <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white">Test Details</h2>
                            <button
                                onClick={closeTestDetails}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {(() => {
                                const calculatedScore = calculateCorrectScore(selectedTest);
                                return (
                                    <>
                                        <div className="text-center">
                                            <div className="text-green-400 font-bold text-lg">{calculatedScore.score}</div>
                                            <div className="text-gray-400">Correct</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-red-400 font-bold text-lg">{calculatedScore.total - calculatedScore.score}</div>
                                            <div className="text-gray-400">Incorrect</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-blue-400 font-bold text-lg">{calculatedScore.percentage}%</div>
                                            <div className="text-gray-400">Score</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-yellow-400 font-bold text-lg">{formatTime(selectedTest.time_spent || 0)}</div>
                                            <div className="text-gray-400">Time</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Question-wise Analysis</h3>
                        <div className="space-y-4">
                            {paper.question_number?.map((qNum, index) => {
                                const userAnswer = userAnswers[index.toString()];
                                const correctKey = paper.correct_answer[index];
                                const correctValue = getCorrectOptionValue(paper.options[index], correctKey);
                                const isCorrect = userAnswer === correctValue;
                                const options = convertOptionsToArray(paper.options[index]);

                                return (
                                    <div key={index} className={`p-4 rounded border-l-4 ${isCorrect ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-white">Q{qNum}: {paper.question_text[index]}</h4>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                                }`}>
                                                {isCorrect ? 'CORRECT' : 'INCORRECT'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-300 mb-2"><strong>Your Answer:</strong></p>
                                                <p className={`p-2 rounded ${isCorrect ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
                                                    }`}>
                                                    {userAnswer || 'Not answered'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-300 mb-2"><strong>Correct Answer:</strong></p>
                                                <p className="p-2 rounded bg-green-600 text-white">
                                                    {correctValue} ({correctKey})
                                                </p>
                                            </div>
                                        </div>

                                        {paper.explanation && paper.explanation[index] && (
                                            <div className="mt-3 p-3 bg-gray-700 rounded">
                                                <p className="text-gray-300 text-sm"><strong>Explanation:</strong></p>
                                                <p className="text-gray-100 text-sm mt-1">{paper.explanation[index]}</p>
                                            </div>
                                        )}

                                        <div className="mt-2 flex gap-4 text-xs text-gray-400">
                                            {paper.subject && paper.subject[index] && (
                                                <span>Subject: {paper.subject[index]}</span>
                                            )}
                                            {paper.difficulty && paper.difficulty[index] && (
                                                <span>Difficulty: {paper.difficulty[index]}</span>
                                            )}
                                            {paper.concept && paper.concept[index] && (
                                                <span>Concept: {paper.concept[index]}</span>
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

    // Rest of the component remains the same...
    if (loading) return <div className="p-8 text-center text-white">Loading analytics...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    return (
        <div className="p-6 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6">Test Analytics</h1>

            {testResults.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 text-lg mb-4">No test results found</p>
                    <button
                        onClick={() => navigate('/past-papers')}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-white"
                    >
                        Take Your First Test
                    </button>
                </div>
            ) : (
                <>
                    {/* Overall Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                        <div className="bg-gray-800 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-blue-400">{analytics.totalTests}</div>
                            <div className="text-gray-400">Tests Taken</div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-green-400">{analytics.totalCorrect}</div>
                            <div className="text-gray-400">Total Correct</div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-yellow-400">{analytics.averagePercentage}%</div>
                            <div className="text-gray-400">Avg Score</div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-purple-400">{analytics.totalQuestions}</div>
                            <div className="text-gray-400">Total Questions</div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-orange-400">{analytics.averageTime}m</div>
                            <div className="text-gray-400">Avg Time</div>
                        </div>
                    </div>

                    {/* Subject-wise Performance */}
                    {analytics.subjectStats && Object.keys(analytics.subjectStats).length > 0 && (
                        <div className="bg-gray-800 p-6 rounded-lg mb-8">
                            <h2 className="text-xl font-bold mb-4">Subject-wise Performance</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(analytics.subjectStats).map(([subject, stats]) => (
                                    <div key={subject} className="bg-gray-700 p-4 rounded">
                                        <h3 className="font-bold text-white mb-2">{subject}</h3>
                                        <div className="flex justify-between text-sm text-gray-300">
                                            <span>Correct: {stats.correct}</span>
                                            <span>Total: {stats.total}</span>
                                        </div>
                                        <div className="mt-2 bg-gray-600 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-center mt-1 text-sm text-gray-300">
                                            {Math.round((stats.correct / stats.total) * 100)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Difficulty-wise Performance */}
                    {analytics.difficultyStats && Object.keys(analytics.difficultyStats).length > 0 && (
                        <div className="bg-gray-800 p-6 rounded-lg mb-8">
                            <h2 className="text-xl font-bold mb-4">Difficulty-wise Performance</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(analytics.difficultyStats).map(([difficulty, stats]) => (
                                    <div key={difficulty} className="bg-gray-700 p-4 rounded">
                                        <h3 className="font-bold text-white mb-2 capitalize">{difficulty}</h3>
                                        <div className="flex justify-between text-sm text-gray-300">
                                            <span>Correct: {stats.correct}</span>
                                            <span>Total: {stats.total}</span>
                                        </div>
                                        <div className="mt-2 bg-gray-600 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${difficulty === 'easy' ? 'bg-green-500' :
                                                        difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-center mt-1 text-sm text-gray-300">
                                            {Math.round((stats.correct / stats.total) * 100)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Test Results */}
                    <div className="bg-gray-800 p-6 rounded-lg">
                        <h2 className="text-xl font-bold mb-4">Test History</h2>
                        <div className="space-y-4">
                            {testResults
                                .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
                                .map((result, index) => {
                                    const calculatedScore = calculateCorrectScore(result);
                                    
                                    return (
                                        <div key={result.result_id} className="bg-gray-700 p-4 rounded">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-white">
                                                        Test #{testResults.length - index}
                                                    </h3>
                                                    <p className="text-gray-300 text-sm">
                                                        {formatDate(result.completed_at)}
                                                    </p>
                                                    <div className="flex gap-4 mt-2 text-sm">
                                                        <span className="text-green-400">
                                                            Score: {calculatedScore.score}/{calculatedScore.total} ({calculatedScore.percentage}%)
                                                        </span>
                                                        <span className="text-blue-400">
                                                            Time: {formatTime(result.time_spent || 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 md:mt-0">
                                                    <button
                                                        onClick={() => viewTestDetails(result)}
                                                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm text-white"
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}

            {/* Test Details Modal */}
            {selectedTest && renderTestDetails()}
        </div>
    );
}
