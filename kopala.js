const API_BASE = "/fpl-api/"; 
const LEAGUE_ID = "101712";

// --- NAVIGATION LOGIC ---
const menuBtn = document.getElementById('menu-btn');
const closeBtn = document.getElementById('close-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

const toggleDrawer = () => {
    drawer.classList.toggle('open');
    backdrop.classList.toggle('active');
};

// Add listeners safely
if(menuBtn) menuBtn.addEventListener('click', toggleDrawer);
if(closeBtn) closeBtn.addEventListener('click', toggleDrawer);
if(backdrop) backdrop.addEventListener('click', toggleDrawer);


// --- FPL DATA LOGIC ---
async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        const playerNames = {};
        staticData.elements.forEach(p => playerNames[p.id] = p.web_name);
        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;

        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;
        renderTable(leagueData.standings.results, currentEvent, playerNames);
        
        loader.classList.add("hidden");
    } catch (err) {
        console.error("Fetch Error:", err);
        loader.classList.add("hidden");
    }
}

function renderTable(managers, currentEvent, playerNames) {
    const body = document.getElementById("league-body");
    const playerNamesStr = JSON.stringify(playerNames).replace(/"/g, '&quot;');

    body.innerHTML = managers.map((m) => `
        <tr onmouseenter="loadAndCacheManager(${m.entry}, ${currentEvent}, ${playerNamesStr})" 
            onclick="loadAndCacheManager(${m.entry}, ${currentEvent}, ${playerNamesStr})">
            <td>${m.rank}</td>
            <td>
                <div class="manager-info">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                </div>
            </td>
            <td>${m.event_total}</td>
            <td class="bold-p">${m.total}</td>
            <td id="chip-${m.entry}">...</td>
            <td id="cap-${m.entry}">—</td>
        </tr>
    `).join('');
}

async function loadAndCacheManager(entryId, currentEvent, playerNames) {
    const cacheKey = `fpl_entry_${entryId}_gw${currentEvent}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        updateRow(entryId, JSON.parse(cached), playerNames);
        return;
    }

    const capCell = document.getElementById(`cap-${entryId}`);
    if (capCell.innerText === "loading...") return;
    capCell.innerText = "loading...";

    try {
        const res = await fetch(`${API_BASE}entry/${entryId}/event/${currentEvent}/picks/`);
        const data = await res.json();

        const managerData = {
            chip: data.active_chip,
            capId: data.picks.find(p => p.is_captain).element
        };

        localStorage.setItem(cacheKey, JSON.stringify(managerData));
        updateRow(entryId, managerData, playerNames);
    } catch (e) {
        capCell.innerText = "Error";
    }
}

function updateRow(entryId, data, playerNames) {
    const chipMeta = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };
    document.getElementById(`chip-${entryId}`).innerHTML = data.chip ? `<span class="chip-badge">${chipMeta[data.chip] || data.chip}</span>` : '—';
    document.getElementById(`cap-${entryId}`).innerHTML = `<strong>© ${playerNames[data.capId]}</strong>`;
}

// Initialize
document.addEventListener("DOMContentLoaded", fetchProLeague);
