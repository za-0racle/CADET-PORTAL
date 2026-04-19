// ==========================================
// CONFIGURATION
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnREMULjuPFZJeQBB5h5zz3SWNmtAqXdjcPaTgAEZx6HJXvHtO4DKtDUoN0W3i5pzNQA/exec";

// DOM Elements - Logic Steps
const searchStep = document.getElementById('searchStep');
const validationForm = document.getElementById('validationForm');
const lookupBtn = document.getElementById('lookupBtn');

// DOM Elements - Read Only Display Fields
const dispName = document.getElementById('dispName');
const dispPhone = document.getElementById('dispPhone');
const dispEmail = document.getElementById('dispEmail');
const dispGender = document.getElementById('dispGender');
const dispAddress = document.getElementById('dispAddress');
const dispOccupation = document.getElementById('dispOccupation');
const dispDept = document.getElementById('dispDept');
const dispNokName = document.getElementById('dispNokName');
const dispNokPhone = document.getElementById('dispNokPhone');

// DOM Elements - Active Service Builder
const stateSelect = document.getElementById("state");
const areaSelect = document.getElementById("area");
const yearSelect = document.getElementById("intakeYear");
const serialInput = document.getElementById("serialNumber");
const serviceNumberInput = document.getElementById("serviceNumber");
const areaOCInp = document.getElementById("areaOC");
const rankInp = document.getElementById("rank");
const postInp = document.getElementById("postHeld");

// UI Components
const passportInput = document.getElementById('passportInput');
const passportPreview = document.getElementById('passportPreview');
const submitBtn = document.getElementById("submitBtn");
const successMessage = document.getElementById("successMessage");

const agreeCheck = document.getElementById('agreeCheck');
const bar = document.getElementById('tbar');
const countdown = document.getElementById('tcountdown');
const tlabel = document.getElementById('tlabel');

// Global Data Store
let locationsData = {};
let recruitFullData = {}; 
let passportBase64 = "";
let timerStarted = false;
const TIMER_SECONDS = 15;

// ==============================
// 1. LOOKUP RECRUIT RECORD
// ==============================
async function lookupRecruit() {
    const recruitID = document.getElementById('searchRecruitID').value.trim();
    if (!recruitID) return alert("Please enter your Appointed Recruit Number (REC/...)");

    lookupBtn.disabled = true;
    lookupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching Record...';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=searchRecruit&id=${encodeURIComponent(recruitID)}`);
        const result = await response.json();

        if (result.status === "success") {
            recruitFullData = result.data;

            // Populate Read-Only Display
            dispName.value = `${result.data["Surname"]}, ${result.data["First Name"]} ${result.data["Other Name"] || ""}`.trim();
            dispPhone.value = result.data["Phone Number"] || "N/A";
            dispEmail.value = result.data["Email"] || result.data["email"] || "N/A";
            dispGender.value = result.data["Gender"] || "N/A";
            dispAddress.value = result.data["Residential Address"] || "N/A";
            dispOccupation.value = result.data["Occupation"] || "N/A";
            dispDept.value = result.data["Department"] || "N/A";
            dispNokName.value = result.data["NOK Full Name"] || "N/A";
            dispNokPhone.value = result.data["NOK Phone Number"] || "N/A";

            searchStep.style.display = 'none';
            validationForm.style.display = 'block';

            fetchLocations();
            populateYears();
            startValidationTimer();
        } else {
            alert("Recruit ID not found in our database.");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error.");
    } finally {
        lookupBtn.disabled = false;
        lookupBtn.innerText = "Verify ID";
    }
}

