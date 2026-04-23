// js/admin.js
import { auth, db, SCRIPT_URL, getShadowEmail } from "./config.js";
import { 
    onAuthStateChanged, signOut, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, getDoc, getDocs, collection, query, where, addDoc, setDoc, serverTimestamp, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * 1. GLOBAL STATE
 */
const RANK_LIST = ["Private", "Lance Corporal", "Corporal", "Sergeant", "Staff Sergeant", "Assistant Inspector", "Deputy Inspector", "Inspector", "Assistant Superintendent II", "Assistant Superintendent I", "Deputy Superintendent", "Superintendent", "Chief Superintendent", "Assistant Commander", "Deputy Commander", "Commander", "Assistant Brigade Commander", "Deputy Brigade Commander", "Brigade Commander"];
const DEPT_LIST = ["Training & Doctrine", "Cadet Police", "Lion Striker Squad", "Cadet Special Squad", "Media & Publications", "Band", "Medical", "Regular"];

let allData = []; 
let currentUserRole = null;
let currentAdminState = null;

/**
 * 2. AUTH GUARD
 */
onAuthStateChanged(auth, async (user) => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');

    if (!user) {
        if (loginSection) loginSection.style.display = 'flex';
        if (dashboardSection) dashboardSection.style.display = 'none';
    } else {
        try {
            const adminRef = doc(db, "admins", user.uid);
            const adminSnap = await getDoc(adminRef);

            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                if (adminData.status !== "active") { 
                    alert("Account Suspended. Contact National HQ."); 
                    signOut(auth); 
                    return; 
                }

                currentUserRole = adminData.role; 
                currentAdminState = adminData.assignedState || null;

                setupUIForRole();
                
                fetchData().catch(e => console.error("Registry error:", e));
                loadEnrollments().catch(e => console.error("Enrollment error:", e));
                loadPromotions().catch(e => console.error("Promotion error:", e));
                loadResetTickets().catch(e => console.error("Reset error:", e));
                
                if(currentUserRole === 'super') {
                    loadCourseManager().catch(e => console.error("LMS error:", e));
                    loadAdminManager().catch(e => console.error("Admin list error:", e));
                }

                if (loginSection) loginSection.style.display = 'none';
                if (dashboardSection) dashboardSection.style.display = 'flex';
            } else {
                alert("Unauthorized: No Admin Record Found.");
                signOut(auth); 
            }
        } catch (error) { 
            console.error("Auth Guard Error:", error); 
        }
    }
});

/**
 * 3. LOGIN LOGIC
 */
window.handleLogin = async () => {
    const userVal = document.getElementById('adminUser').value.trim();
    const passVal = document.getElementById('adminPass').value;
    const btn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('loginError');

    if (!userVal || !passVal) {
        if(errorMsg) errorMsg.innerText = "Please fill all fields.";
        return;
    }

    btn.disabled = true;
    const btnText = btn.querySelector('.btn-text');
    if (btnText) btnText.innerText = "AUTHENTICATING...";
    if (errorMsg) errorMsg.innerText = "";

    try {
        const loginEmail = userVal.includes('@') ? userVal : getShadowEmail(userVal);
        await signInWithEmailAndPassword(auth, loginEmail, passVal);
    } catch (error) {
        console.error("Login Error:", error);
        btn.disabled = false;
        if (btnText) btnText.innerText = "AUTHENTICATE ACCESS";
        if (errorMsg) errorMsg.innerText = "Invalid Service Number or Password.";
    }
};

/**
 * 4. COMPONENT LOADERS
 */

