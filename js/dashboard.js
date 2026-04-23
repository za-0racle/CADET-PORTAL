// js/dashboard.js
import { auth, db } from "./config.js"; 
import { 
    onAuthStateChanged, 
    signOut, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================
// 1. RANK HIERARCHY MAP
// ==========================================
const rankMapping = {
    "Private": 1, "Lance Corporal": 2, "Corporal": 3, "Sergeant": 4, "Staff Sergeant": 5,
    "Assistant Inspector": 6, "Deputy Inspector": 7, "Inspector": 8, "Assistant Superintendent II": 9,
    "Assistant Superintendent I": 10, "Deputy Superintendent": 11, "Superintendent": 12,
    "Chief Superintendent": 13, "Assistant Commander": 14, "Deputy Commander": 15,
    "Commander": 16, "Assistant Brigade Commander": 17, "Deputy Brigade Commander": 18, "Brigade Commander": 19
};

let currentOfficer = null;

/**
 * HELPER: GOOGLE DRIVE IMAGE CONVERTER
 */
const getDirectDriveLink = (url) => {
    if (!url || url === "N/A" || !url.includes("drive.google.com")) return "/images/logo.png";
    const driveId = url.match(/[-\w]{25,}/);
    return driveId ? `https://drive.google.com/thumbnail?id=${driveId[0]}&sz=w500` : "/images/logo.png";
};

/**
 * 2. AUTH GUARD & MASTER DATA SYNC
 */
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('authGuardLoader');
    const wrapper = document.getElementById('dashboardWrapper');

    if (!user) {
        window.location.href = 'login.html';
    } else {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                currentOfficer = docSnap.data();
                populateProfile(currentOfficer);
                loadLMS(user.uid); // Trigger LMS Engine
                
                if (loader) loader.style.display = 'none';
                if (wrapper) wrapper.style.display = 'flex';
            } else {
                alert("Personnel profile not found. Please activate your account.");
                window.location.href = 'signup.html';
            }
        } catch (error) {
            console.error("Master Sync Failure:", error);
        }
    }
});

/**
 * 3. PROFILE UI POPULATION
 */
function populateProfile(data) {
    const setUI = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || "---";
    };

    document.getElementById('profileName').innerText = `${data.surname || ''} ${data.firstName || ''}`;
    document.getElementById('profileRank').innerText = data.rank || "Officer";
    
    // Check if lmsRank exists (it might be in the LMS tab)
    const lmsRankEl = document.getElementById('lmsRank');
    if (lmsRankEl) lmsRankEl.innerText = data.rank || "Officer";
    
    const photoEl = document.getElementById('profilePhoto');
    if (photoEl) photoEl.src = getDirectDriveLink(data.passportUrl);

    setUI('serviceNumDisplay', `Service Number: ${data.serviceNumber}`);
    setUI('dataState', data.state);
    setUI('dataArea', data.area);
    setUI('dataDept', data.department);
    setUI('dataPost', data.postHeld || "Member");
    setUI('dataPhone', data.phone);
    setUI('dataEmail', data.email);

    setUI('full_name', `${data.firstName} ${data.otherName || ''} ${data.surname}`);
    setUI('full_address', data.address);
    setUI('full_occupation', data.occupation);
    setUI('full_nok', `${data.nokName} (${data.nokRelation})`);
    setUI('full_uid', data.uniqueID);

    const pdfLink = document.getElementById('downloadPDF');
    if (pdfLink && data.pdfUrl) pdfLink.href = data.pdfUrl;
}

/**
 * 4. LMS ENGINE (Courses, Badges & Grid)
 */
async function loadLMS(uid) {
    const courseGrid = document.getElementById('courseGrid');
    const badgeGallery = document.getElementById('badgeGallery');
    if (!courseGrid || !badgeGallery) return;
    
    try {
        const coursesSnap = await getDocs(collection(db, "courses"));
        const enrollQuery = query(collection(db, "enrollments"), where("officerUID", "==", uid));
        const enrollSnap = await getDocs(enrollQuery);
        
        const myEnrollments = {};
        enrollSnap.forEach(doc => myEnrollments[doc.data().courseID] = doc.data());

        courseGrid.innerHTML = "";
        badgeGallery.innerHTML = "";
        let badgesCount = 0;

        coursesSnap.forEach(courseDoc => {
            const course = courseDoc.data();
            const courseID = courseDoc.id;
            const enrollment = myEnrollments[courseID];

            // Eligibility Logic
            const officerLevel = rankMapping[currentOfficer.rank] || 0;
            const requiredLevel = course.minRankLevel || 1; 
            
            const depts = Array.isArray(course.eligibleDepts) ? course.eligibleDepts : (course.eligibleDepts || "").split(',').map(d => d.trim());
            const isDeptEligible = depts.includes("All") || depts.includes(currentOfficer.department);
            const isRankEligible = officerLevel >= requiredLevel;
            const isUnlocked = isRankEligible && isDeptEligible;

            const card = document.createElement('div');
            card.className = `course-card animate-up ${!isUnlocked ? 'locked' : ''}`;
            
            let btnHtml = "";
            if (enrollment) {
                if (enrollment.status === 'completed') {
                    btnHtml = `<button class="course-btn btn-completed" onclick="window.open('${enrollment.certificateUrl}', '_blank')">View Certificate</button>`;
                    badgesCount++;
                    badgeGallery.innerHTML += `
                        <div class="earned-badge active">
                            <div class="badge-icon"><img src="${getDirectDriveLink(course.badgeUrl)}"></div>
                            <span>${course.title}</span>
                        </div>`;
                } else {
                    btnHtml = `<button class="course-btn btn-pending" disabled>HQ Processing</button>`;
                }
            } else {
                btnHtml = isUnlocked 
                    ? `<button class="course-btn btn-register" id="btn-reg-${courseID}">Register Now</button>`
                    : `<button class="course-btn" disabled>Locked</button>`;
            }

            card.innerHTML = `
                <div class="badge-preview"><img src="${getDirectDriveLink(course.badgeUrl)}"></div>
                <h4>${course.title}</h4>
                <p>${course.description}</p>
                <div class="course-meta">
                    <span class="rank-tag">Req: Lvl ${requiredLevel}</span>
                    ${btnHtml}
                </div>
            `;
            courseGrid.appendChild(card);

            const regBtn = document.getElementById(`btn-reg-${courseID}`);
            if (regBtn) regBtn.onclick = () => handleEnroll(courseID, course.title);
        });

        if (badgesCount === 0) badgeGallery.innerHTML = '<p class="empty-msg">Course certificates appear here after completion.</p>';

    } catch (error) {
        console.error("LMS Error:", error);
    }
}

