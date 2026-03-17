// PlacementMCQTest.js — Clean, exam-focused test interface for Placements
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
  X,
  Flag,
  Send,
  Timer,
  Target,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import API_URL from '../apiConfig';

/* ────  helpers  ──── */
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/* ───────────────────────────────────────
   Question Palette Modal
   ─────────────────────────────────────── */
const QuestionPalette = ({ questions, answers, currentIndex, onSelect, onClose, flagged }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div className="w-full max-w-xl bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
        <h3 className="text-lg font-bold text-white">Question Navigator</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 transition-colors">
          <X className="w-5 h-5 text-surface-400" />
        </button>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-4 px-6 py-3 border-b border-surface-700/50 text-xs text-surface-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success-500" /> Answered</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent-500" /> Current</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-warning-500" /> Flagged</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-600" /> Unanswered</span>
      </div>

      {/* grid */}
      <div className="p-6 max-h-[50vh] overflow-y-auto">
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {questions.map((_, i) => {
            const answered = answers[i] !== undefined;
            const current = i === currentIndex;
            const marked = flagged[i];

            let cls = 'bg-surface-700/60 text-surface-400 hover:bg-surface-600';
            if (current) cls = 'bg-accent-500/20 text-accent-400 ring-2 ring-accent-500';
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
const InstructionsModal = ({ questions, onStart }) => {
  const timeLimitMinutes = questions.length * 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950 p-4">
      <div className="w-full max-w-lg bg-surface-800 rounded-2xl border border-surface-700 shadow-2xl animate-slide-up overflow-hidden">
        {/* top accent */}
        <div className="h-1 bg-gradient-to-r from-accent-500 to-accent-400" />

        <div className="p-8">
          {/* icon + title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent-500/10 border border-accent-500/20 mb-4">
              <BookOpen className="w-7 h-7 text-accent-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Placement Test Instructions</h2>
            <p className="text-surface-400 text-sm">Read before you begin</p>
          </div>

          {/* info items */}
          <div className="space-y-3 mb-8">
            {[
              { icon: Target, color: 'text-accent-400', label: 'Total Questions', desc: `${questions.length} multiple choice questions` },
              { icon: Timer, color: 'text-accent-400', label: 'Time Limit', desc: `${timeLimitMinutes} minutes — auto-submits when done` },
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

          {/* warning */}
          <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-warning-500/10 border border-warning-500/20 text-warning-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Ensure you have a stable internet connection throughout the test.</span>
          </div>

          {/* start button */}
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-semibold transition-colors duration-200"
          >
            Start Test
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────
   Submit Confirmation Modal
   ─────────────────────────────────────── */
const SubmitConfirmation = ({ questions, answers, timeLeft, totalTime, onSubmit, onCancel }) => {
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

          {/* stats */}
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

/* ═══════════════════════════════════════
   Main PlacementMCQTest Component
   ═══════════════════════════════════════ */
export default function PlacementMCQTest() {
  const { paperId } = useParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  
  // Changed initial states for dynamic timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0); 
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testStarted, setTestStarted] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

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

  /* ── fetch placement paper ── */
  useEffect(() => {
    const token = localStorage.getItem('idToken');

    if (!token) { setError('User not authenticated'); setLoading(false); return; }
    if (!paperId) { setError('No paper ID provided'); setLoading(false); return; }

    fetch(`${API_URL}/placements_take_test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, paper_id: paperId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.paper) {
          setPaper(data.paper);
          const arr = data.paper.question_number?.map((qNum, idx) => ({
            questionNumber: qNum,
            questionText: data.paper.question_text?.[idx] || '',
            options: data.paper.option?.[idx] || [], // FIXED: Changed 'options' to 'option' and removed converter
            correctAnswer: data.paper.correct_answer?.[idx] || '',
            explanation: data.paper.explanation?.[idx] || '',
            subject: data.paper.topic?.[idx] || '', // FIXED: Mapped to topic
          })) || [];
          
          setQuestions(arr);
          
          // Set dynamic timer based on 2 mins (120 secs) per question
          const timeForTest = arr.length * 120;
          setTimeLeft(timeForTest);
          setTotalTime(timeForTest);

        } else {
          setError(data.message || 'Paper not found');
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to fetch paper'); setLoading(false); });
  }, [paperId]);

  /* ── handlers ── */
  const handleAnswerSelect = (answer) => setAnswers((p) => ({ ...p, [currentQuestionIndex]: answer }));
  const handleToggleFlag = () => setFlagged((p) => ({ ...p, [currentQuestionIndex]: !p[currentQuestionIndex] }));
  const handleNext = () => { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex((i) => i + 1); };
  const handlePrev = () => { if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1); };

  const handleSubmitTest = async () => {
    const token = localStorage.getItem('idToken');
    const timeSpent = totalTime - timeLeft; // Uses dynamic totalTime now

    const answerArray = questions.map((_, index) => answers[index] || "");

    try {
      const response = await fetch(`${API_URL}/placements_submit_test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          paper_id: paperId,
          answer: answerArray, 
          time: timeSpent
        }),
      });
      const data = await response.json();
      if (response.ok) { 
        setTestSubmitted(true); 
        navigate('/analytics'); 
      } else {
        alert('Error submitting test: ' + (data.message || "Unknown Error"));
      }
    } catch { alert('Failed to submit test'); }
  };

  /* ── loading / error / empty states ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-surface-400">Loading placement test…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-danger-400 mx-auto mb-3" />
          <p className="text-danger-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!testStarted) return <InstructionsModal questions={questions} onStart={() => setTestStarted(true)} />;

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <p className="text-surface-400">No questions found in this placement paper.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.keys(flagged).filter((k) => flagged[k]).length;
  const progress = Math.round((answeredCount / questions.length) * 100);
  const isLowTime = timeLeft < 120; // Warn when under 2 minutes

  /* ═════════  RENDER  ═════════ */
  return (
    <div className="min-h-screen bg-surface-900 text-white flex flex-col">
      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-40 bg-surface-800/95 backdrop-blur-md border-b border-surface-700/60">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* row 1: question counter + timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">
                Question {currentQuestionIndex + 1}
                <span className="text-surface-500 font-normal"> / {questions.length}</span>
              </span>
            </div>

            {/* timer */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold ${isLowTime ? 'bg-danger-500/10 text-danger-400' : 'bg-surface-700/60 text-surface-300'
              }`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* row 2: progress bar + counters */}
          <div className="flex items-center gap-3">
            {/* progress bar */}
            <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* mini stats */}
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
        {/* question card */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 animate-fade-in" key={currentQuestionIndex}>
          {/* meta row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              {/* tags */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-md bg-accent-500/10 text-accent-400 text-xs font-semibold">
                  Q{currentQuestion.questionNumber}
                </span>
                {currentQuestion.subject && (
                  <span className="px-2.5 py-1 rounded-md bg-surface-700 text-surface-300 text-xs">
                    {currentQuestion.subject}
                  </span>
                )}
              </div>

              {/* question text */}
              <h2 className="text-lg font-medium text-white leading-relaxed">
                {currentQuestion.questionText}
              </h2>
            </div>

            {/* flag button */}
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
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-surface-700 bg-surface-700/30 hover:border-surface-600 hover:bg-surface-700/50'
                      }`}
                  >
                    {/* option label circle */}
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-150 ${selected
                        ? 'bg-accent-500 text-white'
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
          {/* prev */}
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-surface-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* center actions */}
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

          {/* next */}
          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
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
          timeLeft={timeLeft}
          totalTime={totalTime}
          onSubmit={handleSubmitTest}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}
    </div>
  );
}