import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mic,
    UploadCloud,
    FileText,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Volume2,
    VolumeX,
    Send,
    Radio,
    Terminal,
    Layers,
    Bot,
    User,
    Check,
    X,
    MessageSquare,
    Loader2
} from 'lucide-react';
import { INTERVIEWER_API_URL, INTERVIEWER_WS_URL, UNREALSPEECH_DEFAULT_VOICE } from '../apiConfig';
import { getAuthSession } from './authUtils';

const ROLES = [
    {
        key: 'backend',
        title: 'Backend Developer',
        desc: 'FastAPI, Python, SQL, Microservices, Docker, Redis',
        color: 'from-blue-500/20 to-purple-500/20 border-blue-500/30'
    },
    {
        key: 'fullstack',
        title: 'Full Stack Developer',
        desc: 'React, Next.js, Node.js, TypeScript, Tailwind, MongoDB',
        color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
    },
    {
        key: 'ai/ml',
        title: 'AI / ML Engineer',
        desc: 'PyTorch, LangGraph, RAG, ChromaDB, LLMs, Transformers',
        color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
    }
];

export default function PlacementInterview() {
    const navigate = useNavigate();

    const [step, setStep] = useState('setup');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('backend');
    const [resumeFile, setResumeFile] = useState(null);
    const [uploadingResume, setUploadingResume] = useState(false);
    const [setupError, setSetupError] = useState('');

    const [sessionId, setSessionId] = useState('');
    const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
    const [maxQuestions, setMaxQuestions] = useState(10);
    const [currentQuestionText, setCurrentQuestionText] = useState('');
    const [allQuestions, setAllQuestions] = useState({});
    const [allAnswers, setAllAnswers] = useState({});
    const [lastTranscribedAnswer, setLastTranscribedAnswer] = useState('');

    const [inputMode, setInputMode] = useState('voice');
    const [textAnswer, setTextAnswer] = useState('');

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
    const [interviewError, setInterviewError] = useState('');

    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [ttsVoice, setTtsVoice] = useState(UNREALSPEECH_DEFAULT_VOICE || 'Daniel');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioPlayerRef = useRef(null);

    const interviewWsRef = useRef(null);
    const submitWsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);

    useEffect(() => {
        const { name } = getAuthSession();
        if (name) {
            setUsername(name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_'));
        }
    }, []);

    const stopSpeaking = () => {
        if (audioPlayerRef.current) {
            try {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.currentTime = 0;
            } catch (_) { }
            audioPlayerRef.current = null;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
    };

    useEffect(() => {
        return () => {
            closeWebSockets();
            stopRecordingTimer();
            stopSpeaking();
        };
    }, []);

    const closeWebSockets = () => {
        if (interviewWsRef.current) {
            try { interviewWsRef.current.close(1000); } catch (_) { }
            interviewWsRef.current = null;
        }
        if (submitWsRef.current) {
            try { submitWsRef.current.close(1000); } catch (_) { }
            submitWsRef.current = null;
        }
    };

    const speakQuestion = async (text, voiceToUse = null) => {
        if (!ttsEnabled || !text) return;
        stopSpeaking();

        const activeVoice = voiceToUse || ttsVoice || 'Daniel';

        // 1. Synthesize audio via the backend Interviewer TTS service
        // The backend securely uses the 'unrealspeech' key from the root .env
        try {
            const resp = await fetch(`${INTERVIEWER_API_URL}/interview/tts`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    text: text,
                    voice: activeVoice,
                    speed: '0',
                    pitch: '1'
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data && data.audioContent) {
                    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
                    audioPlayerRef.current = audio;
                    setIsSpeaking(true);
                    audio.onended = () => setIsSpeaking(false);
                    audio.onerror = () => setIsSpeaking(false);
                    await audio.play();
                    return;
                }
            } else {
                console.warn('Backend UnrealSpeech TTS returned non-200 status:', resp.status);
            }
        } catch (backendErr) {
            console.warn('Backend UnrealSpeech TTS service unavailable:', backendErr);
        }

        // 2. Fallback to browser speech synthesis if backend is unreachable
        try {
            if (window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.onend = () => setIsSpeaking(false);
                utterance.onerror = () => setIsSpeaking(false);
                setIsSpeaking(true);
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.warn('Browser SpeechSynthesis error:', e);
            setIsSpeaking(false);
        }
    };


    const handleStartInterview = async (e) => {
        e.preventDefault();
        const candidateUser = (username || 'candidate').trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

        if (!resumeFile) {
            setSetupError('Please upload your resume (PDF) to proceed.');
            return;
        }

        setUploadingResume(true);
        setSetupError('');

        try {
            const formData = new FormData();
            formData.append('resume', resumeFile);

            const uploadUrl = `${INTERVIEWER_API_URL}/resume/${encodeURIComponent(candidateUser)}`;
            const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.message || 'Failed to upload resume');
            }

            const data = await res.json();
            const createdSessionId = data.session_id_str;
            setSessionId(createdSessionId);

            startLiveInterview(candidateUser, createdSessionId, role);
        } catch (err) {
            console.error('Resume upload error:', err);
            const userMsg = err.message === 'Failed to fetch'
                ? 'Unable to connect to the Interviewer service. Please ensure the backend is running and tunnel is active.'
                : (err.message || 'Failed to connect to the interviewer server.');
            setSetupError(userMsg);
            setUploadingResume(false);
        }
    };

    const startLiveInterview = (candidateUser, activeSessionId, targetRole) => {
        setStep('interview');
        setInterviewError('');
        setIsSubmittingAnswer(false);

        const interviewUrl = `${INTERVIEWER_WS_URL}/interview/${encodeURIComponent(candidateUser)}/${encodeURIComponent(activeSessionId)}?role=${encodeURIComponent(targetRole)}`;
        const interviewWs = new WebSocket(interviewUrl);
        interviewWsRef.current = interviewWs;

        const submitUrl = `${INTERVIEWER_WS_URL}/submit/${encodeURIComponent(candidateUser)}/${encodeURIComponent(activeSessionId)}`;
        const submitWs = new WebSocket(submitUrl);
        submitWsRef.current = submitWs;

        interviewWs.onopen = () => {
            console.log('Connected to interview WebSocket');
        };

        interviewWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Interview WS message received:', data);

                if (data.status === 'in_progress') {
                    setCurrentQuestionNumber(data.question_number || 1);
                    setCurrentQuestionText(data.question || '');
                    setLastTranscribedAnswer('');
                    setTextAnswer('');
                    setIsSubmittingAnswer(false);

                    setAllQuestions(prev => ({
                        ...prev,
                        [data.question_number]: data.question
                    }));

                    speakQuestion(data.question);
                } else if (data.status === 'completed') {
                    console.log('Interview completed payload:', data);
                    if (data.questions) setAllQuestions(data.questions);
                    if (data.answers) setAllAnswers(data.answers);
                    setStep('completed');
                    closeWebSockets();
                }
            } catch (err) {
                console.error('Error handling interview WS message:', err);
            }
        };

        interviewWs.onerror = (e) => {
            console.error('Interview WS error:', e);
            setInterviewError('Interview WebSocket connection error.');
        };

        interviewWs.onclose = (e) => {
            console.log('Interview WS closed with code:', e.code);
            if (e.code === 1000) {
                setStep('completed');
            }
        };

        submitWs.onopen = () => {
            console.log('Connected to submit WebSocket');
        };

        submitWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Submit WS acknowledgment received:', data);

                if (data.status === 'success') {
                    const answeredText = data.answer_txt || '';
                    setLastTranscribedAnswer(answeredText);

                    setAllAnswers(prev => ({
                        ...prev,
                        [data.question_number || currentQuestionNumber]: answeredText
                    }));

                    if (interviewWsRef.current && interviewWsRef.current.readyState === WebSocket.OPEN) {
                        interviewWsRef.current.send(JSON.stringify({
                            action: 'next_question',
                            question_number: data.question_number,
                            answer: answeredText
                        }));
                    }
                } else if (data.type === 'error') {
                    setInterviewError(data.message || 'Submission error on backend.');
                    setIsSubmittingAnswer(false);
                }
            } catch (err) {
                console.error('Error handling submit WS message:', err);
                setIsSubmittingAnswer(false);
            }
        };

        submitWs.onerror = (e) => {
            console.error('Submit WS error:', e);
        };
    };

    const startRecording = async () => {
        setInterviewError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/wav';
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                stream.getTracks().forEach(track => track.stop());
                await submitAudioBlob(audioBlob);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access error:', err);
            setInterviewError('Microphone permission denied or device not found. You can switch to typing your answer below.');
        }
    };

    const stopRecordingTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const stopRecording = () => {
        stopRecordingTimer();
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            setIsSubmittingAnswer(true);
            mediaRecorderRef.current.stop();
        }
    };

    const submitAudioBlob = async (audioBlob) => {
        try {
            if (!submitWsRef.current || submitWsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error('Submit WebSocket connection is not open. Please retry.');
            }

            const arrayBuffer = await audioBlob.arrayBuffer();
            submitWsRef.current.send(arrayBuffer);
            console.log('Sent binary audio bytes of length:', arrayBuffer.byteLength);
        } catch (err) {
            console.error('Error submitting audio answer:', err);
            setInterviewError(err.message || 'Failed to send audio answer.');
            setIsSubmittingAnswer(false);
        }
    };

    const handleSubmitTextAnswer = (e) => {
        e.preventDefault();
        if (!textAnswer.trim()) return;

        setIsSubmittingAnswer(true);
        setInterviewError('');

        try {
            if (!submitWsRef.current || submitWsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error('Submit WebSocket is not open.');
            }

            submitWsRef.current.send(JSON.stringify({
                answer: textAnswer.trim(),
                question_number: currentQuestionNumber
            }));
        } catch (err) {
            console.error('Error submitting text answer:', err);
            setInterviewError(err.message || 'Failed to submit text answer.');
            setIsSubmittingAnswer(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="min-h-screen bg-surface-900 text-surface-200 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {step === 'setup' && (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
                                <Sparkles className="w-4 h-4" />
                                AI Technical Mock Interview
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                                Launch Your Practice Interview
                            </h1>
                            <p className="text-surface-400 max-w-xl mx-auto text-sm sm:text-base">
                                Upload your resume. Our LangGraph AI agent will parse your background, generate real-time questions, and conduct a full conversational technical interview.
                            </p>
                        </div>

                        {setupError && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{setupError}</span>
                            </div>
                        )}

                        <form onSubmit={handleStartInterview} className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6 sm:p-8 space-y-6 shadow-xl">
                            <div>
                                <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                    <User className="w-4 h-4 text-purple-400" />
                                    Candidate Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="e.g. john_doe"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-surface-900 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                                />
                                <p className="text-xs text-surface-500 mt-1">Used to index your interview history and ChromaDB vectors.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-purple-400" />
                                    Target Role
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {ROLES.map((r) => {
                                        const isSelected = role === r.key;
                                        return (
                                            <button
                                                type="button"
                                                key={r.key}
                                                onClick={() => setRole(r.key)}
                                                className={`p-4 rounded-xl border text-left transition-all duration-200 relative overflow-hidden ${isSelected
                                                    ? 'border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-500/10'
                                                    : 'border-surface-700 bg-surface-900/60 hover:border-surface-600'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <span className="absolute top-2 right-2 p-1 bg-purple-500 rounded-full text-white">
                                                        <Check className="w-3 h-3" />
                                                    </span>
                                                )}
                                                <h3 className={`text-sm font-bold mb-1 ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                                                    {r.title}
                                                </h3>
                                                <p className="text-xs text-surface-400 leading-relaxed">
                                                    {r.desc}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    Upload Resume (PDF)
                                </label>

                                <div className="border-2 border-dashed border-surface-700 hover:border-purple-500/60 rounded-xl p-6 text-center transition-colors bg-surface-900/40 relative">
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setResumeFile(e.target.files[0]);
                                                setSetupError('');
                                            }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {resumeFile ? (
                                        <div className="flex items-center justify-center gap-3 text-sm text-purple-300 font-medium">
                                            <FileText className="w-6 h-6 text-purple-400" />
                                            <span className="truncate max-w-xs">{resumeFile.name}</span>
                                            <span className="text-xs text-surface-500">
                                                ({(resumeFile.size / 1024).toFixed(0)} KB)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setResumeFile(null);
                                                }}
                                                className="p-1 hover:bg-surface-700 rounded-full text-surface-400 hover:text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <UploadCloud className="w-10 h-10 mx-auto text-purple-400/80" />
                                            <p className="text-sm text-surface-300">
                                                <span className="font-semibold text-purple-400">Click to upload</span> or drag and drop
                                            </p>
                                            <p className="text-xs text-surface-500">
                                                Only PDF resumes are supported (Max 10MB)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploadingResume}
                                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-base transition-all duration-200 shadow-lg shadow-purple-600/20 disabled:opacity-50"
                            >
                                {uploadingResume ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Parsing Resume & Building RAG...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>Start Technical Interview</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {step === 'interview' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-bold text-white capitalize">{username}</h2>
                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold uppercase">
                                            {role}
                                        </span>
                                    </div>
                                    <p className="text-xs text-surface-400 font-mono">
                                        Session: {sessionId.slice(0, 8)}...
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-surface-900/80 border border-surface-700/80 rounded-lg px-2.5 py-1 text-xs">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="text-surface-400 font-medium hidden sm:inline">Voice:</span>
                                    <select
                                        value={ttsVoice}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setTtsVoice(v);
                                            if (isSpeaking) {
                                                stopSpeaking();
                                                speakQuestion(currentQuestionText, v);
                                            }
                                        }}
                                        title="Select UnrealSpeech Voice"
                                        className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
                                    >
                                        <option value="Daniel" className="bg-surface-800 text-white">UnrealSpeech: Daniel (Male)</option>
                                        <option value="Charlotte" className="bg-surface-800 text-white">UnrealSpeech: Charlotte (Female)</option>
                                        <option value="Rowan" className="bg-surface-800 text-white">UnrealSpeech: Rowan (Male)</option>
                                        <option value="Emily" className="bg-surface-800 text-white">UnrealSpeech: Emily (Female)</option>
                                        <option value="Oliver" className="bg-surface-800 text-white">UnrealSpeech: Oliver (Male)</option>
                                        <option value="Amelia" className="bg-surface-800 text-white">UnrealSpeech: Amelia (Female)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => {
                                        if (ttsEnabled && isSpeaking) {
                                            stopSpeaking();
                                        }
                                        setTtsEnabled(prev => !prev);
                                    }}
                                    title={ttsEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
                                    className={`p-2 rounded-lg border transition-colors ${ttsEnabled
                                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                        : 'bg-surface-700 border-surface-600 text-surface-400'
                                        }`}
                                >
                                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                </button>

                                <div className="text-right">
                                    <p className="text-xs text-surface-400">Interview Progress</p>
                                    <p className="text-sm font-bold text-white">
                                        Question <span className="text-purple-400">{currentQuestionNumber}</span> of {maxQuestions}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {interviewError && (
                            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{interviewError}</span>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-surface-800 to-surface-850 rounded-2xl border border-surface-700/80 p-6 sm:p-8 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                                    <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                    Active Question #{currentQuestionNumber}
                                </div>

                                <div className="flex items-center gap-2">
                                    {isSpeaking ? (
                                        <button
                                            onClick={stopSpeaking}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-xs text-purple-300 hover:bg-purple-500/30 transition-all font-medium animate-pulse"
                                        >
                                            <VolumeX className="w-3.5 h-3.5" />
                                            <span>AI Speaking (UnrealSpeech) - Stop</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => speakQuestion(currentQuestionText)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-700/60 hover:bg-surface-700 border border-surface-600/70 text-xs text-purple-300 hover:text-purple-200 transition-all font-medium"
                                        >
                                            <Volume2 className="w-3.5 h-3.5" />
                                            <span>Replay Audio (UnrealSpeech)</span>
                                        </button>
                                    )}
                                </div>
                            </div>



                            <h3 className="text-lg sm:text-xl font-semibold text-white leading-relaxed mb-4">
                                {currentQuestionText || (
                                    <span className="inline-flex items-center gap-2 text-surface-400">
                                        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                                        Generating question from your resume context...
                                    </span>
                                )}
                            </h3>
                        </div>

                        <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6 sm:p-8 shadow-xl space-y-6">
                            <div className="flex items-center justify-between border-b border-surface-700 pb-4">
                                <span className="text-xs uppercase font-bold tracking-wider text-surface-400">
                                    Your Answer
                                </span>
                                <div className="inline-flex rounded-lg bg-surface-900 p-1 border border-surface-700">
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('voice')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${inputMode === 'voice'
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-surface-400 hover:text-white'
                                            }`}
                                    >
                                        <Mic className="w-3.5 h-3.5" />
                                        Voice (Speech-to-Text)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('text')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${inputMode === 'text'
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-surface-400 hover:text-white'
                                            }`}
                                    >
                                        <Terminal className="w-3.5 h-3.5" />
                                        Type Answer
                                    </button>
                                </div>
                            </div>

                            {inputMode === 'voice' && (
                                <div className="text-center py-6 space-y-5">
                                    {isSubmittingAnswer ? (
                                        <div className="space-y-3 py-8">
                                            <div className="relative inline-block">
                                                <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                                <Bot className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
                                            </div>
                                            <p className="text-white font-semibold">Transcribing Answer via Groq Whisper...</p>
                                            <p className="text-xs text-surface-400">
                                                Evaluating response and synthesizing the next question...
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {isRecording && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-center gap-1 h-8">
                                                        <div className="w-1.5 h-6 bg-red-500 rounded-full animate-pulse" />
                                                        <div className="w-1.5 h-8 bg-red-400 rounded-full animate-bounce" />
                                                        <div className="w-1.5 h-4 bg-red-500 rounded-full animate-pulse" />
                                                        <div className="w-1.5 h-7 bg-red-400 rounded-full animate-bounce" />
                                                        <div className="w-1.5 h-5 bg-red-500 rounded-full animate-pulse" />
                                                    </div>
                                                    <div className="text-2xl font-mono font-bold text-red-400">
                                                        {formatTime(recordingTime)}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-center gap-4">
                                                {!isRecording ? (
                                                    <button
                                                        type="button"
                                                        onClick={startRecording}
                                                        className="flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-base shadow-xl shadow-red-600/25 transition-all duration-200 transform hover:scale-105"
                                                    >
                                                        <Mic className="w-5 h-5" />
                                                        Start Answering
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={stopRecording}
                                                        className="flex items-center gap-3 px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-xl shadow-red-600/30 transition-all duration-200 animate-pulse"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Stop & Submit Answer
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-surface-400">
                                                {!isRecording
                                                    ? 'Click "Start Answering", speak clearly into your mic, then click stop to submit.'
                                                    : 'Listening... speak your response and press Stop when finished.'}
                                            </p>
                                        </>
                                    )}

                                    {lastTranscribedAnswer && (
                                        <div className="text-left mt-6 p-4 rounded-xl bg-surface-900/80 border border-surface-700 text-xs space-y-1">
                                            <span className="text-purple-400 font-semibold block">Last Transcribed Answer:</span>
                                            <p className="text-surface-300 italic">"{lastTranscribedAnswer}"</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {inputMode === 'text' && (
                                <form onSubmit={handleSubmitTextAnswer} className="space-y-4">
                                    <textarea
                                        rows={4}
                                        value={textAnswer}
                                        onChange={(e) => setTextAnswer(e.target.value)}
                                        placeholder="Type your technical response here..."
                                        disabled={isSubmittingAnswer}
                                        className="w-full p-4 rounded-xl bg-surface-900 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-purple-500 text-sm leading-relaxed"
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={isSubmittingAnswer || !textAnswer.trim()}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                                        >
                                            {isSubmittingAnswer ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Submitting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    <span>Submit Text Answer</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="flex justify-between items-center text-xs text-surface-500 px-2">
                            <span>Dual WebSocket Sync: Active</span>
                            <button
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to exit the interview session?')) {
                                        closeWebSockets();
                                        navigate('/placement');
                                    }
                                }}
                                className="hover:text-red-400 transition-colors"
                            >
                                Quit Interview Session
                            </button>
                        </div>
                    </div>
                )}

                {step === 'completed' && (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-surface-800 rounded-2xl border border-purple-500/30 p-8 text-center space-y-4 shadow-2xl">
                            <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                                Interview Completed!
                            </h2>
                            <p className="text-surface-300 text-sm max-w-lg mx-auto">
                                All {Object.keys(allQuestions).length} questions have been answered and logged in your Firebase profile.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => navigate('/placement')}
                                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
                                >
                                    Return to Placement Hub
                                </button>
                                <button
                                    onClick={() => {
                                        setStep('setup');
                                        setAllQuestions({});
                                        setAllAnswers({});
                                    }}
                                    className="px-6 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-surface-200 font-semibold text-sm transition-colors"
                                >
                                    Start Another Interview
                                </button>
                            </div>
                        </div>

                        <div className="bg-surface-800 rounded-2xl border border-surface-700/80 p-6 sm:p-8 space-y-6">
                            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-purple-400" />
                                    Interview Questions & Answers
                                </h3>
                                <span className="text-xs text-surface-400">
                                    {Object.keys(allQuestions).length} Questions Logged
                                </span>
                            </div>

                            <div className="space-y-4">
                                {Object.keys(allQuestions).map((qNum) => {
                                    const qText = allQuestions[qNum];
                                    const aText = allAnswers[qNum] || 'No answer recorded.';
                                    return (
                                        <div key={qNum} className="p-4 rounded-xl bg-surface-900/60 border border-surface-700 space-y-2.5">
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold shrink-0">
                                                    Q{qNum}
                                                </span>
                                                <p className="text-sm font-semibold text-white leading-relaxed">
                                                    {qText}
                                                </p>
                                            </div>
                                            <div className="pl-8 text-xs text-surface-300 border-l-2 border-purple-500/30 ml-2">
                                                <span className="text-surface-500 font-medium block mb-0.5">Your Response:</span>
                                                <p className="italic">{aText}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
