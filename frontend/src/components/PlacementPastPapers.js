// PlacementPastPapers.js — Placement test history from localStorage
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText,
    Trash2,
    Clock,
    Target,
    AlertCircle,
    CheckCircle,
    Award,
    BrainCircuit,
    RotateCcw,
} from 'lucide-react';

export default function PlacementPastPapers() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [deleteSuccess, setDeleteSuccess] = useState('');

    useEffect(() => {
        try {
            const raw = localStorage.getItem('placementHistory');
            if (raw) setHistory(JSON.parse(raw));
        } catch { /* ignore */ }
    }, []);

    const handleDelete = (id) => {
        if (!window.confirm('Delete this test result? This cannot be undone.')) return;
        const updated = history.filter((h) => h.id !== id);
        setHistory(updated);
        localStorage.setItem('placementHistory', JSON.stringify(updated));
        setDeleteSuccess('Test result deleted');
        setTimeout(() => setDeleteSuccess(''), 3000);
    };

    const handleRetake = (item) => {
        // Store the paper data back and navigate to test
        const paperData = {
            question_number: item.questions.map((q) => q.question_number),
            question_text: item.questions.map((q) => q.question_text),
            option: item.questions.map((q) => q.options),
            correct_answer: item.questions.map((q) => q.correct_answer),
            explanation: item.questions.map((q) => q.explanation),
            topic: item.questions.map((q) => q.topic),
        };
        sessionStorage.setItem('placementPaper', JSON.stringify(paperData));
        navigate('/placement-test');
    };

    const formatDate = (iso) => {
        try {
            return new Date(iso).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return iso; }
    };

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    return (
        <div className="min-h-screen bg-surface-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-1">
                        <BrainCircuit className="w-6 h-6 text-purple-400" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Placement History</h1>
                    </div>
                    <p className="text-surface-400 text-sm">Review your past placement test results</p>
                </div>

                {/* alerts */}
                {deleteSuccess && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm animate-fade-in">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {deleteSuccess}
                    </div>
                )}

                {/* list */}
                {history.length === 0 ? (
                    <div className="text-center py-16">
                        <FileText className="w-12 h-12 text-surface-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-surface-400 mb-1">No Tests Yet</h3>
                        <p className="text-surface-500 text-sm mb-4">Take your first placement test to see results here!</p>
                        <button
                            onClick={() => navigate('/placement')}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
                        >
                            Generate Placement Test
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => {
                            const scorePercent = item.questionCount > 0
                                ? Math.round((item.score / item.questionCount) * 100)
                                : 0;

                            return (
                                <div
                                    key={item.id}
                                    className="bg-surface-800 rounded-xl border border-surface-700 p-5 hover:border-surface-600 transition-colors"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* info */}
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg shrink-0 ${scorePercent >= 70
                                                    ? 'bg-success-500/10'
                                                    : scorePercent >= 40
                                                        ? 'bg-warning-500/10'
                                                        : 'bg-danger-500/10'
                                                }`}>
                                                <Award className={`w-5 h-5 ${scorePercent >= 70
                                                        ? 'text-success-400'
                                                        : scorePercent >= 40
                                                            ? 'text-warning-400'
                                                            : 'text-danger-400'
                                                    }`} />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-semibold mb-1">
                                                    {item.topic || 'Mixed Topics'}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatDate(item.date)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Target className="w-3.5 h-3.5" />
                                                        {item.questionCount} Questions
                                                    </span>
                                                    <span className={`flex items-center gap-1 font-semibold ${scorePercent >= 70
                                                            ? 'text-success-400'
                                                            : scorePercent >= 40
                                                                ? 'text-warning-400'
                                                                : 'text-danger-400'
                                                        }`}>
                                                        <Award className="w-3.5 h-3.5" />
                                                        {item.score}/{item.questionCount} ({scorePercent}%)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleRetake(item)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Retake
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 rounded-lg bg-surface-700 hover:bg-danger-500/15 text-surface-500 hover:text-danger-400 transition-colors"
                                                title="Delete result"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
