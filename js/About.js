// ==========================================
// 1. CONFIGURATION
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxaSQid7O0KeDO6fDhWDyhclRIuXAi7ckhWczXCaC9wwu0I25goEa4ycKdxbJ2IjmKCFg/exec";

// Mapping SDG numbers to professional icons
const sdgIcons = {
    "1": "fa-hand-holding-dollar",   // No Poverty
    "3": "fa-heart-pulse",           // Good Health
    "4": "fa-book-open-reader",      // Quality Education
    "5": "fa-venus",                 // Gender Equality
    "10": "fa-users-rectangle",      // Reduced Inequality
    "16": "fa-scale-balanced",       // Peace & Justice
    "default": "fa-flag-checkered"
};

// ==========================================
// 2. SHARED REVEAL OBSERVER
// ==========================================
// This handles the "Slide Up" effect as you scroll
const revealOptions = { threshold: 0.15 };
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target); // Animation only happens once
        }
    });
}, revealOptions);

// ==========================================
// 3. DYNAMIC ROADMAP LOADER
// ==========================================
async function loadRoadmap() {
    const grid = document.getElementById('roadmapGrid');
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getActivities`);
        const data = await response.json();
        
        if (!data || data.length === 0) throw new Error("No data");

        grid.innerHTML = ""; // Remove the loading text

        data.forEach((item, index) => {
            // Extract the first number found in the SDG text (e.g., "Goal 5" -> "5")
            const goalMatch = item.SDG ? item.SDG.match(/\d+/) : null;
            const iconClass = goalMatch ? (sdgIcons[goalMatch[0]] || sdgIcons.default) : sdgIcons.default;

            // Create the card element
            const card = document.createElement('div');
            card.className = "roadmap-card reveal"; // Added reveal class for animation
            
            // Set a slight staggered delay for cards appearing together
            card.style.transitionDelay = `${(index % 3) * 0.1}s`;

            card.innerHTML = `
                <i class="fa-solid ${iconClass} sdg-icon"></i>
                <small style="color:#666; font-weight:700; text-transform:uppercase;">SDG Alignment: ${item.SDG || "General"}</small>
                <h4 style="margin:8px 0; color:#002b05; font-size:15px; font-family:'Montserrat';">
                    ${item.Month}: ${item["Activity Theme"] || "Scheduled Activity"}
                </h4>
                <p style="font-size:12px; color:#555; line-height:1.6;">${item.Description || "Details pending from National Command."}</p>
                <div style="margin-top:15px; font-size:10px; font-weight:800; color:#c00; letter-spacing:1px;">
                    STATUS: ${item.Status || "PLANNED"}
                </div>
            `;

            grid.appendChild(card);
            
            // CRITICAL: Tell the observer to watch this new card
            revealObserver.observe(card);
        });

    } catch (e) {
        console.error("Roadmap Sync Error:", e);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 20px; color:#666;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                <p>2026 Operational Roadmap is currently being updated by the Zonal Command.</p>
            </div>
        `;
    }
}

// ==========================================
// 4. STATS COUNTER ENGINE
// ==========================================
function initCounters() {
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = +counter.getAttribute('data-target');
                let count = 0;
                const duration = 2000; // 2 seconds
                const increment = target / (duration / 16); // 60fps

                const updateCount = () => {
                    count += increment;
                    if (count < target) {
                        counter.innerText = Math.ceil(count);
                        requestAnimationFrame(updateCount);
                    } else {
                        counter.innerText = target + "+";
                    }
                };
                updateCount();
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 1.0 });

    document.querySelectorAll('.counter').forEach(c => counterObserver.observe(c));
}

// ==============================
// 5. INITIALIZE PAGE
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Reveal (for static items like Mission/Vision)
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // 2. Load the dynamic content
    loadRoadmap();

    // 3. Start the statistics counters
    initCounters();
});

document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');

    // Toggle the "active" class on the menu when button is clicked
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            
            // Switch icon between bars and X
            const icon = menuBtn.querySelector('i');
            if (icon.classList.contains('fa-bars')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });
    }
});