// UPDATED: SECURITY HUB LOADER (Handles Name and Contact Email)
async function loadResetTickets() {
    const tbody = document.getElementById('resetTicketsBody');
    if (!tbody) return;
    
    const snap = await getDocs(collection(db, "password_resets"));
    tbody.innerHTML = "";
    
    if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px;">No active reset requests.</td></tr>`;
        return;
    }

    snap.forEach(docSnap => {
        const t = docSnap.data();
        const tid = docSnap.id;
        
        // Only show pending tickets
        if(t.status === 'pending') {
            const dateStr = t.requestedAt ? t.requestedAt.toDate().toLocaleString() : "N/A";
            
            tbody.innerHTML += `
                <tr>
                    <td>
                        <div style="text-align:left">
                            <b>${t.officerName || 'Unknown'}</b><br>
                            <small style="color:#666">${t.contactEmail || 'No Email'}</small>
                        </div>
                    </td>
                    <td><code style="background:#eee; padding:2px 5px;">${t.serviceNumber}</code></td>
                    <td><small>${dateStr}</small></td>
                    <td><span class="rank-badge badge-red">PENDING</span></td>
                    <td>
                        <button class="cmd-btn-small" style="background:#004d00" 
                            onclick="window.approveReset('${tid}', '${t.contactEmail}', '${t.officerName}', '${t.serviceNumber}')">
                            APPROVE & SEND
                        </button>
                    </td>
                </tr>`;
        }
    });
}

async function loadPromotions() {
    const tbody = document.getElementById('promotionBody');
    if (!tbody) return;
    let q = collection(db, "promotion_queue");
    if (currentUserRole === 'state') q = query(q, where("state", "==", currentAdminState));
    const snap = await getDocs(q);
    tbody.innerHTML = snap.empty ? `<tr><td colspan="5" style="text-align:center; padding:15px;">Queue is clear.</td></tr>` : "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        tbody.innerHTML += `<tr><td><b>${p.fullName}</b></td><td>${p.currentRank}</td><td><span class="rank-badge badge-gold">${p.proposedRank}</span></td><td>${p.state}</td><td>${currentUserRole === 'super' ? `<button class="cmd-btn-small" onclick="window.approvePromotion('${docSnap.id}', '${p.uniqueID}', '${p.proposedRank}')">APPROVE</button>` : `<span class="rank-badge badge-red">PENDING HQ</span>`}</td></tr>`;
    });
}

async function loadEnrollments() {
    const tbody = document.getElementById('enrollmentBody');
    if(!tbody) return;
    let q = collection(db, "enrollments");
    if(currentUserRole === 'state') q = query(q, where("state", "==", currentAdminState));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const isDone = d.status === 'completed';
        tbody.innerHTML += `<tr><td><b>${d.fullName}</b></td><td>${d.courseTitle}</td><td>${d.dateApplied?.toDate().toLocaleDateString()}</td><td><span class="rank-badge ${isDone ? 'badge-green':'badge-red'}">${d.status}</span></td><td>${isDone ? 'Awarded' : `<button class="cmd-btn-small" onclick="window.updateEnrollment('${docSnap.id}', 'completed')">APPROVE</button>`}</td></tr>`;
    });
}

async function loadAdminManager() {
    const tbody = document.getElementById('adminUserBody');
    if (!tbody) return;
    const snap = await getDocs(collection(db, "admins"));
    tbody.innerHTML = "";
    snap.forEach(docSnap => {
        const a = docSnap.data();
        const isSuspended = a.status === 'suspended';
        tbody.innerHTML += `<tr><td><b>${a.name}</b></td><td>${a.assignedState || 'National'}</td><td>${a.role}</td><td><span class="rank-badge ${isSuspended ? 'badge-red' : 'badge-green'}">${a.status}</span></td><td><button class="action-icon" style="background:orange; color:white; border:none; padding:5px; border-radius:4px;" onclick="window.updateAdminStatus('${docSnap.id}', '${isSuspended ? 'active':'suspended'}')"><i class="fa-solid fa-user-slash"></i></button></td></tr>`;
    });
}

