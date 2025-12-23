const LEAGUE_ID = 101712; 
const PROXY_URL = "/.netlify/functions/fpl-proxy";

/* ================= AUTH CONTROL ================= */
if (window.netlifyIdentity) {
    netlifyIdentity.on("init", user => user ? showApp() : hideApp());
    netlifyIdentity.on("login", user => { showApp(); netlifyIdentity.close(); });
    netlifyIdentity.on("logout", () => { hideApp(); localStorage.clear(); location.href="index.html"; });
}

function showApp() {
    document.getElementById("auth-overlay").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("auth-header-btn").innerHTML = `<button onclick="netlifyIdentity.logout()" style="background:none; border:1px solid white; color:white; font-size:0.7rem; padding:4px 8px; border-radius:4px;">Logout</button>`;
    initMembers();
}

function hideApp() {
    document.getElementById("auth-overlay").style.display = "block";
    document.getElementById("app").style.display = "none";
}

/* ================= DATA ENGINE ================= */
async function fetchFPL(key, path, ttl = 300000) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry) return data;
    }
    const res = await fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + ttl }));
    return data;
}

async function initMembers() {
    const bootstrap = await fetchFPL("fpl_bootstrap", "bootstrap-static", 86400000);
    const league = await fetchFPL("fpl_league", `leagues-classic/${LEAGUE_ID}/standings`);
    const currentGW = bootstrap.events.find(e => e.is_current)?.id || 1;

    renderStandings(league, bootstrap, currentGW);
    renderLiveBonus(bootstrap);
}

// Render Table
async function renderStandings(league, bootstrap, gw) {
    const el = document.getElementById("members");
    let html = `<div class="card" style="padding:0; overflow-x:auto;"><table class="kopala-table">
        <thead><tr><th>Manager</th><th>Captain</th><th style="text-align:center;">GW</th><th>Total</th></tr></thead><tbody>`;

    for (const m of league.standings.results) {
        const picks = await fetchFPL(`entry_${m.entry}_gw${gw}`, `entry/${m.entry}/event/${gw}/picks`);
        const cap = bootstrap.elements.find(e => e.id === picks.picks.find(p => p.is_captain).element);
        
        html += `<tr class="league-row">
            <td><strong>${m.player_name}</strong><br><small>${m.entry_name}</small></td>
            <td>${cap.web_name}<br><small style="color:var(--fpl-green)">+${cap.event_points * 2} pts</small></td>
            <td style="text-align:center;"><span class="gw-pill">${m.event_total}</span></td>
            <td><strong>${m.total}</strong></td>
        </tr>`;
    }
    el.innerHTML = html + `</tbody></table></div>`;
}

// Tab Switches
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab-btn, .tab-content").forEach(el => el.classList.remove("active", "active-tab"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active-tab");
    };
});