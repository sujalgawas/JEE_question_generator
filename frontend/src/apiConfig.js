// This code reads the correct URL from the .env files
// and makes it available to the rest of your app.

const cleanUrl = (url) => (url ? url.trim().replace(/\/+$/, '') : '');

let rawApiUrl = cleanUrl(process.env.REACT_APP_API_URL);

if (rawApiUrl && rawApiUrl.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    rawApiUrl = rawApiUrl.replace('localhost', window.location.hostname);
}

let API_URL = rawApiUrl;

// Interviewer FastAPI service URLs:
// In production or when using a single ngrok/gateway domain, INTERVIEWER_API_URL defaults to API_URL.
// In local development where Flask runs on 8081 and Interviewer on 8000/8086, it defaults to port 8000.
let rawInterviewerApi = cleanUrl(process.env.REACT_APP_INTERVIEWER_API_URL);
if (!rawInterviewerApi) {
    if (API_URL && !API_URL.includes(':8081')) {
        // If API_URL is a unified domain (e.g., ngrok or production domain)
        rawInterviewerApi = API_URL;
    } else {
        rawInterviewerApi = 'http://127.0.0.1:8000';
    }
}

if (rawInterviewerApi && rawInterviewerApi.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    rawInterviewerApi = rawInterviewerApi.replace('localhost', window.location.hostname);
}

export let INTERVIEWER_API_URL = rawInterviewerApi;

// Interviewer WebSocket URL (wss:// for https, ws:// for http)
let rawInterviewerWs = cleanUrl(process.env.REACT_APP_INTERVIEWER_WS_URL);
if (!rawInterviewerWs) {
    if (INTERVIEWER_API_URL) {
        if (INTERVIEWER_API_URL.startsWith('https://')) {
            rawInterviewerWs = INTERVIEWER_API_URL.replace('https://', 'wss://');
        } else if (INTERVIEWER_API_URL.startsWith('http://')) {
            rawInterviewerWs = INTERVIEWER_API_URL.replace('http://', 'ws://');
        } else {
            rawInterviewerWs = `ws://${INTERVIEWER_API_URL}`;
        }
    } else {
        rawInterviewerWs = 'ws://127.0.0.1:8000';
    }
}

if (rawInterviewerWs && rawInterviewerWs.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    rawInterviewerWs = rawInterviewerWs.replace('localhost', window.location.hostname);
}

export let INTERVIEWER_WS_URL = rawInterviewerWs;
export let UNREALSPEECH_DEFAULT_VOICE = process.env.REACT_APP_UNREALSPEECH_VOICE || 'Daniel';

console.log('Using API URL:', API_URL);
console.log('Using Interviewer API URL:', INTERVIEWER_API_URL);
console.log('Using Interviewer WS URL:', INTERVIEWER_WS_URL);
console.log('Using UnrealSpeech Voice:', UNREALSPEECH_DEFAULT_VOICE);

export default API_URL;
