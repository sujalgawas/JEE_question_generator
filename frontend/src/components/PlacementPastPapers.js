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
    Loader2
} from 'lucide-react';

// Make sure to define your API_URL here or import it
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; 

export default function PlacementPastPapers() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleteSuccess, setDeleteSuccess] = useState('');

    useEffect(() => {
        const fetchPastPapers = async () => {
            const token = localStorage.getItem('idToken');
            
            if (!token) {
                setError('Authentication token missing. Please log in.');
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_URL}/placement_paper_id`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
            
                const data = await res.json();

                // The API returns { "all papers": ["uuid1", "uuid2"] }
                // Map the string array into an array of objects so we can easily iterate
                if (data['all papers']) {
                    const formattedData = data['all papers'].map((id) => ({ id }));
                    setHistory(formattedData);
                }
            } catch (err) {
                setError('Failed to connect to server. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchPastPapers();
    }, []);

    const handleDelete = (id) => {
        if (!window.confirm('Hide this test result?')) return;
        
        // Note: This only removes it from the UI. 
        // You will likely need another API call here to actually delete it from the database!
        const updated = history.filter((h) => h.id !== id);
        setHistory(updated);
        
        setDeleteSuccess('Test result removed from view');
        setTimeout(() => setDeleteSuccess(''), 3000);
    };

    const handleRetake = (item) => {
        // Since we only have the ID now, store the ID instead of the full question array
        // The '/placement-test' page will need to fetch the paper details using this ID
        sessionStorage.setItem('placementPaperId', item.id);
        navigate('/placement-test');
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
                {error && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}
                
                {deleteSuccess && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm animate-fade-in">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {deleteSuccess}
                    </div>
                )}

                {/* list state handling */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                        <p className="text-surface-400">Loading your past papers...</p>
                    </div>
                ) : history.length === 0 && !error ? (
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
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="bg-surface-800 rounded-xl border border-surface-700 p-5 hover:border-surface-600 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* info */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-lg shrink-0 bg-purple-500/10">
                                            <FileText className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold mb-1">
                                                Placement Paper
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
                                                <span className="flex items-center gap-1 font-mono">
                                                    ID: {item.id}
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
                                            title="Hide result"
                                        >
                                            <Trash2 className="w-4 h-4" />
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