import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const generatePaperFromAPI = async (userData = null) => {
    const API_URL = 'https://jee-question-generator.onrender.com/generate-paper';

    let requestBody = {};
    if (userData && userData.token && userData.name) {
        requestBody = {
            token: userData.token,
            name: userData.name
        };
        console.log("Sending request with user data:", { name: userData.name });
    } else {
        console.log("Sending request without user authentication");
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

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
        {user && (
            <p className="text-sm text-green-400 mt-1">✓ Logged in - Papers will be saved to your account</p>
        )}
        {!user && (
            <p className="text-sm text-yellow-400 mt-1">⚠ Not logged in - Papers won't be saved</p>
        )}
    </div>
);

const ControlPanel = ({ onGenerate, isLoading, status, user }) => (
    <div className="p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-md border border-gray-700">
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className="w-full md:w-1/2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 shadow-blue-500/30 shadow-lg"
            >
                {isLoading ? 'Generating... (This may take a minute)' : 'Generate New Paper'}
            </button>

            {!user && (
                <p className="text-sm text-gray-400 text-center">
                    <span className="text-yellow-400">Note:</span> Login to save papers to your account
                </p>
            )}

            {status && (
                <div className="mt-4 text-center w-full h-6">
                    <p className="text-sm text-gray-300 animate-pulse">{status}</p>
                </div>
            )}
        </div>
    </div>
);

export default function Homepage({ user, onLogout }) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [paperGenerated, setPaperGenerated] = useState(false);
    const navigate = useNavigate();

    const handleGenerate = async () => {
        setIsLoading(true);
        setStatus('Connecting to agent... This might take some time.');

        try {
            let userData = null;
            if (user && user.token && user.name) {
                userData = {
                    token: user.token,
                    name: user.name
                };
                setStatus('Generating paper with user authentication...');
            } else {
                setStatus('Generating paper (not logged in)...');
            }

            const result = await generatePaperFromAPI(userData);

            setStatus('Paper generated successfully!');
            setPaperGenerated(true);

        } catch (error) {
            setStatus(`Error: ${error.message}`);
            console.error("Error generating paper:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Header user={user} />
            <main className="mt-8">
                <ControlPanel onGenerate={handleGenerate} isLoading={isLoading} status={status} user={user} />

                {paperGenerated && (
                    <div className="mt-8 text-center">
                        <p className="text-green-400 mb-4">✅ Paper generated! Please go to the <span className="font-bold">Papers</span> page to view it.</p>
                        <button
                    onClick={() => navigate('/past-papers')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all duration-300"
                >
                    Go to Papers
                </button>
                    </div>
                )}

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
