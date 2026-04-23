// js/config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMIuQlbHvXq518Y7ipnS5iVMs1m2uYME4",
    authDomain: "cadeti-officer-portal.firebaseapp.com",
    projectId: "cadeti-officer-portal",
    storageBucket: "cadeti-officer-portal.firebasestorage.app",
    messagingSenderId: "340417714927",
    appId: "1:340417714927:web:cac5a2cd172c42effa191a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhdZcDwrlYmAJES_2AYNLUnBd7V-kgBWpOqGd0TN7hWGVDnX76asn7JIRb4OYuqZ3vZQ/exec";

// Helper to turn Service Number into Shadow Email
// Example: CAD/OG/OTW/026/001 -> cadogotw026001@cadeti.org
export const getShadowEmail = (serviceNum) => {
    const cleanNum = serviceNum.replace(/\//g, "").toLowerCase().trim();
    return `${cleanNum}@cadeti.org`;
};