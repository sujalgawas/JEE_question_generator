// PlacementTest.js — MCQ test interface for placement questions
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    Circle,
    AlertCircle,
    BookOpen,
    X,
    Flag,
    Send,
    Timer,
    Target,
    LayoutGrid,
    ArrowRight,
    Award,
    RotateCcw,
    Home,
} from 'lucide-react';

/* ────  helpers  ──── */
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/* ───────────────────────────────────────
   Question Palette Modal
   ─────────────────────────────────────── */
const QuestionPalette = ({ questions, answers, currentIndex, onSelect, onClose, flagged }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="w-full max-w-xl bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
                <h3 className="text-lg font-bold text-white">Question Navigator</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 transition-colors">
                    <X className="w-5 h-5 text-surface-400" />
                </button>
            </div>

            <div className="flex flex-wrap gap-4 px-6 py-3 border-b border-surface-700/50 text-xs text-surface-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success-500" /> Answered</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500" /> Current</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-warning-500" /> Flagged</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-600" /> Unanswered</span>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {questions.map((_, i) => {
                        const answered = answers[i] !== undefined;
                        const current = i === currentIndex;
                        const marked = flagged[i];

                        let cls = 'bg-surface-700/60 text-surface-400 hover:bg-surface-600';
                        if (current) cls = 'bg-purple-500/20 text-purple-400 ring-2 ring-purple-500';
                        else if (answered) cls = 'bg-success-500/15 text-success-400 ring-1 ring-success-500/40';
                        else if (marked) cls = 'bg-warning-500/15 text-warning-400 ring-1 ring-warning-500/40';

                        return (
                            <button
                                key={i}
                                onClick={() => { onSelect(i); onClose(); }}
                                className={`relative aspect-square rounded-lg text-sm font-semibold transition-all duration-150 ${cls}`}
                            >
                                {i + 1}
                                {marked && <Flag className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-warning-500 fill-warning-500" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
);

/* ───────────────────────────────────────
   Instructions Modal
   ─────────────────────────────────────── */
const InstructionsModal = ({ questions, onStart }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950 p-4">
        <div className="w-full max-w-lg bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl animate-slide-up overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-purple-400" />

            <div className="p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4">
                        <BookOpen className="w-7 h-7 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">Placement Test</h2>
                    <p className="text-surface-400 text-sm">Read before you begin</p>
                </div>

                <div className="space-y-3 mb-8">
                    {[
                        { icon: Target, color: 'text-purple-400', label: 'Total Questions', desc: `${questions.length} multiple choice questions` },
                        { icon: Timer, color: 'text-purple-400', label: 'Time Limit', desc: `${questions.length * 2} minutes — auto-submits when done` },
                        { icon: CheckCircle, color: 'text-success-400', label: 'Navigation', desc: 'Move freely — answers are auto-saved' },
                        { icon: Flag, color: 'text-warning-400', label: 'Mark for Review', desc: 'Flag questions to revisit later' },
                    ].map(({ icon: Icon, color, label, desc }) => (
                        <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-surface-700/40">
                            <Icon className={`w-5 h-5 mt-0.5 ${color} shrink-0`} />
                            <div>
                                <p className="text-white text-sm font-medium">{label}</p>
                                <p className="text-surface-400 text-xs">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onStart}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors duration-200"
                >
                    Start Test
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
);

/* ───────────────────────────────────────
   Submit Confirmation Modal
   ─────────────────────────────────────── */
const SubmitConfirmation = ({ questions, answers, totalTime, timeLeft, onSubmit, onCancel }) => {
    const answered = Object.keys(answers).length;
    const unanswered = questions.length - answered;
    const timeSpent = formatTime(totalTime - timeLeft);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl animate-scale-in overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-warning-500 to-warning-400" />

                <div className="p-6">
                    <div className="text-center mb-5">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-warning-500/10 border border-warning-500/20 mb-3">
                            <AlertCircle className="w-6 h-6 text-warning-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Submit Test?</h3>
                        <p className="text-surface-400 text-sm mt-1">This action cannot be undone</p>
                    </div>

                    <div className="space-y-2 p-4 rounded-xl bg-surface-700/40 mb-5 text-sm">
                        <div className="flex justify-between"><span className="text-surface-400">Total</span><span className="text-white font-medium">{questions.length}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Answered</span><span className="text-success-400 font-medium">{answered}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Unanswered</span><span className="text-danger-400 font-medium">{unanswered}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Time Spent</span><span className="text-white font-medium">{timeSpent}</span></div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-surface-300 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={onSubmit} className="flex-1 py-2.5 rounded-xl bg-success-600 hover:bg-success-500 text-white font-semibold transition-colors">
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ───────────────────────────────────────
   Results Screen
   ─────────────────────────────────────── */
const ResultsScreen = ({ questions, answers, totalTime, timeLeft, onGoHome, onRetake }) => {
    const totalQ = questions.length;
    const answeredCount = Object.keys(answers).length;
    let correct = 0;

    questions.forEach((q, i) => {
        if (answers[i] && answers[i] === q.correct_answer) correct++;
    });

    const scorePercent = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    const timeSpent = formatTime(totalTime - timeLeft);

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-purple-400" />
                <div className="p-8">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
                            <Award className="w-8 h-8 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Test Complete!</h2>
                        <p className="text-surface-400 text-sm">Here's how you performed</p>
                    </div>

                    {/* Score circle */}
                    <div className="flex justify-center mb-6">
                        <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center ${scorePercent >= 70 ? 'border-success-500' : scorePercent >= 40 ? 'border-warning-500' : 'border-danger-500'
                            }`}>
                            <div className="text-center">
                                <p className="text-3xl font-black text-white">{scorePercent}%</p>
                                <p className="text-xs text-surface-400">{correct}/{totalQ}</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 p-4 rounded-xl bg-surface-700/40 mb-6 text-sm">
                        <div className="flex justify-between"><span className="text-surface-400">Correct</span><span className="text-success-400 font-medium">{correct}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Incorrect</span><span className="text-danger-400 font-medium">{answeredCount - correct}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Unanswered</span><span className="text-surface-300 font-medium">{totalQ - answeredCount}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Time Spent</span><span className="text-white font-medium">{timeSpent}</span></div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onGoHome}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 text-surface-300 font-medium transition-colors"
                        >
                            <Home className="w-4 h-4" /> Dashboard
                        </button>
                        <button
                            onClick={onRetake}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" /> New Test
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════
   Main PlacementTest Component
   ═══════════════════════════════════════ */
export default function PlacementTest() {
    const navigate = useNavigate();

    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState({});
    const [totalTime, setTotalTime] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [testStarted, setTestStarted] = useState(false);
    const [testSubmitted, setTestSubmitted] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    /* ── load paper from sessionStorage ── */
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('placementPaper');
            if (!raw) { setError('No paper data found. Please generate a test first.'); setLoading(false); return; }

            const paperData = JSON.parse(raw);

            // Build question array from paper_data format
            const qArr = (paperData.question_number || []).map((qNum, idx) => ({
                question_number: qNum,
                question_text: paperData.question_text?.[idx] || '',
                options: paperData.option?.[idx] || [],
                correct_answer: paperData.correct_answer?.[idx] || '',
                explanation: paperData.explanation?.[idx] || '',
                topic: paperData.topic?.[idx] || '',
            }));

            if (qArr.length === 0) { setError('No questions in the paper.'); setLoading(false); return; }

            setQuestions(qArr);
            const time = qArr.length * 2 * 60; // 2 min per question
            setTotalTime(time);
            setTimeLeft(time);
            setLoading(false);
        } catch {
            setError('Failed to load paper data.');
            setLoading(false);
        }
    }, []);

    /* ── timer ── */
    useEffect(() => {
        if (testStarted && timeLeft > 0 && !testSubmitted) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) { handleSubmitTest(); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [testStarted, timeLeft, testSubmitted]);

    /* ── handlers ── */
    const handleAnswerSelect = (answer) => setAnswers((p) => ({ ...p, [currentQuestionIndex]: answer }));
    const handleToggleFlag = () => setFlagged((p) => ({ ...p, [currentQuestionIndex]: !p[currentQuestionIndex] }));
    const handleNext = () => { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex((i) => i + 1); };
    const handlePrev = () => { if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1); };

    const handleSubmitTest = () => {
        setTestSubmitted(true);

        // Save to localStorage for placement history
        try {
            const history = JSON.parse(localStorage.getItem('placementHistory') || '[]');
            const totalQ = questions.length;
            let correct = 0;
            questions.forEach((q, i) => {
                if (answers[i] && answers[i] === q.correct_answer) correct++;
            });

            history.unshift({
                id: Date.now().toString(),
                date: new Date().toISOString(),
                topic: questions[0]?.topic || 'Mixed',
                questionCount: totalQ,
                score: correct,
                timeSpent: totalTime - timeLeft,
                questions,
                answers,
            });

            // Keep only last 20
            if (history.length > 20) history.pop();
            localStorage.setItem('placementHistory', JSON.stringify(history));
        } catch { /* ignore localStorage errors */ }
    };

    /* ── loading / error states ── */
    if (loading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-surface-400">Loading test…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
                <div className="text-center">
                    <AlertCircle className="w-10 h-10 text-danger-400 mx-auto mb-3" />
                    <p className="text-danger-400 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/placement')}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
                    >
                        Generate New Test
                    </button>
                </div>
            </div>
        );
    }

    if (testSubmitted) {
        return (
            <ResultsScreen
                questions={questions}
                answers={answers}
                totalTime={totalTime}
                timeLeft={timeLeft}
                onGoHome={() => navigate('/dashboard')}
                onRetake={() => navigate('/placement')}
            />
        );
    }

    if (!testStarted) return <InstructionsModal questions={questions} onStart={() => setTestStarted(true)} />;

    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <p className="text-surface-400">No questions found.</p>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const flaggedCount = Object.keys(flagged).filter((k) => flagged[k]).length;
    const progress = Math.round((answeredCount / questions.length) * 100);
    const isLowTime = timeLeft < 120;

    /* ═════════  RENDER  ═════════ */
    return (
        <div className="min-h-screen bg-surface-900 text-white flex flex-col">
            {/* ── STICKY HEADER ── */}
            <header className="sticky top-0 z-40 bg-surface-800/95 backdrop-blur-md border-b border-surface-700/60">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-white">
                                Question {currentQuestionIndex + 1}
                                <span className="text-surface-500 font-normal"> / {questions.length}</span>
                            </span>
                            {currentQuestion.topic && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium">
                                    {currentQuestion.topic}
                                </span>
                            )}
                        </div>

                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold ${isLowTime ? 'bg-danger-500/10 text-danger-400' : 'bg-surface-700/60 text-surface-300'
                            }`}>
                            <Clock className="w-4 h-4" />
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-surface-400 shrink-0">
                            <span className="flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-success-400" />
                                {answeredCount}
                            </span>
                            <span className="flex items-center gap-1">
                                <Flag className="w-3.5 h-3.5 text-warning-400" />
                                {flaggedCount}
                            </span>
                            <span className="flex items-center gap-1">
                                <Circle className="w-3.5 h-3.5 text-surface-500" />
                                {questions.length - answeredCount}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28">
                <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 animate-fade-in" key={currentQuestionIndex}>
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-semibold">
                                    Q{currentQuestion.question_number}
                                </span>
                                {currentQuestion.topic && (
                                    <span className="px-2.5 py-1 rounded-md bg-surface-700 text-surface-300 text-xs">
                                        {currentQuestion.topic}
                                    </span>
                                )}
                            </div>

                            <h2 className="text-lg font-medium text-white leading-relaxed">
                                {currentQuestion.question_text}
                            </h2>
                        </div>

                        <button
                            onClick={handleToggleFlag}
                            className={`ml-4 p-2.5 rounded-lg transition-colors duration-150 shrink-0 ${flagged[currentQuestionIndex]
                                    ? 'bg-warning-500/15 text-warning-400'
                                    : 'bg-surface-700/50 text-surface-500 hover:text-warning-400 hover:bg-warning-500/10'
                                }`}
                            title={flagged[currentQuestionIndex] ? 'Remove flag' : 'Flag for review'}
                        >
                            <Flag className={`w-4 h-4 ${flagged[currentQuestionIndex] ? 'fill-warning-400' : ''}`} />
                        </button>
                    </div>

                    {/* options */}
                    <div className="space-y-2.5">
                        {currentQuestion.options?.length > 0 ? (
                            currentQuestion.options.map((option, idx) => {
                                const label = String.fromCharCode(65 + idx);
                                const selected = answers[currentQuestionIndex] === option;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswerSelect(option)}
                                        className={`group w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-all duration-150 ${selected
                                                ? 'border-purple-500 bg-purple-500/10'
                                                : 'border-surface-700 bg-surface-700/30 hover:border-surface-600 hover:bg-surface-700/50'
                                            }`}
                                    >
                                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-150 ${selected
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-surface-700 text-surface-400 group-hover:bg-surface-600'
                                            }`}>
                                            {label}
                                        </div>
                                        <span className={`text-sm leading-relaxed ${selected ? 'text-white' : 'text-surface-300'}`}>
                                            {option}
                                        </span>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-danger-400 text-sm">No options available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── BOTTOM NAVIGATION BAR ── */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-800/95 backdrop-blur-md border-t border-surface-700/60">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <button
                        onClick={handlePrev}
                        disabled={currentQuestionIndex === 0}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-surface-300 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Previous</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowPalette(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-sm font-medium text-surface-300 transition-colors"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="hidden sm:inline">All Questions</span>
                        </button>

                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-success-600 hover:bg-success-500 text-sm font-semibold text-white transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            <span className="hidden sm:inline">Submit</span>
                        </button>
                    </div>

                    <button
                        onClick={handleNext}
                        disabled={currentQuestionIndex === questions.length - 1}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── MODALS ── */}
            {showPalette && (
                <QuestionPalette
                    questions={questions}
                    answers={answers}
                    currentIndex={currentQuestionIndex}
                    onSelect={(i) => setCurrentQuestionIndex(i)}
                    onClose={() => setShowPalette(false)}
                    flagged={flagged}
                />
            )}

            {showSubmitConfirm && (
                <SubmitConfirmation
                    questions={questions}
                    answers={answers}
                    totalTime={totalTime}
                    timeLeft={timeLeft}
                    onSubmit={handleSubmitTest}
                    onCancel={() => setShowSubmitConfirm(false)}
                />
            )}
        </div>
    );
}
