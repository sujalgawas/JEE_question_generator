// PlacementHome.js — Placement test generator with topic selector
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles,
    AlertCircle,
    BrainCircuit,
    Hash,
    Target,
    BookOpen,
    Calculator,
    MessageSquare,
    User,
    BarChart3,
} from 'lucide-react';
import API_URL from '../apiConfig';

/* ── topic config ── */
const TOPICS = [
    { key: 'Quantitative Ability (Advanced)', label: 'Quantitative Ability', icon: Calculator, color: 'accent' },
    { key: 'Logical Reasoning', label: 'Logical Reasoning', icon: BrainCircuit, color: 'accent' },
    { key: 'Verbal Ability', label: 'Verbal Ability', icon: MessageSquare, color: 'accent' },
    { key: 'AMPI(Personality)', label: 'AMPI (Personality)', icon: User, color: 'accent' },
    { key: 'Data Interpretation Information Ordering Information Processing', label: 'Data Interpretation', icon: BarChart3, color: 'accent' },
];

const QUESTION_COUNTS = [5, 10, 15];
const allModels = ["gemini", "qwen2.5:3b", "qwen3:4b"];

export default function PlacementHome() {
    const navigate = useNavigate();
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [questionCount, setQuestionCount] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [option_checker, setOption_checker] = useState(true);
    const [model, setModel] = useState('gemini');
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        const token = localStorage.getItem('idToken');
        const name = localStorage.getItem('userName');
        if (!token || !name) { navigate('/login'); return; }

        setIsGenerating(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/placement_question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    question_total: questionCount,
                    target_topic: selectedTopic || null,
                    model: model,
                    option_checker: option_checker
                }),
            });

            const data = await res.json();

            if (res.ok && data.paper_data) {
                sessionStorage.setItem('placementPaper', JSON.stringify(data.paper_data));
                const generatedPaperId = data.paper_id;

                if (generatedPaperId) {
                    navigate(`/placementMCQ-test/${generatedPaperId}`);
                } else {
                    setError('Test generated, but no Paper ID was returned from the server.');
                }
            } else {
                setError(data.message || data.error || 'Failed to generate questions');
            }
        } catch (err) {
            setError('Failed to connect to server. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-900">
            <div className="max-w-2xl mx-auto px-4 py-12">
                {/* header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-4">
                        <BrainCircuit className="w-3.5 h-3.5" />
                        Placement Preparation
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Generate Placement Test</h1>
                    <p className="text-surface-400 text-sm">
                        AI-powered AMCAT-style questions to ace your placement exams.
                    </p>
                </div>

                {/* generator card */}
                <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 sm:p-8">
                    {/* error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {isGenerating ? (
                        <div className="flex flex-col items-center py-12 gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                <BrainCircuit className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-semibold mb-1">Generating Questions...</p>
                                <p className="text-surface-500 text-sm">This may take a minute. AI is crafting unique questions for you.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* topic selection */}
                            <div className="mb-6">
                                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-purple-400" />
                                    Select Topic
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setSelectedTopic(null)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left ${selectedTopic === null
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-surface-700 bg-surface-700/30 hover:border-surface-600'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg shrink-0 ${selectedTopic === null ? 'bg-purple-500/20' : 'bg-surface-700'}`}>
                                            <BookOpen className={`w-4 h-4 ${selectedTopic === null ? 'text-purple-400' : 'text-surface-400'}`} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${selectedTopic === null ? 'text-white' : 'text-surface-300'}`}>All Topics</p>
                                            <p className="text-xs text-surface-500">Mixed question set</p>
                                        </div>
                                    </button>

                                    {TOPICS.map(({ key, label, icon: Icon }) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedTopic(key)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left ${selectedTopic === key
                                                ? 'border-purple-500 bg-purple-500/10'
                                                : 'border-surface-700 bg-surface-700/30 hover:border-surface-600'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg shrink-0 ${selectedTopic === key ? 'bg-purple-500/20' : 'bg-surface-700'}`}>
                                                <Icon className={`w-4 h-4 ${selectedTopic === key ? 'text-purple-400' : 'text-surface-400'}`} />
                                            </div>
                                            <p className={`text-sm font-medium ${selectedTopic === key ? 'text-white' : 'text-surface-300'}`}>{label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* question count */}
                            <div className="mb-6">
                                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-purple-400" />
                                    Number of Questions
                                </label>
                                <div className="flex gap-2">
                                    {QUESTION_COUNTS.map((count) => (
                                        <button
                                            key={count}
                                            onClick={() => setQuestionCount(count)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${questionCount === count
                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500'
                                                : 'bg-surface-700/50 text-surface-400 border border-surface-700 hover:border-surface-600'
                                                }`}
                                        >
                                            {count}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* model selector */}
                            <div className="mb-6">
                                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-purple-400" />
                                    Model
                                </label>
                                <div className="flex gap-2">
                                    {allModels.map((modelOption) => (
                                        <button
                                            key={modelOption}
                                            onClick={() => setModel(modelOption)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${model === modelOption
                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500'
                                                : 'bg-surface-700/50 text-surface-400 border border-surface-700 hover:border-surface-600'
                                                }`}
                                        >
                                            {modelOption}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Option Checker */}
                            <div className="mb-6">
                                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-purple-400" />
                                    Option Checker
                                </label>

                                <div className="flex items-center gap-4">

                                    {/* Toggle */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => setOption_checker(prev => !prev)}
                                            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${option_checker ? 'bg-purple-500' : 'bg-surface-700'
                                                }`}
                                        >
                                            <div
                                                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${option_checker ? 'left-9' : 'left-1'
                                                    }`}
                                            />
                                        </button>

                                        <span className="mt-2 text-sm text-surface-300 font-medium">
                                            {option_checker ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>

                                    {/* Info Box */}
                                    <div className="flex-1 bg-surface-800 border border-surface-700 rounded-xl p-4">
                                        <p className="text-sm text-surface-400 leading-relaxed">
                                            Option checker increases the time taken to generate questions,
                                            but ensures the generated options are more accurate and valid.
                                        </p>
                                    </div>

                                </div>
                            </div>

                            {/* summary */}
                            <div className="p-3 rounded-lg bg-surface-700/40 mb-6 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-surface-400">Topic</span>
                                    <span className="text-white font-medium">
                                        {selectedTopic ? TOPICS.find(t => t.key === selectedTopic)?.label : 'All Topics'}
                                    </span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-surface-400">Questions</span>
                                    <span className="text-white font-medium">{questionCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-surface-400">Model</span>
                                    <span className="text-white font-medium">{model}</span>
                                </div>
                            </div>

                            {/* generate button */}
                            <button
                                onClick={handleGenerate}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Placement Test
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}