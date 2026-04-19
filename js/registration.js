// ==========================================
// 1. CONFIGURATION & GLOBAL STATE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuD0cKtVO891xIA0qp0wm_b3sth9eRE7hbd58coWSpxSY6s3SoT4ZaXiMrK-5RpoChzQ/exec";

let locationsData = {};
let recruitFullData = {}; 
let passportBase64 = "";
let timerStarted = false;
const TIMER_SECONDS = 15;

document.addEventListener('DOMContentLoaded', () => {
    // Basic UI Setup
    initMobileMenu();
    fetchLocations();
    
    const regTypeEl = document.getElementById('regType');
    if (!regTypeEl) return;
    const type = regTypeEl.value;

    // 1. GLOBAL LISTENERS (Works on all 3 pages)
    const form = document.querySelector('form');
    if (form) form.addEventListener('submit', handleFormSubmission);

    const passInput = document.getElementById('passportInput');
    if (passInput) passInput.addEventListener('change', handlePassportUpload);

    const openTCBtn = document.getElementById('openTCBtn');
    if (openTCBtn) openTCBtn.addEventListener('click', startTCTimer);

    const agreeCheck = document.getElementById('agreeCheck');
    if (agreeCheck) {
        agreeCheck.addEventListener('change', function() {
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) submitBtn.disabled = !this.checked;
        });
    }

    // 2. ID GENERATOR LISTENERS (Only for Validation & Revalidation)
    if (type !== "Recruit") {
        const triggers = ['state', 'area', 'intakeYear', 'serialNumber'];
        triggers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', generateDualID);
        });
        const serialInp = document.getElementById('serialNumber');
        if (serialInp) serialInp.addEventListener('input', generateDualID);

        populateRanks();
        populateYears();
    }
});

// ==========================================
// 2. DYNAMIC DROPDOWNS (FIXED STATE/AREA)
// ==========================================

async function fetchLocations() {
    const stateSelect = document.getElementById("state");
    if (!stateSelect) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getLocations`);
        const data = await response.json();
        data.forEach(row => {
            if (!locationsData[row.StateCode]) {
                locationsData[row.StateCode] = { name: row.StateName, areas: {} };
            }
            locationsData[row.StateCode].areas[row.AreaCode] = row.AreaName;
        });
        
        stateSelect.innerHTML = '<option value="">Select State</option>';
        Object.keys(locationsData).forEach(code => {
            stateSelect.add(new Option(`${locationsData[code].name} (${code})`, code));
        });
    } catch (err) { console.error("Location Sync Error:", err); }
}

// Global listener to update Area whenever State changes
document.addEventListener('change', (e) => {
    if (e.target.id === 'state') {
        const areaSelect = document.getElementById("area");
        const stateCode = e.target.value;
        if (!areaSelect || !locationsData[stateCode]) return;

        areaSelect.innerHTML = '<option value="">Select Area</option>';
        const areas = locationsData[stateCode].areas;
        Object.keys(areas).forEach(code => {
            areaSelect.add(new Option(`${areas[code]} (${code})`, code));
        });
    }
});

function populateRanks() {
    const rankEl = document.getElementById('rank');
    if (!rankEl) return;
    const ranks = ["Assistant Brigade Commander", "Commander", "Deputy Commander", "Assistant Commander", "Chief Superintendent", "Superintendent", "Deputy Superintendent", "Assistant Superintendent I", "Assistant Superintendent II", "Inspector", "Deputy Inspector", "Assistant Inspector", "Staff Sergeant", "Sergeant", "Corporal", "Lance Corporal", "Private"];
    rankEl.innerHTML = '<option value="">Select Rank</option>';
    ranks.forEach(r => rankEl.add(new Option(r, r)));
}

function populateYears() {
    const yearEl = document.getElementById('intakeYear');
    if (!yearEl) return;
    const isVal = document.getElementById('regType').value === "Validation";
    const years = isVal ? ["024", "025", "026"] : ["010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026"];
    yearEl.innerHTML = '<option value="">Year</option>';
    years.forEach(y => yearEl.add(new Option(y, y)));
}

// ==========================================
// 3. SEARCH LOGIC (Validation Page)
// ==========================================

window.lookupRecruit = async function() {
    const recruitID = document.getElementById('searchRecruitID').value.trim();
    const lookupBtn = document.getElementById('lookupBtn');
    if (!recruitID) return alert("Enter REC ID");

    lookupBtn.disabled = true;
    lookupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=searchRecruit&id=${encodeURIComponent(recruitID)}`);
        const result = await response.json();

        if (result.status === "success") {
            const raw = result.data;
            const cleanData = {};
            Object.keys(raw).forEach(key => cleanData[key.trim()] = raw[key]);
            recruitFullData = cleanData;

            // Mapping fetched data to Read-Only fields
            const fields = {
                'dispName': `${cleanData["Surname"]}, ${cleanData["First Name"]} ${cleanData["Other Name"] || ""}`,
                'dispPhone': cleanData["Phone Number"],
                'dispEmail': cleanData["Email"] || cleanData["email"],
                'dispGender': cleanData["Gender"],
                'dispAddress': cleanData["Residential Address"],
                'dispOccupation': cleanData["Occupation"],
                'dispDept': cleanData["Department"],
                'dispNokName': cleanData["NOK Full Name"],
                'dispNokPhone': cleanData["NOK Phone Number"]
            };

            for (let id in fields) {
                const el = document.getElementById(id);
                if (el) el.value = fields[id] || "N/A";
            }

            document.getElementById('searchStep').style.display = 'none';
            document.getElementById('validationForm').style.display = 'block';
            startTCTimer();
        } else { alert("Recruit ID not found."); }
    } catch (err) { alert("Fetch error."); }
    finally { lookupBtn.disabled = false; lookupBtn.innerText = "Verify ID"; }
};