// ==============================
// 2. FETCH LOCATIONS
// ==============================
async function fetchLocations() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getLocations`);
        const data = await response.json();
        data.forEach(row => {
            if (!locationsData[row.StateCode]) {
                locationsData[row.StateCode] = { name: row.StateName, areas: {} };
            }
            locationsData[row.StateCode].areas[row.AreaCode] = row.AreaName;
        });
        populateStates();
    } catch (err) { console.error("Location Error:", err); }
}

function populateStates() {
    stateSelect.innerHTML = '<option value="">Select State</option>';
    Object.keys(locationsData).forEach(code => {
        stateSelect.add(new Option(`${locationsData[code].name} (${code})`, code));
    });
}

stateSelect.addEventListener("change", () => {
    areaSelect.innerHTML = '<option value="">Select Area</option>';
    const selectedState = stateSelect.value;
    if (!selectedState) return;
    const areas = locationsData[selectedState].areas;
    Object.keys(areas).forEach(code => {
        areaSelect.add(new Option(`${areas[code]} (${code})`, code));
    });
    generateServiceNumber();
});

function populateYears() {
    const years = ["024", "025", "026"];
    yearSelect.innerHTML = '<option value="">Year</option>';
    years.forEach(y => yearSelect.add(new Option(y, y)));
}

// ==========================================
// 3. DUAL ID GENERATOR
// ==========================================
function generateServiceNumber() {
    const s = stateSelect.value;
    const a = areaSelect.value;
    const y = yearSelect.value;
    let sn = serialInput.value;

    if (!s || !a || !y || !sn) {
        serviceNumberInput.value = "";
        return;
    }

    if (parseInt(sn) > 300) {
        alert("Serial number cannot exceed 300");
        serialInput.value = "";
        return;
    }

    const padded = sn.toString().padStart(3, "0");
    
    // A. Official Service Number (Slashed) -> UI Display
    const slashedID = `CAD/${s}/${a}/${y}/${padded}`;
    serviceNumberInput.value = slashedID;

    // B. Internal Unique ID (Concatenated + Timestamp) -> For Backend
    const systemNum = ("0000" + (Math.floor(Date.now() / 1000) % 10000)).slice(-4);
    window.generatedUniqueID = `${s}${a}${y}${systemNum}${padded}`;
}

[areaSelect, yearSelect, serialInput].forEach(el => el.addEventListener("change", generateServiceNumber));
serialInput.addEventListener("input", generateServiceNumber);

// ==============================
// 4. PASSPORT & TIMER
// ==============================
passportInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.size <= 5242880) {
        const reader = new FileReader();
        reader.onload = (event) => {
            passportPreview.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            passportBase64 = event.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    } else { alert("Photo too large (Max 5MB)"); }
});

function startValidationTimer() {
    if (timerStarted) return;
    timerStarted = true;
    let left = TIMER_SECONDS;
    const tick = setInterval(() => {
        left--;
        bar.style.width = ((TIMER_SECONDS - left) / TIMER_SECONDS * 100) + '%';
        if (countdown) countdown.textContent = left;
        if (left <= 0) {
            clearInterval(tick);
            agreeCheck.disabled = false;
            tlabel.innerHTML = '<b style="color:green;">Official Data Verified</b>';
            bar.style.background = 'green';
        }
    }, 1000);
}

agreeCheck.addEventListener('change', () => {
    submitBtn.disabled = !agreeCheck.checked;
});

// ==============================
// 5. FINAL SUBMISSION
// ==============================
validationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!passportBase64) return alert("You must upload a passport photograph.");

    submitBtn.disabled = true;
    submitBtn.classList.add("loading");

    const sCode = stateSelect.value;
    const aCode = areaSelect.value;

    const formData = {
        regType: "Validation",
        originalID: document.getElementById('searchRecruitID').value.trim(),
        
        // ID LOGIC
        serviceNumber: serviceNumberInput.value, // CAD/OG/OTW/026/001
        uniqueID: window.generatedUniqueID,    // OGOTW0263456001
        
        // OFFICIAL DATA
        rank: rankInp.value,
        postHeld: postInp.value || "Member",
        areaOC: areaOCInp.value,
        state: locationsData[sCode]?.name || sCode,
        area: locationsData[sCode]?.areas[aCode] || aCode,
        stateCode: sCode,
        areaCode: aCode,
        intakeYear: yearSelect.value,
        serialNumber: serialInput.value,
        passportData: passportBase64,
        
        // BIO DATA (Direct from Display Fields to ensure capture)
        firstName: recruitFullData["First Name"],
        surname: recruitFullData["Surname"],
        otherName: recruitFullData["Other Name"],
        address: dispAddress.value,
        occupation: dispOccupation.value,
        gender: dispGender.value,
        phone: dispPhone.value,
        email: dispEmail.value,
        department: dispDept.value,
        nokName: dispNokName.value,
        nokRelation: recruitFullData["NOK Relationship"] || recruitFullData["NOK relationship"] || "N/A",
        nokPhone: dispNokPhone.value,
        nokAddress: recruitFullData["NOK Residential Address"] || "N/A"
    };

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(formData)
        });

        alert("Validation Successful! Documents sent to your email.");
        successMessage.style.display = "block";
        validationForm.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert("Submission failed.");
        submitBtn.disabled = false;
    } finally {
        submitBtn.classList.remove("loading");
    }
});