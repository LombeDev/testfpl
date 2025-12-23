const API_BASE = "/fpl-api/"; 
const LEAGUE_ID = "101712";

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
        <tr onmouseenter="loadAndCacheManager(${m.entry}, ${currentEvent}, ${playerNamesStr})">
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

    // 1. Check if we already have this manager's data for this week
    if (cached) {
        updateRow(entryId, JSON.parse(cached), playerNames);
        return;
    }

    // 2. Prevent duplicate fetches if moving mouse quickly
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

        // 3. Save to localStorage
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

document.addEventListener("DOMContentLoaded", fetchProLeague);
