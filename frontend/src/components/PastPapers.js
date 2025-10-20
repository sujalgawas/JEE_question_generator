import React, { useEffect, useState } from 'react';
import { FileText, Trash2, Clock, Brain, AlertCircle, ChevronRight, CheckCircle } from 'lucide-react';
import API_URL from '../apiConfig';

export default function PastPaper() {
    const [papers, setPapers] = useState([]);
    const [deletedIds, setDeletedIds] = useState(new Set()); // <-- NEW: To track deleted IDs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [deleteSuccess, setDeleteSuccess] = useState('');

    useEffect(() => {
        fetchPapers();
    }, []);

    const fetchPapers = () => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        if (!token || !userName) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        fetch(`${API_URL}/retrieve-papers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, name: userName }) // 'name' might be redundant now if using UID
        })
            .then(res => res.json())
            .then(data => {
                // --- MODIFIED ---
                if (data.papers) {
                    setPapers(data.papers);
                } else {
                    setPapers([]); // Ensure it's an array even if null
                }
                
                if (data.deleted_ids) {
                    setDeletedIds(new Set(data.deleted_ids));
                } else {
                    setDeletedIds(new Set());
                }

                if (data.error) {
                    setError(data.error || 'Unexpected error');
                }
                // --- END MODIFIED ---
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to fetch papers');
                setLoading(false);
            });
    };

    const handleDelete = async (paperId) => {
        if (!window.confirm('Are you sure you want to delete this paper? This action cannot be undone.')) {
            return;
        }

        setDeletingId(paperId);
        setDeleteSuccess('');

        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        try {
            const response = await fetch(`${API_URL}/delete-paper`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token, 
                    name: userName, // 'name' might be redundant now
                    paper_id: paperId 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // --- MODIFIED LOGIC ---
                // Instead of filtering the 'papers' array,
                // we add the ID to the 'deletedIds' set.
                // The UI will automatically update because of the filter in the render method.
                setDeletedIds(prevIds => new Set(prevIds).add(paperId));
                // --- END MODIFIED ---

                setDeleteSuccess('Paper deleted successfully!');
                setTimeout(() => setDeleteSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to delete paper');
                setTimeout(() => setError(''), 3000);
            }
        } catch (err) {
            setError('Failed to delete paper');
            setTimeout(() => setError(''), 3000);
        } finally {
            setDeletingId(null);
        }
    };

    const handleTakeTest = (paperId) => {
        // Navigate to test page
        //alert(`Navigating to test: ${paperId}`);
        window.location.href = `#/mcq-test/${paperId}`;
    };

    // --- NEW: Filter papers before rendering ---
    const visiblePapers = papers.filter(paper => !deletedIds.has(paper.paper_id));

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 text-lg">Loading your papers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-6 relative overflow-hidden">
            {/* Floating Orbs Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-6 backdrop-blur-sm">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-300 font-medium">Your Practice History</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-4">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                            Past Papers
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg">Review and retake your previous test papers</p>
                </div>

                {/* Success Message */}
                {deleteSuccess && (
                    <div className="mb-6 bg-gradient-to-r from-green-900/40 to-emerald-900/40 backdrop-blur-sm border border-green-500/30 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <p className="text-green-300">{deleteSuccess}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-gradient-to-r from-red-900/40 to-rose-900/40 backdrop-blur-sm border border-red-500/30 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <p className="text-red-300">{error}</p>
                    </div>
                )}

                {/* Papers List */}
                {/* --- MODIFIED: Check visiblePapers.length --- */}
                {visiblePapers.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-800/50 rounded-full mb-6 border border-gray-700/50">
                            <FileText className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-400 mb-2">No Papers Yet</h3>
                        <p className="text-gray-500">Generate your first test paper to get started!</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {/* --- MODIFIED: Map over visiblePapers --- */}
                        {visiblePapers.map((paper, index) => (
                            <div
                                key={paper.paper_id}
                                className="group relative animate-in slide-in-from-bottom"
                                style={{ animationDelay: `${index * 100}ms`, animationDuration: '500ms' }}
                            >
                                {/* Glow Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                
                                {/* Paper Card */}
                                <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 hover:border-blue-500/50 transition-all duration-300 overflow-hidden">
                                    {/* Accent Bar */}
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        {/* Left Section - Paper Info */}
                                        <div className="flex-1 space-y-4">
                                            {/* Title */}
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                                                    <FileText className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-xl font-bold text-white mb-1">
                                                        {paper.title || `Paper ${paper.paper_id.slice(0, 8)}`}
                                                    </h3>
                                                    <p className="text-sm text-gray-400">ID: {paper.paper_id.slice(0, 16)}...</p>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                                    <Clock className="w-4 h-4 text-blue-400" />
                                                    <span className="text-sm text-gray-300">{paper.created_at}</span>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                                    <Brain className="w-4 h-4 text-purple-400" />
                                                    <span className="text-sm text-gray-300">
                                                        {paper.question_number?.length || 0} Questions
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Section - Actions */}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => handleTakeTest(paper.paper_id)}
                                                className="group/btn flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30"
                                            >
                                                Take Test
                                                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(paper.paper_id)}
                                                disabled={deletingId === paper.paper_id}
                                                className="group/del flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-red-600/20 text-gray-400 hover:text-red-400 font-semibold px-6 py-3 rounded-xl border border-gray-700 hover:border-red-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingId === paper.paper_id ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 className="w-5 h-5 group-hover/del:scale-110 transition-transform duration-300" />
                                                        Delete
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes in {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-in {
                    animation: in 0.5s ease-out forwards;
                    opacity: 0;
                }
                .slide-in-from-bottom {
                    animation: slideInFromBottom 0.5s ease-out forwards;
                }
                .slide-in-from-top {
                    animation: slideInFromTop 0.5s ease-out forwards;
                }
                @keyframes slideInFromBottom {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideInFromTop {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}