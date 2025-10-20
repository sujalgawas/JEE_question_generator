import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Award, Zap, ArrowRight, LogOut } from 'lucide-react';
import API_URL from '../apiConfig';

const generatePaperFromAPI = async (userData = null) => {
    const fullUrl = `${API_URL}/generate-paper`; 

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

    const response = await fetch(fullUrl, {
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

// Floating orbs background animation
const FloatingOrbs = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
    </div>
);

// Stat Card Component
const StatCard = ({ icon: Icon, title, value, delay }) => (
    <div 
        className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                <Icon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    </div>
);

// Feature Badge Component
const FeatureBadge = ({ text, delay }) => (
    <div 
        className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full text-sm text-blue-300 backdrop-blur-sm hover:scale-105 transition-transform duration-300"
        style={{ animationDelay: `${delay}ms` }}
    >
        {text}
    </div>
);

// Logged-Out View
const LoggedOutView = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <div className={`text-center max-w-5xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full mb-8 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">AI-Powered Test Generation</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 animate-gradient">
                    Master JEE
                </span>
                <br />
                <span className="text-white">With AI Precision</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
                Personalized practice tests powered by cutting-edge AI. 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-semibold"> Elevate your preparation</span> to the next level.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
                <FeatureBadge text="✨ Smart Question Bank" delay={100} />
                <FeatureBadge text="📊 Performance Analytics" delay={200} />
                <FeatureBadge text="🎯 Adaptive Difficulty" delay={300} />
                <FeatureBadge text="⚡ Instant Results" delay={400} />
            </div>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
                <button
                    onClick={() => alert("Redirecting to login...")}
                    className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl overflow-hidden shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative flex items-center gap-2">
                        Get Started Now
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                </button>
                <button
                    onClick={() => alert("Learn more about features...")}
                    className="px-8 py-4 bg-gray-800/50 backdrop-blur-sm text-white font-semibold rounded-xl border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all duration-300"
                >
                    Learn More
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                <StatCard icon={TrendingUp} title="Success Rate" value="94%" delay={100} />
                <StatCard icon={Award} title="Tests Generated" value="50K+" delay={200} />
                <StatCard icon={Zap} title="Active Students" value="10K+" delay={300} />
            </div>
        </div>
    );
};

// Logged-In View
const LoggedInView = ({ user, onLogout, onGenerate, isLoading, status, paperGenerated }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <div className={`w-full max-w-3xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Welcome Header */}
            <div className="text-center mb-12 relative">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-full mb-6 backdrop-blur-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-300 font-medium">Active Session</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-black mb-4">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Welcome back,
                    </span>
                    <br />
                    <span className="text-white">{user.name}!</span>
                </h2>
                <p className="text-lg text-gray-400">Ready to crush your next practice session?</p>
            </div>

            {/* Main Control Panel */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl rounded-3xl"></div>
                <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-700/50 shadow-2xl">
                    <div className="flex flex-col items-center gap-6">
                        {/* Generate Button */}
                        <button
                            onClick={onGenerate}
                            disabled={isLoading}
                            className="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-5 px-8 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <span className="relative flex items-center justify-center gap-3 text-lg">
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-6 h-6" />
                                        Generate New Paper
                                        <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                                    </>
                                )}
                            </span>
                        </button>

                        {/* Status Message */}
                        {status && (
                            <div className="w-full min-h-[32px] flex items-center justify-center">
                                <p className="text-sm text-blue-300 animate-pulse flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                                    {status}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Success Message */}
            {paperGenerated && (
                <div className="mb-8 relative overflow-hidden animate-in slide-in-from-bottom duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-xl rounded-2xl"></div>
                    <div className="relative bg-gradient-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-sm border border-green-500/30 p-6 rounded-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-green-500/20 rounded-full">
                                <Award className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <p className="text-green-300 font-bold text-lg">Success!</p>
                                <p className="text-green-400/80 text-sm">Your paper is ready to tackle</p>
                            </div>
                        </div>
                        <button
                            onClick={() => alert("Navigating to Past Papers...")}
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-green-500/30 transition-all duration-300 flex items-center justify-center gap-2 group"
                        >
                            View Your Papers
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-blue-500/50 transition-all duration-300">
                    <p className="text-3xl font-bold text-blue-400">12</p>
                    <p className="text-xs text-gray-400 mt-1">Papers Done</p>
                </div>
                <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-purple-500/50 transition-all duration-300">
                    <p className="text-3xl font-bold text-purple-400">87%</p>
                    <p className="text-xs text-gray-400 mt-1">Avg Score</p>
                </div>
                <div className="bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 text-center hover:border-cyan-500/50 transition-all duration-300">
                    <p className="text-3xl font-bold text-cyan-400">24h</p>
                    <p className="text-xs text-gray-400 mt-1">Study Time</p>
                </div>
            </div>

            {/* Logout Button */}
            <div className="text-center">
                <button
                    onClick={onLogout}
                    className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 bg-gray-800/50 hover:bg-red-600/20 border border-gray-700 hover:border-red-500/50 px-6 py-3 rounded-xl backdrop-blur-sm"
                >
                    <LogOut className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform duration-300" />
                    Sign Out
                </button>
            </div>
        </div>
    );
};

// Main Homepage Component
export default function Homepage({ user, onLogout }) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [paperGenerated, setPaperGenerated] = useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        setPaperGenerated(false);
        setStatus('Connecting to AI agent...');

        try {
            const userData = { token: user.token, name: user.name };
            setStatus('Crafting your personalized paper...');
            
            await generatePaperFromAPI(userData);

            setStatus('Paper generated successfully!');
            setPaperGenerated(true);

        } catch (error) {
            setStatus(`Error: ${error.message}`);
            console.error("Error generating paper:", error);
        } finally {
            setIsLoading(false);
            setTimeout(() => setStatus(''), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex items-center justify-center p-6 relative overflow-hidden">
            <FloatingOrbs />
            
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>
            
            <div className="relative z-10 w-full">
                {user ? (
                    <LoggedInView 
                        user={user} 
                        onLogout={onLogout}
                        onGenerate={handleGenerate}
                        isLoading={isLoading}
                        status={status}
                        paperGenerated={paperGenerated}
                    />
                ) : (
                    <LoggedOutView />
                )}
            </div>

            <style jsx>{`
                @keyframes gradient {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient 3s ease infinite;
                }
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
                    animation: in 0.5s ease-out;
                }
                .slide-in-from-bottom {
                    animation: slideInFromBottom 0.5s ease-out;
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
            `}</style>
        </div>
    );
}