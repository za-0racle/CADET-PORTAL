import { auth, db } from "./config.js"; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * HELPER: GOOGLE DRIVE IMAGE CONVERTER
 * Converts a standard 'view' link into a direct source for <img> tags.
 */
const getDirectDriveLink = (url) => {
    if (!url || url === "N/A" || !url.includes("drive.google.com")) return "images/logo.png";
    const driveId = url.match(/[-\w]{25,}/);
    return driveId ? `https://drive.google.com/thumbnail?id=${driveId[0]}&sz=w500` : "images/logo.png";
};

/**
 * 1. AUTH GUARD & SESSION OBSERVER
 * Monitors the Firebase session and triggers data sync.
 */
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('authGuardLoader');
    const wrapper = document.getElementById('dashboardWrapper');

    if (!user) {
        console.warn("No active session found. Redirecting to login...");
        window.location.href = 'login.html';
    } else {
        try {
            console.log("Authentication verified. UID:", user.uid);
            
            // Reference the specific Firestore document named after the user's UID
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log("Personnel data synchronized.");
                
                populateDashboard(data);
                
                // Switch visibility: Hide spinner, show dashboard
                if (loader) loader.style.display = 'none';
                if (wrapper) wrapper.style.display = 'flex';
            } else {
                console.error("Critical: Document missing for authenticated UID.");
                alert("Personnel profile not found. Please re-activate your account.");
                window.location.href = 'signup.html';
            }
        } catch (error) {
            console.error("Firestore sync failure:", error);
            alert("Database Error: Access to your profile was denied by security rules.");
        }
    }
});

/**
 * 2. UI POPULATION ENGINE
 * Maps Firestore clean keys to HTML elements.
 */
function populateDashboard(data) {
    const setUI = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || "---";
    };

    // --- SIDEBAR PROFILE ---
    setUI('profileName', `${data.surname || ''} ${data.firstName || ''}`);
    setUI('profileRank', data.rank || "Commissioned Officer");
    
    // Automatic Photo Loading with Drive Fix
    const photoEl = document.getElementById('profilePhoto');
    if (photoEl) {
        photoEl.src = getDirectDriveLink(data.passportUrl);
    }

    // --- HEADER INFO ---
    setUI('serviceNumDisplay', `Service Number: ${data.serviceNumber || 'PENDING'}`);

    // --- QUICK DATA CARDS (TOP GRID) ---
    setUI('dataState', data.state);
    setUI('dataArea', data.area);
    setUI('dataDept', data.department);
    setUI('dataPost', data.postHeld || "Member");
    setUI('dataPhone', data.phone);
    setUI('dataEmail', data.email);

    // --- PERSONNEL RECORDS (BOTTOM TABLE) ---
    setUI('full_name', `${data.firstName || ''} ${data.otherName || ''} ${data.surname || ''}`);
    setUI('full_address', data.address);
    setUI('full_occupation', data.occupation);
    setUI('full_nok', `${data.nokName || ''} (${data.nokRelation || ''})`);
    setUI('full_uid', data.uniqueID);

    // --- PDF DOWNLOAD SYSTEM ---
    const pdfLink = document.getElementById('downloadPDF');
    if (pdfLink) {
        if (data.pdfUrl && data.pdfUrl.startsWith('http')) {
            pdfLink.href = data.pdfUrl;
            pdfLink.style.opacity = "1";
            pdfLink.style.pointerEvents = "auto";
            pdfLink.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>Download Official Form</span>`;
        } else {
            pdfLink.style.opacity = "0.5";
            pdfLink.style.pointerEvents = "none";
            pdfLink.innerHTML = `<i class="fa-solid fa-clock"></i> <span>Form Status: Generating...</span>`;
        }
    }
}

/**
 * 3. LOGOUT LOGIC
 * Safely destroys the session and clears local tokens.
 */
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to end your secure session?")) {
                signOut(auth).then(() => {
                    console.log("Session terminated.");
                    window.location.href = 'login.html';
                }).catch((error) => {
                    alert("Error terminating session: " + error.message);
                });
            }
        });
    }
});