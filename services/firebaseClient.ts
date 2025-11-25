
// services/firebaseClient.ts
// Firebase initialization: Firestore + Auth

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Config can use Vite env vars, falling back to your existing project values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBZVWa-MnNo8JUI76YwfiT5IjG1Fm1-I_8",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "auto-sales-tracker-944ef.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "auto-sales-tracker-944ef",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "auto-sales-tracker-944ef.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "829868412718",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:829868412718:web:50e2929eaebfd10564f4bf",
};

// Avoid re-initializing during HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
