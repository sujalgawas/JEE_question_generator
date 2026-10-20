// This code reads the correct URL from the .env files
// and makes it available to the rest of your app.
let API_URL = process.env.REACT_APP_API_URL;

if (API_URL && API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    API_URL = API_URL.replace('localhost', window.location.hostname);
}

// Interviewer FastAPI service URLs (defaults to port 8000)
export let INTERVIEWER_API_URL = process.env.REACT_APP_INTERVIEWER_API_URL || 'http://127.0.0.1:8000';
if (INTERVIEWER_API_URL && INTERVIEWER_API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    INTERVIEWER_API_URL = INTERVIEWER_API_URL.replace('localhost', window.location.hostname);
}

export let INTERVIEWER_WS_URL = process.env.REACT_APP_INTERVIEWER_WS_URL || 'ws://127.0.0.1:8000';
if (INTERVIEWER_WS_URL && INTERVIEWER_WS_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    INTERVIEWER_WS_URL = INTERVIEWER_WS_URL.replace('localhost', window.location.hostname);
}
export let UNREALSPEECH_DEFAULT_VOICE = process.env.REACT_APP_UNREALSPEECH_VOICE || 'Daniel';

console.log('Using API URL:', API_URL);
console.log('Using Interviewer API URL:', INTERVIEWER_API_URL);
console.log('Using Interviewer WS URL:', INTERVIEWER_WS_URL);
console.log('Using UnrealSpeech Voice:', UNREALSPEECH_DEFAULT_VOICE);

export default API_URL;
