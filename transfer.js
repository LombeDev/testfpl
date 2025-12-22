/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
const proxy = "https://corsproxy.io/?";
let teamMap = {}; 

/* -----------------------------------------
    LOADER MANAGEMENT
----------------------------------------- */
function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}

/* -----------------------------------------
    INITIALIZATION
----------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
    startFPLDataLoad();
});

async function startFPLDataLoad() {
    try {
        const response = await fetch(proxy + "https://fantasy.premierleague.com/api/bootstrap-static/");
        const data = await response.json();

        // Map Team IDs
        data.teams.forEach(t => teamMap[t.id] = t.short_name);

        // Load Features
        loadMostCaptained(data);
        loadMostTransferredIn(data);
        loadMostTransferredOut(data);

        hideLoadingOverlay();
    } catch (err) {
        console.error("Data load failed:", err);
        hideLoadingOverlay();
    }
}

/* -----------------------------------------
    FEATURE: MOST CAPTAINED ©️
----------------------------------------- */
function loadMostCaptained(data) {
    const container = document.getElementById("most-captained-list");
    if (!container) return;

    // Find the current or next gameweek event
    const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    
    if (!currentEvent || !currentEvent.most_captained) {
        container.innerHTML = "<h3>Most Captained ©️</h3><p>Data pending...</p>";
        return;
    }

    const captain = data.elements.find(p => p.id === currentEvent.most_captained);
    const teamAbbr = teamMap[captain.team] || '';

    container.innerHTML = "<h3>Most Captained (This GW) ©️</h3>";
    const div = document.createElement("div");
    div.className = "edge-card highlighted"; // Using your "Kopala Edge" style
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <p style="font-weight:800; font-size:1.1rem; color:var(--dark-blue);">${captain.first_name} ${captain.second_name}</p>
                <p style="font-size:0.8rem;">${teamAbbr} | Selected by ${captain.selected_by_percent}%</p>
            </div>
            <div class="geo-icon circle-dot"></div>
        </div>
    `;
    container.appendChild(div);
}

/* -----------------------------------------
    FEATURE: MOST TRANSFERRED IN ➡️
----------------------------------------- */
function loadMostTransferredIn(data) {
    const container = document.getElementById("most-transferred-list");
    if (!container) return;

    const topIn = data.elements
        .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
        .slice(0, 5);

    container.innerHTML = "<h3>Top Transfers In ➡️</h3>";

    topIn.forEach((p, index) => {
        const trendIcon = p.cost_change_event > 0 ? "📈" : (p.cost_change_event < 0 ? "📉" : "➖");
        const div = document.createElement("div");
        div.className = "price-row";
        div.innerHTML = `
            <div class="player-info">
                <span class="player-name">${index + 1}. ${p.second_name} ${trendIcon}</span>
                <span class="team-name">${teamMap[p.team]} | £${(p.now_cost/10).toFixed(1)}m</span>
            </div>
            <div class="price-data">
                <span class="change-up">+${p.transfers_in_event.toLocaleString()}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

/* -----------------------------------------
    FEATURE: MOST TRANSFERRED OUT ⬅️
----------------------------------------- */
function loadMostTransferredOut(data) {
    const container = document.getElementById("most-transferred-out-list");
    if (!container) return;

    const topOut = data.elements
        .sort((a, b) => b.transfers_out_event - a.transfers_out_event)
        .slice(0, 5);

    container.innerHTML = "<h3>Top Transfers Out ⬅️</h3>";

    topOut.forEach((p, index) => {
        const trendIcon = p.cost_change_event < 0 ? "📉" : (p.cost_change_event > 0 ? "📈" : "➖");
        const div = document.createElement("div");
        div.className = "price-row";
        div.innerHTML = `
            <div class="player-info">
                <span class="player-name">${index + 1}. ${p.second_name} ${trendIcon}</span>
                <span class="team-name">${teamMap[p.team]} | £${(p.now_cost/10).toFixed(1)}m</span>
            </div>
            <div class="price-data">
                <span class="change-down">-${p.transfers_out_event.toLocaleString()}</span>
            </div>
        `;
        container.appendChild(div);
    });
}
