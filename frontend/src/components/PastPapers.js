// PastPaper.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PastPaper() {
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('idToken');
        const userName = localStorage.getItem('userName');

        if (!token || !userName) {
            setError('User not authenticated');
            setLoading(false);
            return;
        }

        fetch("http://localhost:5000/retrieve-papers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, name: userName })
        })
            .then(res => res.json())
            .then(data => {
                if (data.papers) setPapers(data.papers);
                else setError(data.error || 'Unexpected error');
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to fetch papers');
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    return (
        <div className="p-8 text-center text-white">
            <h1 className="mb-6 text-2xl font-bold">Your Past Papers</h1>
            {papers.length === 0 ? (
                <p>No papers found.</p>
            ) : (
                <ul className="space-y-4">
                    {papers.map(paper => (
                        <li key={paper.paper_id} className="bg-gray-800 rounded p-4">
                            <div><strong>Title:</strong> {paper.title || `Paper ${paper.paper_id.slice(0, 8)}`}</div>
                            <div><strong>Created At:</strong> {paper.created_at}</div>
                            <div><strong>Questions:</strong> {paper.question_number?.length || 0}</div>
                            <div className="mt-3">
                                <button
                                    onClick={() => navigate(`/mcq-test/${paper.paper_id}`)}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white mr-2"
                                >
                                    Take Test
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
