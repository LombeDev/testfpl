const API_BASE = "/fpl-api/"; 
const LEAGUE_ID = "101712";

async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("hidden");

    try {
        // 1. Get Static Data (for player names & current GW)
        const staticRes = await fetch(`${API_BASE}bootstrap-static/`);
        const staticData = await staticRes.json();
        
        const playerNames = {};
        staticData.elements.forEach(p => playerNames[p.id] = p.web_name);
        
        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Get League Standings
        const leagueRes = await fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`);
        const leagueData = await leagueRes.json();
        const managers = leagueData.standings.results;

        // Render the basic table first
        renderTable(managers, currentEvent, playerNames);
        loader.classList.add("hidden");

    } catch (err) {
        console.error("FPL Fetch Error:", err);
        loader.classList.add("hidden");
    }
}

function renderTable(data, currentEvent, playerNames) {
    const body = document.getElementById("league-body");
    
    body.innerHTML = data.map((m) => `
        <tr id="row-${m.entry}" class="manager-row">
            <td>${m.rank}</td>
            <td>
                <div class="manager-info">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                </div>
            </td>
            <td>${m.event_total}</td>
            <td class="bold-p">${m.total}</td>
            <td id="chip-${m.entry}"><button class="load-btn" onclick="fetchManagerDetails(${m.entry}, ${currentEvent}, Object.assign({}, ${JSON.stringify(playerNames)}))">Load Details</button></td>
            <td id="cap-${m.entry}">—</td>
            <td id="rank-${m.entry}">...</td>
            <td id="val-${m.entry}">...</td>
        </tr>
    `).join('');
}

async function fetchManagerDetails(entryId, currentEvent, playerNames) {
    const chipCell = document.getElementById(`chip-${entryId}`);
    chipCell.innerHTML = "loading...";

    try {
        const [historyRes, picksRes] = await Promise.all([
            fetch(`${API_BASE}entry/${entryId}/history/`),
            fetch(`${API_BASE}entry/${entryId}/event/${currentEvent}/picks/`)
        ]);

        const history = await historyRes.json();
        const picks = await picksRes.json();

        const currentGW = history.current[history.current.length - 1];
        const activeChip = history.chips.find(c => c.event === currentEvent);
        const captainObj = picks.picks.find(p => p.is_captain);
        const chipMeta = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };

        // Update the specific cells in the row
        document.getElementById(`chip-${entryId}`).innerHTML = activeChip ? `<span class="chip-badge chip-${activeChip.name}">${chipMeta[activeChip.name]}</span>` : '—';
        document.getElementById(`cap-${entryId}`).innerHTML = `<strong>© ${playerNames[captainObj.element]}</strong>`;
        document.getElementById(`rank-${entryId}`).innerHTML = `<span style="color:#94a3b8; font-size:9px">#${currentGW.overall_rank.toLocaleString()}</span>`;
        document.getElementById(`val-${entryId}`).innerHTML = `<span class="val-tag">£${(currentGW.value / 10).toFixed(1)}</span>`;

    } catch (err) {
        chipCell.innerHTML = "Error";
    }
}

document.addEventListener("DOMContentLoaded", fetchProLeague);