/**
 * 5. ACTION HANDLERS
 */
async function handleEnroll(courseID, courseTitle) {
    if (!confirm(`Apply for ${courseTitle}?`)) return;
    try {
        await addDoc(collection(db, "enrollments"), {
            courseID: courseID,
            courseTitle: courseTitle,
            officerUID: auth.currentUser.uid,
            serviceNumber: currentOfficer.serviceNumber,
            fullName: `${currentOfficer.firstName} ${currentOfficer.surname}`,
            state: currentOfficer.state || "National", 
            status: "applied",
            dateApplied: serverTimestamp()
        });
        alert("Application sent successfully to National Training Command.");
        loadLMS(auth.currentUser.uid); 
    } catch (e) {
        console.error("Enrollment Error:", e);
        alert("Application failed.");
    }
}

// ==========================================
// 6. UI INTERACTIONS & SECURITY SETTINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // A. TAB NAVIGATION
    const profileBtn = document.getElementById('tab-profile-btn');
    const lmsBtn = document.getElementById('tab-lms-btn');
    const profileSec = document.getElementById('profileSection');
    const lmsSec = document.getElementById('lmsSection');
    const pageTitle = document.getElementById('pageTitle');

    if (profileBtn && lmsBtn) {
        profileBtn.onclick = () => {
            lmsSec.style.display = 'none';
            profileSec.style.display = 'block';
            lmsBtn.classList.remove('active');
            profileBtn.classList.add('active');
            pageTitle.innerText = "Personnel Dashboard";
        };
        lmsBtn.onclick = () => {
            profileSec.style.display = 'none';
            lmsSec.style.display = 'block';
            profileBtn.classList.remove('active');
            lmsBtn.classList.add('active');
            pageTitle.innerText = "Learning Center";
        };
    }

    // B. SECURITY MODAL LOGIC (Change Password)
    const securityModal = document.getElementById('securityModal');
    const openSecurityBtn = document.getElementById('openSecurityBtn');
    const closeSecurityBtn = document.getElementById('closeSecurityBtn');
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');

    if (openSecurityBtn) {
        openSecurityBtn.onclick = () => {
            securityModal.style.display = 'flex';
        };
    }

    if (closeSecurityBtn) {
        closeSecurityBtn.onclick = () => {
            securityModal.style.display = 'none';
        };
    }

    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            const currentPass = document.getElementById('currentPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const msg = document.getElementById('securityMsg');
            const spinner = document.getElementById('securitySpinner');

            if (!currentPass || !newPass) {
                msg.style.color = "red";
                msg.innerText = "Error: Current and New passwords required.";
                return;
            }

            // UI Feedback
            updatePasswordBtn.disabled = true;
            if (spinner) spinner.style.display = "inline-block";
            msg.style.color = "#666";
            msg.innerText = "Verifying Identity...";

            try {
                // 1. Re-authenticate user (Security requirement for password change)
                const credential = EmailAuthProvider.credential(user.email, currentPass);
                await reauthenticateWithCredential(user, credential);

                // 2. Perform Update
                await updatePassword(user, newPass);

                msg.style.color = "green";
                msg.innerText = "Success! Password updated.";
                
                // Clear and close
                setTimeout(() => {
                    document.getElementById('currentPassword').value = "";
                    document.getElementById('newPassword').value = "";
                    securityModal.style.display = 'none';
                    updatePasswordBtn.disabled = false;
                    if (spinner) spinner.style.display = "none";
                    msg.innerText = "";
                }, 2500);

            } catch (error) {
                console.error("Security Update Error:", error);
                updatePasswordBtn.disabled = false;
                if (spinner) spinner.style.display = "none";
                msg.style.color = "red";
                
                if (error.code === 'auth/wrong-password') {
                    msg.innerText = "Error: Incorrect current password.";
                } else {
                    msg.innerText = "Update failed. Try logging out and in again.";
                }
            }
        });
    }

    // C. LOGOUT
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("End secure officer session?")) {
                try {
                    await signOut(auth);
                    window.location.href = 'login.html';
                } catch (e) { alert("Error signing out."); }
            }
        });
    }

    // D. SIDEBAR MOBILE TOGGLE
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.onclick = () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        };
        sidebarOverlay.onclick = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    }
});