async function loadCourseManager() {
    const grid = document.getElementById('courseListGrid');
    if(!grid) return;
    const snap = await getDocs(collection(db, "courses"));
    grid.innerHTML = "";
    snap.forEach(docSnap => {
        const c = docSnap.data();
        grid.innerHTML += `<div class="kpi-card" style="background:white; color:black; border-left:4px solid green; padding:10px; margin-bottom:10px; text-align:left;"><small>Rank Req: ${c.minRankLevel}</small><h4 style="margin:5px 0;">${c.title}</h4><button class="cmd-btn-small" style="background:#333;" onclick="window.deleteCourse('${docSnap.id}')">REMOVE</button></div>`;
    });
}

/**
 * 5. REGISTRY SYNC
 */
async function fetchData() {
    const tbody = document.getElementById("tableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Syncing Registry...</td></tr>`;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getAdminData`);
        let data = await response.json();
        if (currentUserRole === 'state') data = data.filter(item => item["State Command"] === currentAdminState);
        allData = data;
        populateGlobalFilters(data);
        calculateStats(data);
        renderTable(data);
    } catch (error) { console.error(error); }
}

function renderTable(data) {
    const tbody = document.getElementById("tableBody");
    if(!tbody) return;
    tbody.innerHTML = "";
    [...data].reverse().forEach(item => {
        const tr = document.createElement("tr");
        const rankClass = (item["Rank"] || '').toLowerCase().includes('commander') ? 'badge-red' : 'badge-green';
        const uid = item["Unique ID"] || "N/A";
        const pdf = item["PDF URL"] || "#";
        tr.innerHTML = `<td>${item["Timestamp"]?.split('T')[0]}</td><td><b>${uid}</b></td><td>${item["Surname"].toUpperCase()}, ${item["First Name"]}</td><td><span class="rank-badge ${rankClass}">${item["Rank"]}</span></td><td><small>${item["Department"]}</small></td><td>${item["State Command"]}</td><td><div style="display:flex; gap:5px;"><button class="action-icon" onclick="window.openEditModal('${uid}')"><i class="fa-solid fa-user-pen"></i></button><a href="${pdf}" target="_blank" class="pdf-btn">PDF</a></div></td>`;
        tbody.appendChild(tr);
    });
}

/**
 * 6. GLOBAL WINDOW BINDINGS
 */

// UPDATED ACTION: SECURITY HUB APPROVAL (Calls Apps Script + Updates Firestore)
window.approveReset = async (ticketId, email, name, serviceNo) => {
    if (!confirm(`Authorize password recovery for Officer ${name}? \nAn official email will be sent to ${email}.`)) return;

    try {
        // 1. Handshake with Apps Script to send the email
        const apiUrl = `${SCRIPT_URL}?action=sendResetInstructions&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&serviceNo=${encodeURIComponent(serviceNo)}`;
        
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (result.status === "success") {
            // 2. Mark as resolved in Firestore
            await updateDoc(doc(db, "password_resets", ticketId), { 
                status: "resolved",
                resolvedAt: serverTimestamp()
            });
            alert("Success: Recovery instructions transmitted.");
            loadResetTickets(); // Refresh table
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Reset Workflow Error:", error);
        alert("System Error: Failed to transmit instructions.");
    }
};

window.approvePromotion = async (queueId, officerID, newRank) => {
    const q = query(collection(db, "users"), where("uniqueID", "==", officerID));
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(doc(db, "users", snap.docs[0].id), { rank: newRank });
    } else {
        await setDoc(doc(db, "users", officerID), { uniqueID: officerID, rank: newRank }, { merge: true });
    }
    await deleteDoc(doc(db, "promotion_queue", queueId));
    loadPromotions(); fetchData();
};

window.updateEnrollment = async (id, s) => { await updateDoc(doc(db, "enrollments", id), { status: s }); loadEnrollments(); };
window.updateAdminStatus = async (id, s) => { await updateDoc(doc(db, "admins", id), { status: s }); loadAdminManager(); };
window.deleteCourse = async (id) => { if(confirm("Delete?")) { await deleteDoc(doc(db, "courses", id)); loadCourseManager(); } };
window.logout = () => signOut(auth).then(() => window.location.reload());
window.openModal = (id) => { document.getElementById(id).style.display = 'flex'; };
window.closeModal = (id) => { document.getElementById(id).style.display = 'none'; };
window.fetchData = fetchData;

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(`section-${tabId}`);
    if(target) target.style.display = 'block';
    const map = { 'database': 'tab-db', 'resets': 'tab-resets', 'promotions': 'tab-promo', 'enrollments': 'tab-enroll', 'graduation': 'tab-grad', 'courses': 'tab-courses', 'admins': 'tab-admins' };
    if(map[tabId]) document.getElementById(map[tabId]).classList.add('active');
};

