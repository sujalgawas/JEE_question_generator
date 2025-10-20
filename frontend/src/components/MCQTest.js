// MCQTest.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Circle,
  AlertCircle,
  BookOpen,
  Grid3x3,
  X,
  Flag,
  Send,
  Timer,
  Target
} from 'lucide-react';
import API_URL from '../apiConfig';

// Helper function to convert options object to array
const convertOptionsToArray = (optionsObj) => {
  if (!optionsObj || typeof optionsObj !== 'object') return [];
  return Object.keys(optionsObj)
    .sort()
    .map(key => optionsObj[key]);
};

// Question Palette Modal Component
const QuestionPalette = ({ questions, answers, currentIndex, onSelect, onClose, flagged }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700/50 shadow-2xl">
      <div className="sticky top-0 bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl p-6 border-b border-gray-700/50 z-10">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Question Palette
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-xl transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-400 hover:text-white" />
          </button>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 bg-green-500/20 border-2 border-green-500 rounded-lg"></div>
            <span className="text-gray-400">Answered</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 bg-blue-500/20 border-2 border-blue-500 rounded-lg"></div>
            <span className="text-gray-400">Current</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 bg-orange-500/20 border-2 border-orange-500 rounded-lg"></div>
            <span className="text-gray-400">Flagged</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 bg-gray-700/50 border-2 border-gray-600 rounded-lg"></div>
            <span className="text-gray-400">Not Visited</span>
          </div>
        </div>
      </div>
      
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {questions.map((_, index) => {
            const isAnswered = answers[index] !== undefined;
            const isCurrent = index === currentIndex;
            const isFlagged = flagged[index];
            
            return (
              <button
                key={index}
                onClick={() => {
                  onSelect(index);
                  onClose();
                }}
                className={`relative aspect-square rounded-xl font-bold text-sm transition-all duration-300 hover:scale-110 ${
                  isCurrent
                    ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/30'
                    : isAnswered
                    ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                    : isFlagged
                    ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-400'
                    : 'bg-gray-700/50 border-2 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                {index + 1}
                {isFlagged && (
                  <Flag className="absolute -top-1 -right-1 w-3 h-3 text-orange-400 fill-orange-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

// Instructions Modal Component
const InstructionsModal = ({ questions, onStart }) => (
  <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center p-4 z-50">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
    </div>

    <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-3xl max-w-2xl w-full p-8 border border-gray-700/50 shadow-2xl animate-in zoom-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-blue-500/30 mb-4">
          <BookOpen className="w-10 h-10 text-blue-400" />
        </div>
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
          Test Instructions
        </h2>
        <p className="text-gray-400">Please read carefully before starting</p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-1">Total Questions</h4>
            <p className="text-gray-400 text-sm">{questions.length} multiple choice questions</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Timer className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-1">Time Limit</h4>
            <p className="text-gray-400 text-sm">90 minutes - Test will auto-submit when time runs out</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-1">Navigation</h4>
            <p className="text-gray-400 text-sm">Navigate freely between questions - your answers are auto-saved</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Flag className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-1">Mark for Review</h4>
            <p className="text-gray-400 text-sm">Flag questions you want to revisit later</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 text-sm">
              Ensure you have a stable internet connection throughout the test
            </p>
          </div>
        </div>
      </div>

      <button 
        onClick={onStart}
        className="group relative w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-blue-500/30"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:to-purple-500/20 rounded-xl blur-xl transition-all duration-300"></div>
        <span className="relative z-10">Start Test</span>
        <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
      </button>
    </div>
  </div>
);

export default function MCQTest() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  
  const [paper, setPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(90 * 60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testStarted, setTestStarted] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Timer effect
  useEffect(() => {
    if (testStarted && timeLeft > 0 && !testSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmitTest();
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

    fetch(`${API_URL}/get-paper-for-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, paperId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.paper) {
        setPaper(data.paper);
        const questionsArray = data.paper.question_number?.map((qNum, index) => ({
          questionNumber: qNum,
          questionText: data.paper.question_text?.[index] || '',
          options: convertOptionsToArray(data.paper.options?.[index]),
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

  const handleToggleFlag = () => {
    setFlagged(prev => ({
      ...prev,
      [currentQuestionIndex]: !prev[currentQuestionIndex]
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
      const response = await fetch(`${API_URL}/submit-test-result`, {
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
        navigate('/analytics');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!testStarted) {
    return <InstructionsModal questions={questions} onStart={startTest} />;
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg">No questions found in this paper.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.keys(flagged).filter(key => flagged[key]).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-gray-900/95 to-slate-900/95 backdrop-blur-xl border-b border-gray-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Question Info */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <h3 className="text-lg font-bold text-white">Question {currentQuestionIndex + 1}</h3>
                <p className="text-xs text-gray-400">of {questions.length}</p>
              </div>
              <div className="sm:hidden">
                <p className="text-sm font-bold text-white">{currentQuestionIndex + 1} / {questions.length}</p>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-700/50">
              <Clock className={`w-5 h-5 ${timeLeft < 600 ? 'text-red-400' : 'text-green-400'}`} />
              <span className={`font-mono font-bold ${timeLeft < 600 ? 'text-red-400' : 'text-green-400'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="mt-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-400">{answeredCount} Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400">{flaggedCount} Flagged</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">{questions.length - answeredCount} Remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 pb-32 relative z-10">
        {/* Question Card */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-6 shadow-xl">
          {/* Question Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-300">
                  Q{currentQuestion.questionNumber}
                </span>
                {currentQuestion.subject && (
                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300">
                    {currentQuestion.subject}
                  </span>
                )}
                {currentQuestion.difficulty && (
                  <span className={`px-3 py-1 rounded-lg text-xs ${
                    currentQuestion.difficulty === 'easy' 
                      ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                      : currentQuestion.difficulty === 'medium'
                      ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300'
                      : 'bg-red-500/20 border border-red-500/30 text-red-300'
                  }`}>
                    {currentQuestion.difficulty}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-white leading-relaxed">
                {currentQuestion.questionText}
              </h2>
            </div>
            <button
              onClick={handleToggleFlag}
              className={`p-3 rounded-xl transition-all duration-300 ${
                flagged[currentQuestionIndex]
                  ? 'bg-orange-500/20 border-2 border-orange-500'
                  : 'bg-gray-700/50 border-2 border-gray-600 hover:border-orange-500/50'
              }`}
            >
              <Flag className={`w-5 h-5 ${flagged[currentQuestionIndex] ? 'text-orange-400 fill-orange-400' : 'text-gray-400'}`} />
            </button>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              currentQuestion.options.map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index);
                const isSelected = answers[currentQuestionIndex] === option;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    className={`group w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                        : 'border-gray-700/50 bg-gray-800/40 hover:border-blue-500/50 hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700/50 text-gray-400 group-hover:bg-blue-500/20 group-hover:text-blue-400'
                      }`}>
                        {optionLabel}
                      </div>
                      <span className={`text-base ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-red-400 text-center py-8">No options available for this question</div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-gray-900/95 to-slate-900/95 backdrop-blur-xl border-t border-gray-700/50 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Previous Button */}
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/60 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-300 border border-gray-700/50"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Middle Actions */}
            <div className="flex items-center gap-2">
              {/* Question Palette Button */}
              <button
                onClick={() => setShowPalette(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-all duration-300 border border-purple-500/30"
              >
                <Grid3x3 className="w-5 h-5 text-purple-400" />
                <span className="hidden sm:inline text-purple-400 font-semibold">Palette</span>
              </button>

              {/* Submit Button (show on last question or always on mobile) */}
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl transition-all duration-300 shadow-lg shadow-green-500/30 font-bold"
              >
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline">Submit</span>
              </button>
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex === questions.length - 1}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Question Palette Modal */}
      {showPalette && (
        <QuestionPalette
          questions={questions}
          answers={answers}
          currentIndex={currentQuestionIndex}
          onSelect={handleQuestionNavigation}
          onClose={() => setShowPalette(false)}
          flagged={flagged}
        />
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-md w-full p-8 border border-gray-700/50 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-2xl border border-yellow-500/30 mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Submit Test?</h3>
              <p className="text-gray-400">Are you sure you want to submit your test?</p>
            </div>

            <div className="space-y-3 mb-6 p-4 bg-gray-800/40 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Questions:</span>
                <span className="text-white font-semibold">{questions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Answered:</span>
                <span className="text-green-400 font-semibold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Unanswered:</span>
                <span className="text-red-400 font-semibold">{questions.length - answeredCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Time Spent:</span>
                <span className="text-white font-semibold">{formatTime((90 * 60) - timeLeft)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTest}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl transition-all duration-300 shadow-lg shadow-green-500/30 font-bold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
