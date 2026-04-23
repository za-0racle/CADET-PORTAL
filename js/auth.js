// js/auth.js
import { auth, db, SCRIPT_URL, getShadowEmail } from "./config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, setDoc, collection, addDoc, serverTimestamp, getDoc // Added getDoc here
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Global flag to prevent Auth Guard from redirecting before Firestore sync is finished
window.isProcessingSignup = false;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Password Reset Elements
    const forgotLink = document.getElementById('forgotPasswordLink');
    const resetModal = document.getElementById('resetModal');
    const closeResetBtn = document.getElementById('closeResetBtn');
    const submitResetBtn = document.getElementById('submitResetBtn');
    
    // Recovery Elements for Option B
    const resetServiceInp = document.getElementById('resetServiceNum');
    const nameDisplay = document.getElementById('nameDisplayArea');
    const officerNameText = document.getElementById('fetchedOfficerName');
    const emailGroup = document.getElementById('contactEmailGroup');
    const resetEmailInp = document.getElementById('resetContactEmail');
    const resetMessage = document.getElementById('resetMessage');

    // ==========================================
    // 1. LOGIN LOGIC
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
                await signInWithEmailAndPassword(auth, shadowEmail, pass);
                // Auth Guard below handles the redirect based on role
            } catch (error) {
                btn.classList.remove('loading');
                btn.disabled = false;
                if (errorBox) {
                    errorBox.style.display = 'block';
                    errorBox.innerText = "Access Denied: Invalid Service Number or Password.";
                }
            }
        });
    }

    // ==========================================
    // 2. PASSWORD RECOVERY LOGIC (OPTION B)
    // ==========================================
    if (forgotLink) {
        forgotLink.onclick = () => {
            resetModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        };
    }

    if (closeResetBtn) {
        closeResetBtn.onclick = () => {
            resetModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    }

    if (resetServiceInp) {
        resetServiceInp.addEventListener('change', async () => {
            const sn = resetServiceInp.value.trim().toUpperCase();
            if (sn.length < 5) return; 

            resetMessage.style.color = "#666";
            resetMessage.innerText = "🔍 Searching Registry...";

            try {
                const response = await fetch(`${SCRIPT_URL}?action=searchByServiceNumber&serviceNumber=${encodeURIComponent(sn)}`);
                const result = await response.json();

                if (result.status === "success") {
                    const fullName = `${result.data["First Name"]} ${result.data["Surname"]}`;
                    officerNameText.innerText = fullName;
                    nameDisplay.style.display = "block";
                    emailGroup.style.display = "block";
                    submitResetBtn.disabled = false;
                    submitResetBtn.style.opacity = "1";
                    resetMessage.innerText = "";
                    if(result.data["Email"]) resetEmailInp.value = result.data["Email"];
                } else {
                    resetMessage.style.color = "red";
                    resetMessage.innerText = "❌ Service Number not found.";
                    nameDisplay.style.display = "none";
                    emailGroup.style.display = "none";
                    submitResetBtn.disabled = true;
                    submitResetBtn.style.opacity = "0.5";
                }
            } catch (e) {
                resetMessage.innerText = "⚠️ Connection Error.";
            }
        });
    }

    if (submitResetBtn) {
        submitResetBtn.addEventListener('click', async () => {
            const serviceNum = resetServiceInp.value.trim().toUpperCase();
            const officerName = officerNameText.innerText;
            const contactEmail = resetEmailInp.value.trim();
            const btnText = submitResetBtn.querySelector('.btn-text');
            const spinner = submitResetBtn.querySelector('.spinner');

            if (!contactEmail) {
                resetMessage.style.color = "red";
                resetMessage.innerText = "Error: Contact email is required.";
                return;
            }

            submitResetBtn.disabled = true;
            spinner.style.display = 'block';
            btnText.innerText = "SENDING...";

            try {
                await addDoc(collection(db, "password_resets"), {
                    serviceNumber: serviceNum,
                    officerName: officerName,
                    contactEmail: contactEmail,
                    status: "pending",
                    requestedAt: serverTimestamp()
                });

                resetMessage.style.color = "green";
                resetMessage.innerText = "✅ Request Received! National Command will contact you at: " + contactEmail;
                resetServiceInp.value = "";

                setTimeout(() => { 
                    resetModal.style.display = 'none'; 
                    document.body.style.overflow = 'auto';
                    submitResetBtn.disabled = true;
                    submitResetBtn.style.opacity = "0.5";
                    spinner.style.display = 'none';
                    btnText.innerText = "SUBMIT REQUEST";
                    nameDisplay.style.display = "none";
                    emailGroup.style.display = "none";
                }, 6000);

            } catch (error) {
                resetMessage.style.color = "red";
                resetMessage.innerText = "Failed to log request.";
                submitResetBtn.disabled = false;
                spinner.style.display = 'none';
                btnText.innerText = "SUBMIT REQUEST";
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

            try {
                const response = await fetch(`${SCRIPT_URL}?action=searchByServiceNumber&serviceNumber=${encodeURIComponent(serviceNum)}`);
                const result = await response.json();

                if (result.status !== "success") {
                    throw new Error("Service Number not found. Ensure you have been officially validated.");
                }

                window.isProcessingSignup = true;

                const shadowEmail = getShadowEmail(serviceNum);
                const userCred = await createUserWithEmailAndPassword(auth, shadowEmail, pass);
                const uid = userCred.user.uid;

                const s = result.data;
                const profileData = {
                    firstName: s["First Name"] || "",
                    surname: s["Surname"] || "",
                    otherName: s["Other Name"] || "",
                    address: s["Residential Address"] || "",
                    occupation: s["Occupation"] || "",
                    gender: s["Gender"] || "",
                    phone: s["Phone Number"] || "",
                    email: s["Email"] || s["Email "] || "",
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
                    userId: uid,
                    activatedAt: new Date().toISOString()
                };

                await setDoc(doc(db, "users", uid), profileData);
                
                msgBox.style.display = 'block';
                msgBox.style.color = "green";
                msgBox.innerText = "Portal Activated! Preparing Dashboard...";

                setTimeout(() => {
                    window.isProcessingSignup = false;
                    window.location.href = '/dashboard.html';
                }, 2000);

            } catch (error) {
                window.isProcessingSignup = false; 
                btn.classList.remove('loading');
                btn.disabled = false;
                msgBox.style.display = 'block';
                msgBox.style.color = "red";
                msgBox.innerText = error.message;
            }
        });
    }
});

