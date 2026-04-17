// js/auth.js
import { auth, db, SCRIPT_URL, getShadowEmail } from "./config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * 1. FIRESTORE CONNECTIVITY TEST
 * This runs once to ensure your rules and connection are active.
 */
async function verifyFirestore() {
    try {
        await setDoc(doc(db, "system_checks", "last_run"), {
            status: "Online",
            time: new Date().toISOString()
        });
        console.log("✅ FIRESTORE STATUS: CONNECTED");
    } catch (e) {
        console.error("❌ FIRESTORE STATUS: CONNECTION ERROR", e);
    }
}
verifyFirestore();

// Global flag to prevent Auth Guard from redirecting before Firestore sync is finished
window.isProcessingSignup = false;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // ==========================================
    // 2. LOGIN LOGIC (Shadow Email Strategy)
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const serviceNum = document.getElementById('loginServiceNum').value.trim();
            const pass = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('button');
            const errorBox = document.getElementById('errorMessage');

            btn.classList.add('loading');
            btn.disabled = true;
            if (errorBox) errorBox.style.display = 'none';

            try {
                const shadowEmail = getShadowEmail(serviceNum);
                console.log("Authenticating:", serviceNum);
                await signInWithEmailAndPassword(auth, shadowEmail, pass);
                // On Success: onAuthStateChanged (section 4) handles the redirect to dashboard.html
            } catch (error) {
                btn.classList.remove('loading');
                btn.disabled = false;
                if (errorBox) {
                    errorBox.style.display = 'block';
                    errorBox.innerText = "Access Denied: Invalid Service Number or Password.";
                }
                console.error("Login Failure:", error.code);
            }
        });
    }

    // ==========================================
    // 3. SIGNUP (PORTAL ACTIVATION) LOGIC
    // ==========================================
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const serviceNum = document.getElementById('signupServiceNum').value.trim();
            const pass = document.getElementById('signupPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;
            const btn = signupForm.querySelector('button');
            const msgBox = document.getElementById('messageBox');

            if (pass !== confirmPass) {
                alert("Error: Passwords do not match.");
                return;
            }

            btn.classList.add('loading');
            btn.disabled = true;
            if (msgBox) msgBox.style.display = 'none';

            try {
                // STEP A: Fetch data from Google Sheets via Apps Script
                console.log("Verifying Service Number with National Command...");
                const response = await fetch(`${SCRIPT_URL}?action=searchByServiceNumber&serviceNumber=${encodeURIComponent(serviceNum)}`);
                const result = await response.json();

                if (result.status !== "success") {
                    throw new Error("Service Number not found. Ensure you have been officially validated.");
                }

                // Activate safety flag to block Auth Guard redirect
                window.isProcessingSignup = true;

                // STEP B: Create account in Firebase Auth
                const shadowEmail = getShadowEmail(serviceNum);
                const userCred = await createUserWithEmailAndPassword(auth, shadowEmail, pass);
                const uid = userCred.user.uid;

                console.log("User Created. UID:", uid);

                // STEP C: Comprehensive Mapping (Syncing all 26 columns to Firestore)
                const s = result.data;
                const profileData = {
                    firstName: s["First Name"] || "",
                    surname: s["Surname"] || "",
                    otherName: s["Other Name"] || "",
                    address: s["Residential Address"] || "",
                    occupation: s["Occupation"] || "",
                    gender: s["Gender"] || "",
                    phone: s["Phone Number"] || "",
                    email: s["Email"] || s["Email "] || "", // Account for possible space in header
                    serviceNumber: serviceNum,
                    rank: s["Rank"] || "Officer",
                    department: s["Department"] || "",
                    postHeld: s["Post Held"] || "",
                    state: s["State Command"] || "",
                    area: s["Area Command"] || "",
                    nokName: s["NOK Full Name"] || "",
                    nokRelation: s["NOK Relationship"] || s["NOK relationship"] || "",
                    nokPhone: s["NOK Phone Number"] || "",
                    nokAddress: s["NOK Residential Address"] || "",
                    passportUrl: s["Passport URL"] || "N/A",
                    pdfUrl: s["PDF URL"] || "",
                    uniqueID: s["Unique ID"] || "",
                    memberType: s["Member Type"] || "Officer",
                    userId: uid, // Stored to match Security Rules
                    activatedAt: new Date().toISOString()
                };

                // STEP D: Save to Firestore (Named after the new UID)
                console.log("Mirroring Personnel Record to Cloud...");
                await setDoc(doc(db, "users", uid), profileData);
                
                console.log("Sync Complete.");

                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.color = "green";
                    msgBox.innerText = "Portal Activated! Preparing Dashboard...";
                }

                // Final Step: Redirect after UI confirmation
                setTimeout(() => {
                    window.isProcessingSignup = false; // Release the flag
                    window.location.href = 'dashboard.html';
                }, 2000);

            } catch (error) {
                window.isProcessingSignup = false; 
                btn.classList.remove('loading');
                btn.disabled = false;
                if (msgBox) {
                    msgBox.style.display = 'block';
                    msgBox.style.color = "red";
                    msgBox.innerText = error.message;
                }
                console.error("Activation Error:", error);
            }
        });
    }
});

/**
 * 4. AUTH GUARD & NAVIGATION OBSERVER
 * Monitors session state and handles secure redirects.
 */
onAuthStateChanged(auth, (user) => {
    // If the user is currently signing up, the observer must wait for setDoc to finish.
    if (window.isProcessingSignup) return;

    const path = window.location.pathname;
    const isDashboard = path.includes('dashboard.html');
    const isAuthPage = path.includes('login.html') || path.includes('signup.html');

    if (user) {
        console.log("Session active:", user.email);
        // If logged in but on login/signup page, move to dashboard
        if (isAuthPage) window.location.href = 'dashboard.html';
    } else {
        console.log("No active session.");
        // If not logged in but trying to view dashboard, kick to login
        if (isDashboard) window.location.href = 'login.html';
    }

    // Hide initial auth loader if it exists in the HTML
    const loader = document.getElementById('authGuardLoader');
    if (loader) loader.style.display = 'none';
});

/**
 * 5. GLOBAL LOGOUT
 * Destroys the Firebase session token and clears the browser state.
 */
window.handleLogout = () => {
    if (confirm("Are you sure you want to exit the CADETI secure portal?")) {
        signOut(auth).then(() => {
            console.log("Session destroyed.");
            window.location.href = 'login.html';
        }).catch((err) => {
            console.error("Logout error:", err);
        });
    }
};