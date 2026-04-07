// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from './serviceAccountKey.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