/**
 * 4. AUTH GUARD (Refined with Admin Distinction)
 */
onAuthStateChanged(auth, async (user) => {
    if (window.isProcessingSignup) return;

    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login');
    const isSignupPage = path.includes('signup');
    const isDashboard = path.includes('dashboard');
    const isAdminFile = path.includes('admin.html');
    const isAuthPage = isLoginPage || isSignupPage;

    if (user) {
        console.log("Session active:", user.email);
        
        // ONLY auto-redirect if sitting on Login/Signup
        if (isAuthPage) {
            try {
                // Check if user is an admin
                const adminDoc = await getDoc(doc(db, "admins", user.uid));
                if (adminDoc.exists()) {
                    window.location.href = '/Admin.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            } catch (e) {
                // Fallback to officer dashboard
                window.location.href = '/dashboard.html';
            }
        }
    } else {
        // If logged out and trying to view a protected page, kick to login
        if (isDashboard || isAdminFile) {
            window.location.href = '/login.html';
        }
    }

    const loader = document.getElementById('authGuardLoader');
    if (loader) loader.style.display = 'none';
});

/**
 * 5. GLOBAL LOGOUT
 */
window.handleLogout = () => {
    if (confirm("Are you sure you want to exit the CADETI secure portal?")) {
        signOut(auth).then(() => {
            window.location.href = '/login.html';
        }).catch((err) => {
            console.error("Logout error:", err);
        });
    }
};