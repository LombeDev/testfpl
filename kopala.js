const API_BASE = "/fpl-api/"; 
const LEAGUE_ID = "101712";

async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("hidden");

    try {
        // 1. Fetch Static Data
        const staticRes = await fetch(`${API_BASE}bootstrap-static/`);
        const staticData = await staticRes.json();
        
        const playerNames = {};
        staticData.elements.forEach(p => playerNames[p.id] = p.web_name);
        
        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Fetch League Standings
        const leagueRes = await fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`);
        const leagueData = await leagueRes.json();
        const managers = leagueData.standings.results;

        // 3. Render Table Structure
        renderTable(managers);

        // 4. "Smart Load" Captains and Chips (One by one to avoid 403/429 errors)
        for (const manager of managers) {
            await fetchManagerExtras(manager.entry, currentEvent, playerNames);
        }

        loader.classList.add("hidden");
    } catch (err) {
        console.error("FPL API Error:", err);
        loader.classList.add("hidden");
    }
}

function renderTable(data) {
    const body = document.getElementById("league-body");
    body.innerHTML = data.map((m, i) => `
        <tr style="${i === 0 ? 'background:rgba(0,255,135,0.05)' : ''}">
            <td>${m.rank}</td>
            <td>
                <div class="manager-info">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                </div>
            </td>
            <td>${m.event_total}</td>
            <td class="bold-p">${m.total}</td>
            <td id="chip-${m.entry}"><span class="loading-small">...</span></td>
            <td id="cap-${m.entry}" style="font-weight:700; font-size: 11px;">—</td>
        </tr>
    `).join('');
}

async function fetchManagerExtras(entryId, currentEvent, playerNames) {
    try {
        // This single call gives us BOTH the Captain and the Chip
        const res = await fetch(`${API_BASE}entry/${entryId}/event/${currentEvent}/picks/`);
        const data = await res.json();

        const chipMeta = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };
        const activeChip = data.active_chip;
        const captainObj = data.picks.find(p => p.is_captain);

        // Update Chip Cell
        const chipCell = document.getElementById(`chip-${entryId}`);
        chipCell.innerHTML = activeChip ? `<span class="chip-badge chip-${activeChip}">${chipMeta[activeChip] || activeChip}</span>` : '—';

        // Update Captain Cell
        const capCell = document.getElementById(`cap-${entryId}`);
        capCell.innerHTML = `© ${playerNames[captainObj.element]}`;

    } catch (err) {
        console.warn(`Could not load details for ${entryId}`);
    }
}

document.addEventListener("DOMContentLoaded", fetchProLeague);
