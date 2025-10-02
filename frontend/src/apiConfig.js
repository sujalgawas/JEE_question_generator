// This code reads the correct URL from the .env files
// and makes it available to the rest of your app.
const API_URL = process.env.REACT_APP_API_URL;
console.log('Using API URL:', API_URL);
export default API_URL;