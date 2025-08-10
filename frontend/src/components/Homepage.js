// Homepage.jsx
import React, { useState, useEffect, useMemo } from 'react';

const generatePaperFromAPI = async () => {
    const API_URL = 'http://localhost:5000/generate-paper';
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

const Header = ({ user }) => (
    <div className="text-center p-4 mt-8">
        <h2 className="text-4xl font-bold text-white tracking-tight">
            {user ? `Welcome, ${user.name}!` : 'JEE Question Paper Generator'}
        </h2>
        <p className="text-md text-gray-400 mt-2">Connected to Live Flask Backend</p>
    </div>
);

const ControlPanel = ({ onGenerate, isLoading, status }) => (
    <div className="p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-md border border-gray-700">
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className="w-full md:w-1/2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 shadow-blue-500/30 shadow-lg"
            >
                {isLoading ? 'Generating... (This may take a minute)' : 'Generate New Paper'}
            </button>
            {status && (
                <div className="mt-4 text-center w-full h-6">
                    <p className="text-sm text-gray-300 animate-pulse">{status}</p>
                </div>
            )}
        </div>
    </div>
);

const QuestionCard = ({ question, index, isActive, onToggle }) => {
    const { question_number, concept, difficulty, question_text, options, correct_answer, explanation } = question;
    const difficultyColor = {
        Easy: 'text-green-400 bg-green-900/50',
        Medium: 'text-yellow-400 bg-yellow-900/50',
        Hard: 'text-red-400 bg-red-900/50',
    }[difficulty] || 'text-gray-400 bg-gray-900/50';

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 shadow-md transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-blue-400">Question {question_number}</h3>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${difficultyColor}`}>{difficulty}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4 font-mono">Concept: {concept}</p>
            <p className="text-gray-200 text-lg mb-6">{question_text}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {Object.entries(options).map(([key, value]) => (
                    <div key={key} className="bg-gray-700/50 p-3 rounded-md border border-gray-600 flex items-center">
                        <span className="font-bold text-blue-400 mr-3">{key}.</span>
                        <span className="text-gray-300">{value}</span>
                    </div>
                ))}
            </div>
            <button
                onClick={() => onToggle(index)}
                className="w-full bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
                {isActive ? 'Hide Solution' : 'Show Solution'}
            </button>
            {isActive && (
                <div className="mt-5 p-4 bg-gray-900/70 rounded-lg border border-teal-500/30 animate-fade-in">
                    <h4 className="font-bold text-teal-400 mb-2">Solution</h4>
                    <p className="text-gray-300 mb-3"><span className="font-semibold">Correct Answer:</span> <span className="font-bold text-xl ml-2">{correct_answer}</span></p>
                    <p className="text-gray-300"><span className="font-semibold">Explanation:</span> {explanation}</p>
                </div>
            )}
        </div>
    );
};

const PaperDisplay = ({ paperData }) => {
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);

    const processedData = useMemo(() => {
        if (!paperData || !paperData.subject) return null;
        const data = {};
        paperData.subject.forEach((subj, i) => {
            if (!data[subj]) data[subj] = [];
            data[subj].push({
                question_number: paperData.question_number[i],
                subject: paperData.subject[i],
                concept: paperData.concept[i],
                weightage: paperData.weightage[i],
                question_text: paperData.question_text[i],
                options: paperData.options[i],
                difficulty: paperData.difficulty[i],
                correct_answer: paperData.correct_answer[i],
                explanation: paperData.explanation[i],
            });
        });
        return data;
    }, [paperData]);

    useEffect(() => {
        if (processedData) {
            const subjects = Object.keys(processedData);
            if (subjects.length > 0) setSelectedSubject(subjects[0]);
        }
    }, [processedData]);

    if (!processedData) return null;

    const subjects = Object.keys(processedData);
    const questions = processedData[selectedSubject] || [];

    const handleToggleSolution = (index) => {
        setActiveQuestionIndex(prevIndex => (prevIndex === index ? null : index));
    };

    return (
        <div className="mt-8">
            <div className="flex justify-center border-b border-gray-700 mb-6">
                {subjects.map(subject => (
                    <button
                        key={subject}
                        onClick={() => {
                            setSelectedSubject(subject);
                            setActiveQuestionIndex(null);
                        }}
                        className={`px-6 py-3 text-lg font-medium transition-all duration-300 border-b-2 ${selectedSubject === subject ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        {subject}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {questions.map((q, index) => (
                    <QuestionCard key={q.question_number} question={q} index={index} isActive={activeQuestionIndex === index} onToggle={handleToggleSolution} />
                ))}
            </div>
        </div>
    );
};

export default function Homepage({ user, onLogout }) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [paperData, setPaperData] = useState(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setPaperData(null);
        setStatus('Connecting to agent... This might take some time.');
        try {
            const result = await generatePaperFromAPI();
            setPaperData(result);
            setStatus('Paper generated successfully!');
        } catch (error) {
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Header user={user} />
            <main className="mt-8">
                <ControlPanel onGenerate={handleGenerate} isLoading={isLoading} status={status} />
                {paperData && <PaperDisplay paperData={paperData} />}
                {user && (
                    <div className="mt-8 text-center">
                        <button 
                            onClick={onLogout} 
                            className="text-gray-400 hover:text-white transition-colors duration-200 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
                        >
                            Log Out
                        </button>
                    </div>
                )}
            </main>
        </>
    );
}