window.openEditModal = (uid) => {
    const officer = allData.find(o => (o["Unique ID"] || o["Service Number"]) === uid);
    if (!officer) return;
    document.getElementById('editUid').value = uid;
    document.getElementById('editPost').value = officer["Post Held"] || "";
    document.getElementById('editDept').innerHTML = DEPT_LIST.map(d => `<option value="${d}">${d}</option>`).join('');
    document.getElementById('editDept').value = officer["Department"] || "Regular";
    document.getElementById('editRank').innerHTML = RANK_LIST.map(r => `<option value="${r}">${r}</option>`).join('');
    document.getElementById('editRank').value = officer["Rank"];
    window.openModal('editModal');
};

window.initCourseModal = () => {
    const cRank = document.getElementById('cRank');
    if (cRank && cRank.options.length <= 1) RANK_LIST.forEach((r, i) => cRank.add(new Option(r, i + 1)));
    document.getElementById('cDeptsList').innerHTML = DEPT_LIST.map(d => `<label class="check-item"><input type="checkbox" name="eligibleDepts" value="${d}"> ${d}</label>`).join('');
    const states = [...new Set(allData.map(item => item["State Command"]))].sort();
    document.getElementById('cStatesList').innerHTML = states.map(s => `<label class="check-item"><input type="checkbox" name="eligibleStates" value="${s}"> ${s}</label>`).join('');
    window.openModal('courseModal');
};

/**
 * 7. THE PERSONNEL UPDATE HANDLER
 */
async function submitPersonnelUpdate(e) {
    e.preventDefault();
    const uid = document.getElementById('editUid').value;
    const officer = allData.find(o => (o["Unique ID"] || o["Service Number"]) === uid);
    const newRank = document.getElementById('editRank').value;

    const data = {
        postHeld: document.getElementById('editPost').value,
        department: document.getElementById('editDept').value
    };

    try {
        const q = query(collection(db, "users"), where("uniqueID", "==", uid));
        const snap = await getDocs(q);
        
        let docId = uid; 
        if (!snap.empty) docId = snap.docs[0].id;

        if (currentUserRole === 'super') {
            await setDoc(doc(db, "users", docId), { ...data, rank: newRank }, { merge: true });
            alert("Record Updated.");
        } else {
            await setDoc(doc(db, "users", docId), data, { merge: true });
            if (newRank !== officer["Rank"]) {
                await addDoc(collection(db, "promotion_queue"), {
                    fullName: `${officer["Surname"]} ${officer["First Name"]}`,
                    uniqueID: uid,
                    currentRank: officer["Rank"],
                    proposedRank: newRank,
                    state: currentAdminState,
                    recommender: auth.currentUser.uid,
                    timestamp: serverTimestamp()
                });
                alert("Rank Recommendation Sent.");
            } else {
                alert("Record Updated.");
            }
        }
    } catch (err) {
        console.error(err);
        alert("Permission Error.");
    } finally {
        window.closeModal('editModal');
        fetchData();
        loadPromotions();
    }
}

