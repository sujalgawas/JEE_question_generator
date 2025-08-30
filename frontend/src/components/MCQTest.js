// MCQTest.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Helper function to convert options object to array
const convertOptionsToArray = (optionsObj) => {
    if (!optionsObj || typeof optionsObj !== 'object') return [];
    
    // Convert object like {A: "CH", B: "C2H2", C: "C2H6", D: "C2H4"} 
    // to array ["CH", "C2H2", "C2H6", "C2H4"]
    return Object.keys(optionsObj)
        .sort() // Ensure consistent order (A, B, C, D)
        .map(key => optionsObj[key]);
};

export default function MCQTest() {
    const { paperId } = useParams();
    const navigate = useNavigate();
    
    const [paper, setPaper] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(90 * 60); // 90 minutes in seconds
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [testStarted, setTestStarted] = useState(false);
    const [testSubmitted, setTestSubmitted] = useState(false);

    // Timer effect
    useEffect(() => {
        if (testStarted && timeLeft > 0 && !testSubmitted) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleSubmitTest(); // Auto-submit when time runs out
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [testStarted, timeLeft, testSubmitted]);

    // Fetch paper data
    useEffect(() => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        if (!token || !userName) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        if (!paperId) {
            setError('No paper ID provided');
            setLoading(false);
            return;
        }

        fetch("http://localhost:5000/get-paper-for-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, paperId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.paper) {
                setPaper(data.paper);
                // Convert paper data to questions array
                const questionsArray = data.paper.question_number?.map((qNum, index) => ({
                    questionNumber: qNum,
                    questionText: data.paper.question_text?.[index] || '',
                    options: convertOptionsToArray(data.paper.options?.[index]), // Convert object to array
                    correctAnswer: data.paper.correct_answer?.[index] || '',
                    concept: data.paper.concept?.[index] || '',
                    difficulty: data.paper.difficulty?.[index] || '',
                    explanation: data.paper.explanation?.[index] || '',
                    subject: data.paper.subject?.[index] || '',
                    weightage: data.paper.weightage?.[index] || 1
                })) || [];
                
                setQuestions(questionsArray);
            } else {
                setError(data.error || 'Paper not found');
            }
            setLoading(false);
        })
        .catch(err => {
            setError('Failed to fetch paper');
            setLoading(false);
        });
    }, [paperId]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerSelect = (answer) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: answer
        }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleQuestionNavigation = (index) => {
        setCurrentQuestionIndex(index);
    };

    const handleSubmitTest = async () => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        const testResult = {
            paperId,
            answers,
            timeSpent: (90 * 60) - timeLeft,
            completedAt: new Date().toISOString(),
            totalQuestions: questions.length
        };

        try {
            const response = await fetch("https://jee-question-generator.onrender.com/submit-test-result", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token, 
                    userName, 
                    testResult 
                })
            });

            const data = await response.json();
            if (data.success) {
                setTestSubmitted(true);
                alert('Test submitted successfully!');
                navigate('/test-results', { state: { resultId: data.resultId } });
            } else {
                alert('Error submitting test: ' + data.error);
            }
        } catch (err) {
            alert('Failed to submit test');
        }
    };

    const startTest = () => {
        setTestStarted(true);
    };

    if (loading) return <div className="p-8 text-center text-white">Loading test...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    if (!testStarted) {
        return (
            <div className="p-8 text-center text-white">
                <h1 className="mb-6 text-3xl font-bold">MCQ Test</h1>
                <div className="bg-gray-800 rounded p-6 mb-6">
                    <h2 className="text-xl mb-4">Test Instructions</h2>
                    <ul className="text-left mb-4 space-y-2">
                        <li>• Total Questions: {questions.length}</li>
                        <li>• Time Limit: 90 minutes</li>
                        <li>• You can navigate between questions</li>
                        <li>• Test will auto-submit when time runs out</li>
                        <li>• Make sure you have a stable internet connection</li>
                    </ul>
                </div>
                <button 
                    onClick={startTest}
                    className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded text-white font-bold"
                >
                    Start Test
                </button>
            </div>
        );
    }

    if (questions.length === 0) {
        return <div className="p-8 text-center text-white">No questions found in this paper.</div>;
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="p-6 text-white min-h-screen">
            {/* Header with timer and navigation */}
            <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded">
                <div>
                    <h1 className="text-xl font-bold">MCQ Test</h1>
                    <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>
                <div className="text-center">
                    <div className={`text-2xl font-bold ${timeLeft < 600 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <p className="text-sm">Time Remaining</p>
                </div>
            </div>

            {/* Question Navigation */}
            <div className="mb-6 bg-gray-800 p-4 rounded">
                <div className="grid grid-cols-10 gap-2">
                    {questions.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => handleQuestionNavigation(index)}
                            className={`w-10 h-10 rounded text-sm font-bold ${
                                index === currentQuestionIndex 
                                    ? 'bg-blue-600 text-white' 
                                    : answers[index] 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-gray-600 text-white hover:bg-gray-500'
                            }`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* Current Question */}
            <div className="bg-gray-800 p-6 rounded mb-6">
                <h2 className="text-xl font-bold mb-4">
                    Q{currentQuestion.questionNumber}: {currentQuestion.questionText}
                </h2>
                
                <div className="space-y-3">
                    {currentQuestion.options && currentQuestion.options.length > 0 ? (
                        currentQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAnswerSelect(option)}
                                className={`w-full text-left p-4 rounded border-2 transition-colors ${
                                    answers[currentQuestionIndex] === option
                                        ? 'border-blue-500 bg-blue-600 text-white'
                                        : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                                }`}
                            >
                                <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
                                {option}
                            </button>
                        ))
                    ) : (
                        <div className="text-red-400">No options available for this question</div>
                    )}
                </div>

                {/* Question metadata */}
                <div className="mt-4 text-sm text-gray-400 flex gap-4">
                    {currentQuestion.subject && <span>Subject: {currentQuestion.subject}</span>}
                    {currentQuestion.difficulty && <span>Difficulty: {currentQuestion.difficulty}</span>}
                    {currentQuestion.concept && <span>Concept: {currentQuestion.concept}</span>}
                </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center">
                <button
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>

                <div className="space-x-4">
                    {currentQuestionIndex === questions.length - 1 ? (
                        <button
                            onClick={handleSubmitTest}
                            className="px-8 py-2 bg-green-600 hover:bg-green-700 rounded font-bold"
                        >
                            Submit Test
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>

            {/* Progress indicator */}
            <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress</span>
                    <span>{Object.keys(answers).length} / {questions.length} answered</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
