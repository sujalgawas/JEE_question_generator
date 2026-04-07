// This code reads the correct URL from the .env files
// and makes it available to the rest of your app.
let API_URL = process.env.REACT_APP_API_URL;

// If we are accessing the site via a local network IP (e.g. 192.168.x.x), 
// we should rewrite 'localhost' in the API URL to match the current hostname.
if (API_URL && API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    API_URL = API_URL.replace('localhost', window.location.hostname);
}

console.log('Using API URL:', API_URL);
export default API_URL;