/**
 * 8. LIFECYCLE
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.addEventListener('click', window.handleLogin);
    
    const mToggle = document.getElementById('mobileToggle');
    if(mToggle) mToggle.addEventListener('click', () => document.querySelector('.cmd-sidebar').classList.toggle('active'));

    const pForm = document.getElementById('editOfficerForm');
    if(pForm) pForm.addEventListener('submit', submitPersonnelUpdate);
});

function calculateStats(data) {
    const totalEl = document.getElementById('statTotal');
    const recruitEl = document.getElementById('statRecruits');
    if(totalEl) totalEl.innerText = data.length;
    if(recruitEl) recruitEl.innerText = data.filter(item => (item["Unique ID"] && item["Unique ID"].startsWith("REC/")) || (item["Member Category"] === "Recruit")).length;
}

function populateGlobalFilters(data) {
    const states = [...new Set(data.map(item => item["State Command"]))].sort();
    const fState = document.getElementById("filterState");
    if (fState && fState.options.length <= 1) states.forEach(s => fState.add(new Option(s, s)));
    const nState = document.getElementById("newAdminState");
    if (nState) { nState.innerHTML = '<option value="">Select State</option>'; states.forEach(s => nState.add(new Option(s, s))); }
    const fRank = document.getElementById("filterRank");
    if (fRank && fRank.options.length <= 1) RANK_LIST.forEach(r => fRank.add(new Option(r, r)));
    const fDept = document.getElementById("filterDept");
    if (fDept && fDept.options.length <= 1) DEPT_LIST.forEach(d => fDept.add(new Option(d, d)));
}

function setupUIForRole() {
    const superTools = document.getElementById('superAdminTools');
    const roleNameEl = document.getElementById('adminRoleName');
    const scopeEl = document.getElementById('adminScope');
    
    if(roleNameEl) roleNameEl.innerText = currentUserRole.toUpperCase() + " ADMIN";
    if(scopeEl) scopeEl.innerText = currentUserRole === 'super' ? "NATIONAL HQ" : `${currentAdminState.toUpperCase()} COMMAND`;
    if (currentUserRole === 'super' && superTools) superTools.style.display = 'block';
    
    const pLabel = document.querySelector('.promotion-box label');
    if (pLabel) pLabel.innerText = currentUserRole === 'super' ? "OFFICIAL PROMOTION (SUPER)" : "RECOMMEND PROMOTION (STATE)";
}

window.applyFilters = () => {
    const sVal = document.getElementById("filterState")?.value;
    const rVal = document.getElementById("filterRank")?.value;
    const dVal = document.getElementById("filterDept")?.value;
    const search = document.getElementById("searchInput")?.value.toLowerCase();
    const filtered = allData.filter(i => {
        const mState = sVal ? i["State Command"] === sVal : true;
        const mRank = rVal ? i["Rank"] === rVal : true;
        const mDept = dVal ? i["Department"] === dVal : true;
        const namePool = `${i["Surname"]} ${i["First Name"]}`.toLowerCase();
        const mSearch = namePool.includes(search) || (i["Unique ID"] || '').toLowerCase().includes(search);
        return mState && mRank && mDept && mSearch;
    });
    renderTable(filtered);
};

/**
 * ACTION: APPROVE & RESTORE ACCESS
 * Generates a random temp password and triggers the recovery email
 */
window.approveReset = async (ticketId, email, name, serviceNo) => {
    if (!confirm(`Restore access for ${name}? \nA temporary password will be sent to ${email}.`)) return;

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "RESTORING...";
    btn.disabled = true;

    // Generate a random 8-character temporary password
    const tempPass = "CAD-" + Math.random().toString(36).slice(-5).toUpperCase();

    try {
        // 1. Call Apps Script to Update Firebase & Send Email
        const apiUrl = `${SCRIPT_URL}?action=sendResetInstructions&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&serviceNo=${encodeURIComponent(serviceNo)}&tempPass=${tempPass}`;
        
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (result.status === "success") {
            // 2. Mark ticket as resolved in Firestore
            await updateDoc(doc(db, "password_resets", ticketId), { 
                status: "resolved",
                tempPasswordUsed: tempPass, // Logged for admin reference if needed
                resolvedAt: serverTimestamp()
            });
            alert(`Success! Officer ${name} has been sent temporary credentials.`);
            loadResetTickets(); // Refresh table
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Restore Error:", error);
        alert("Failed to restore access. Error: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};