// ==========================================
// 4. PASSPORT & ID GENERATION
// ==========================================

function handlePassportUpload(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('passportPreview');
    if (file && file.size <= 5242880) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (preview) preview.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            passportBase64 = event.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    } else { alert("Photo too large (Max 5MB)"); }
}

function generateDualID() {
    const s = document.getElementById('state').value;
    const a = document.getElementById('area').value;
    const y = document.getElementById('intakeYear').value;
    const sn = document.getElementById('serialNumber').value;
    const output = document.getElementById('serviceNumber');

    if (!s || !a || !y || !sn || !output) return;

    const padded = sn.toString().padStart(3, "0");
    const timeCode = ("0000" + (Math.floor(Date.now() / 1000) % 10000)).slice(-4);

    output.value = `CAD/${s}/${a}/${y}/${padded}`;
    window.generatedUniqueID = `${s}${a}${y}${timeCode}${padded}`;
}

// ==========================================
// 5. TIMER & SUBMISSION
// ==========================================

function startTCTimer() {
    const tcArea = document.getElementById('tcArea');
    if (tcArea) tcArea.style.display = 'block';
    if (timerStarted) return;
    timerStarted = true;
    
    let left = TIMER_SECONDS;
    const tick = setInterval(() => {
        left--;
        const bar = document.getElementById('tbar');
        const countdown = document.getElementById('tcountdown');
        if (bar) bar.style.width = ((TIMER_SECONDS - left) / TIMER_SECONDS * 100) + '%';
        if (countdown) countdown.textContent = left;
        
        if (left <= 0) {
            clearInterval(tick);
            const check = document.getElementById('agreeCheck');
            if (check) check.disabled = false;
            const tlabel = document.getElementById('tlabel');
            if (tlabel) tlabel.innerHTML = '<b style="color:green;">Identity Verified</b>';
        }
    }, 1000);
}

async function handleFormSubmission(e) {
    e.preventDefault();
    const type = document.getElementById('regType').value;
    const isVal = type === "Validation";
    const submitBtn = document.getElementById('submitBtn');

    if (!passportBase64) return alert("Please upload passport photograph.");
    
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");

    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

    let formData = {
        regType: type,
        passportData: passportBase64,
        firstName: isVal ? recruitFullData["First Name"] : getVal("firstName"),
        surname: isVal ? recruitFullData["Surname"] : getVal("surname"),
        otherName: isVal ? recruitFullData["Other Name"] : getVal("otherName"),
        address: isVal ? recruitFullData["Residential Address"] : getVal("address"),
        occupation: isVal ? recruitFullData["Occupation"] : getVal("occupation"),
        email: isVal ? (document.getElementById('dispEmail') ? document.getElementById('dispEmail').value : "") : getVal("email"),
        phone: isVal ? recruitFullData["Phone Number"] : getVal("phone"),
        gender: isVal ? recruitFullData["Gender"] : (document.querySelector('input[name="gender"]:checked') ? document.querySelector('input[name="gender"]:checked').value : ""),
        department: isVal ? recruitFullData["Department"] : getVal("department"),
        nokName: isVal ? recruitFullData["NOK Full Name"] : getVal("nokName"),
        nokRelation: isVal ? (recruitFullData["NOK Relationship"] || recruitFullData["nokRelation"]) : getVal("nokRelation"),
        nokPhone: isVal ? recruitFullData["NOK Phone Number"] : getVal("nokPhone"),
        nokAddress: isVal ? recruitFullData["NOK Residential Address"] : getVal("nokAddress"),
        state: locationsData[getVal('state')]?.name || getVal('state'),
        area: locationsData[getVal('state')]?.areas[getVal('area')] || getVal('area'),
        stateCode: getVal('state'),
        areaCode: getVal('area')
    };

    if (type !== "Recruit") {
        formData.uniqueID = window.generatedUniqueID;
        formData.serviceNumber = getVal('serviceNumber');
        formData.rank = getVal('rank');
        formData.intakeYear = getVal('intakeYear');
        formData.serialNumber = getVal('serialNumber');
        formData.areaOC = getVal("areaOC");
        formData.postHeld = getVal("postHeld");
        if (isVal) formData.originalID = document.getElementById('searchRecruitID').value;
    }

    try {
        const res = await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(formData) });
        alert("Success! Check your email for your official document.");
        document.getElementById('successMessage').style.display = "block";
        e.target.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert("Submission failed."); submitBtn.disabled = false; }
    finally { submitBtn.classList.remove("loading"); }
}

function initMobileMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}