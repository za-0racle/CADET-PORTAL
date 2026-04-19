// ==========================================
// CONFIGURATION
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuD0cKtVO891xIA0qp0wm_b3sth9eRE7hbd58coWSpxSY6s3SoT4ZaXiMrK-5RpoChzQ/exec";

const ADMIN_USERNAME = "AdminCAD";
const ADMIN_PASSWORD = "Oracle2026";

let allData = []; // Full combined database
let filteredData = []; // Current filtered view

// ==========================================
// 1. LOGIN LOGIC
// ==========================================
function handleLogin() {
  const userInp = document.getElementById("adminUser").value.trim();
  const passInp = document.getElementById("adminPass").value.trim();
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  loginError.textContent = "";

  if (userInp === ADMIN_USERNAME && passInp === ADMIN_PASSWORD) {
    loginBtn.classList.add("loading");
    loginBtn.disabled = true;

    setTimeout(() => {
      document.getElementById("loginSection").style.display = "none";
      document.getElementById("dashboardSection").style.display = "flex";
      fetchData(); // Trigger Unified Sync
    }, 1200);
  } else {
    loginError.textContent = "❌ Invalid Username or Password.";
  }
}

// ==========================================
// 2. DATA SYNC (Sheet1 + Recruits)
// ==========================================
async function fetchData() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px;">⌛ Syncing Master Database...</td></tr>`;

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getAdminData`);
    const data = await response.json();

    allData = data;
    filteredData = data; 

    populateFilters(data);
    calculateStats(data);
    renderTable(data);
    
    document.getElementById("filterStatus").innerText = `Sync Complete: ${data.length} total records`;

  } catch (error) {
    console.error("Fetch error:", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red; padding: 40px;">❌ Sync Failed. Check Connection.</td></tr>`;
  }
}

// ==========================================
// 3. DYNAMIC FILTERS (Includes Categories)
// ==========================================
function populateFilters(data) {
    const stateSelect = document.getElementById("filterState");
    const areaSelect = document.getElementById("filterArea");
    const deptSelect = document.getElementById("filterDept");

    const states = [...new Set(data.map(o => o["State Command"]).filter(Boolean))].sort();
    const areas = [...new Set(data.map(o => o["Area Command"]).filter(Boolean))].sort();
    const depts = [...new Set(data.map(o => o["Department"]).filter(Boolean))].sort();

    stateSelect.innerHTML = '<option value="">All States</option>';
    states.forEach(s => stateSelect.add(new Option(s, s)));

    areaSelect.innerHTML = '<option value="">All Areas</option>';
    areas.forEach(a => areaSelect.add(new Option(a, a)));

    deptSelect.innerHTML = '<option value="">All Departments</option>';
    depts.forEach(d => deptSelect.add(new Option(d, d)));
}

// ==========================================
// 4. MASTER FILTER ENGINE
// ==========================================
function applyFilters() {
    const categoryVal = document.getElementById("filterCategory").value;
    const stateVal = document.getElementById("filterState").value;
    const areaVal = document.getElementById("filterArea").value;
    const deptVal = document.getElementById("filterDept").value;
    const genderVal = document.getElementById("filterGender").value;
    const searchVal = document.getElementById("searchInput").value.toLowerCase().trim();

    filteredData = allData.filter(item => {
        // 1. Category Filter (Officer vs Recruit)
        const matchCat = !categoryVal || item["Member Category"] === categoryVal;
        
        // 2. State & Area Filters
        const matchState = !stateVal || item["State Command"] === stateVal;
        const matchArea = !areaVal || item["Area Command"] === areaVal;
        
        // 3. Dept Filter
        const matchDept = !deptVal || item["Department"] === deptVal;
        
        // 4. Gender Filter
        const gClean = (item["Gender"] || "").toString().toLowerCase();
        const matchGender = !genderVal || gClean === genderVal.toLowerCase() || gClean === genderVal.toLowerCase().charAt(0);

        // 5. Global Search
        const searchPool = `${item["First Name"]} ${item["Surname"]} ${item["Unique ID"]} ${item["Phone Number"]}`.toLowerCase();
        const matchSearch = !searchVal || searchPool.includes(searchVal);

        return matchCat && matchState && matchArea && matchDept && matchGender && matchSearch;
    });

    renderTable(filteredData);
    document.getElementById("filterStatus").innerText = `Showing ${filteredData.length} records`;
}

// ==========================================
// 5. STATS & COUNTER ANIMATION
// ==========================================
function calculateStats(data) {
  let male = 0;
  let female = 0;
  let recruits = 0;

  data.forEach(item => {
    const gender = (item["Gender"] || "").toString().toLowerCase();
    if (gender === "male" || gender === "m") male++;
    else if (gender === "female" || gender === "f") female++;
    
    if (item["Member Category"] === "Recruit") recruits++;
  });

  animateNum("statTotal", data.length);
  animateNum("statMale", male);
  animateNum("statFemale", female);
  animateNum("statRecruits", recruits); // New Card
}

function animateNum(id, target) {
    const obj = document.getElementById(id);
    if(!obj) return;
    let current = 0;
    const increment = Math.ceil(target / 25) || 1;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            obj.innerText = target;
            clearInterval(timer);
        } else {
            obj.innerText = current;
        }
    }, 30);
}

// ==========================================
// 6. TABLE RENDER (With Category Tag)
// ==========================================
function renderTable(data) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = ""; 

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No matching records found.</td></tr>`;
    return;
  }

  [...data].reverse().forEach(item => {
    const tr = document.createElement("tr");
    
    const isRecruit = item["Member Category"] === "Recruit";
    const catStyle = isRecruit ? "color: #f39c12; font-weight: bold;" : "color: #2e7d32; font-weight: bold;";

    const pdfUrl = item["PDF URL"] || "#";
    const pdfAction = (pdfUrl === "Generating..." || pdfUrl === "#") 
        ? `<i>Processing</i>` 
        : `<a href="${pdfUrl}" target="_blank" class="pdf-link">View PDF</a>`;

    tr.innerHTML = `
      <td>${item["Timestamp"] || ""}</td>
      <td><b style="color:#002b05;">${item["Unique ID"] || ""}</b></td>
      <td>${item["Surname"]}, ${item["First Name"]}</td>
      <td>${item["Rank"] || "Recruit"}</td>
      <td style="${catStyle}">${item["Member Category"]}</td>
      <td>${item["State Command"] || ""} <br><small style="color:#888;">${item["Area Command"] || ""}</small></td>
      <td>${pdfAction}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 7. EXPORT LOGIC (Respects Filter)
// ==========================================
function downloadFilteredData() {
    if (filteredData.length === 0) return alert("Nothing to export.");

    const headers = Object.keys(filteredData[0]);
    const csvContent = [
        headers.join(","),
        ...filteredData.map(row => 
            headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(",")
        )
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CADETI_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ==========================================
// 8. SESSION LOGIC
// ==========================================
function logout() {
  if (confirm("Sign out of Admin Panel?")) {
    location.reload();
  }
}