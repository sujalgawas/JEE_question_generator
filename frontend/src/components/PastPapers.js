import React, { useEffect, useState } from 'react';
import { FileText, Trash2, Clock, Brain, AlertCircle, ChevronRight, CheckCircle } from 'lucide-react';
import API_URL from '../apiConfig';

export default function PastPaper() {
    const [papers, setPapers] = useState([]);
    const [deletedIds, setDeletedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [deleteSuccess, setDeleteSuccess] = useState('');

    useEffect(() => { fetchPapers(); }, []);

    const fetchPapers = () => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');
        if (!token || !userName) { setError('User not authenticated'); setLoading(false); return; }

        fetch(`${API_URL}/retrieve-papers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, name: userName }),
        })
            .then((r) => r.json())
            .then((data) => {
                setPapers(data.papers || []);
                setDeletedIds(new Set(data.deleted_ids || []));
                if (data.error) setError(data.error);
                setLoading(false);
            })
            .catch(() => { setError('Failed to fetch papers'); setLoading(false); });
    };

    const handleDelete = async (paperId) => {
        if (!window.confirm('Delete this paper? This cannot be undone.')) return;
        setDeletingId(paperId);
        setDeleteSuccess('');
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        try {
            const res = await fetch(`${API_URL}/delete-paper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, name: userName, paper_id: paperId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setDeletedIds((prev) => new Set(prev).add(paperId));
                setDeleteSuccess('Paper deleted');
                setTimeout(() => setDeleteSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to delete');
                setTimeout(() => setError(''), 3000);
            }
        } catch {
            setError('Failed to delete paper');
            setTimeout(() => setError(''), 3000);
        } finally {
            setDeletingId(null);
        }
    };

    const handleTakeTest = (paperId) => { window.location.href = `#/mcq-test/${paperId}`; };

    const visiblePapers = papers.filter((p) => !deletedIds.has(p.paper_id));

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-surface-400 text-sm">Loading papers…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* header */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Past Papers</h1>
                    <p className="text-surface-400 text-sm">Review and retake your previous tests</p>
                </div>

                {/* alerts */}
                {deleteSuccess && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm animate-fade-in">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {deleteSuccess}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                {/* papers list */}
                {visiblePapers.length === 0 ? (
                    <div className="text-center py-16">
                        <FileText className="w-12 h-12 text-surface-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-surface-400 mb-1">No Papers Yet</h3>
                        <p className="text-surface-500 text-sm">Generate your first test paper to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visiblePapers.map((paper) => (
                            <div
                                key={paper.paper_id}
                                className="bg-surface-800 rounded-xl border border-surface-700 p-5 hover:border-surface-600 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* info */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-lg bg-accent-500/10 shrink-0">
                                            <FileText className="w-5 h-5 text-accent-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold mb-1">
                                                {paper.title || `Paper ${paper.paper_id.slice(0, 8)}`}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {paper.created_at}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Brain className="w-3.5 h-3.5" />
                                                    {paper.question_number?.length || 0} Questions
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleTakeTest(paper.paper_id)}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
                                        >
                                            Take Test
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(paper.paper_id)}
                                            disabled={deletingId === paper.paper_id}
                                            className="p-2 rounded-lg bg-surface-700 hover:bg-danger-500/15 text-surface-500 hover:text-danger-400 transition-colors disabled:opacity-50"
                                            title="Delete paper"
                                        >
                                            {deletingId === paper.paper_id ? (
                                                <div className="w-4 h-4 border-2 border-danger-400/30 border-t-danger-400 rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}