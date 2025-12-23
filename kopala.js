const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        // Map for Player Details (Name + Live Points)
        const playerMap = {};
        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, team: p.team };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // Render Table Shell
        renderTable(leagueData.standings.results, currentEvent, playerMap);
        
        // Deep Load Manager Details (Transfers, Differentials, Projections)
        loadLeagueIntelligence(leagueData.standings.results, currentEvent, playerMap);

    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

function renderTable(managers, currentEvent, playerMap) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => {
        const rankDiff = m.last_rank - m.rank;
        const moveClass = rankDiff > 0 ? 'up' : rankDiff < 0 ? 'down' : 'same';
        
        return `
        <tr id="row-${m.entry}">
            <td class="rank-col">
                <div class="curr-rank">${m.rank}</div>
                <div class="rank-move ${moveClass}">${rankDiff > 0 ? '▲' : rankDiff < 0 ? '▼' : '—'}</div>
            </td>
            <td class="manager-col">
                <div class="m-name">${m.player_name}</div>
                <div class="t-name">${m.entry_name}</div>
            </td>
            <td class="pts-col">
                <div id="live-gw-${m.entry}" class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" class="hits"></div>
            </td>
            <td class="total-col">
                <div class="bold-p">${m.total}</div>
                <div id="proj-${m.entry}" class="proj-val"></div>
            </td>
            <td id="cap-${m.entry}" class="cap-col">—</td>
            <td id="diffs-${m.entry}" class="diff-col">...</td>
            <td id="transfers-${m.entry}" class="trans-col">...</td>
        </tr>
    `}).join('');
}

async function loadLeagueIntelligence(managers, currentEvent, playerMap) {
    const ownership = {};
    const fullData = [];

    // Parallel fetch for all manager details
    const promises = managers.map(async (m) => {
        try {
            const [picksRes, transRes] = await Promise.all([
                fetch(`${API_BASE}entry/${m.entry}/event/${currentEvent}/picks/`),
                fetch(`${API_BASE}entry/${m.entry}/transfers/`)
            ]);
            const picksData = await picksRes.json();
            const transData = await transRes.json();

            const squadIds = picksData.picks.map(p => p.element);
            squadIds.forEach(id => ownership[id] = (ownership[id] || 0) + 1);

            return {
                id: m.entry,
                picks: picksData,
                transfers: transData.filter(t => t.event === currentEvent),
                squad: squadIds
            };
        } catch (e) { return null; }
    });

    const results = await Promise.all(promises);

    results.forEach(res => {
        if (!res) return;
        const chipMeta = { 'wildcard': 'WC', 'freehit': 'FH', 'bboost': 'BB', '3xc': 'TC' };
        
        // 1. Captain & Chip
        const cap = picksDataToCap(res.picks, playerMap);
        const chip = res.picks.active_chip;
        document.getElementById(`cap-${res.id}`).innerHTML = `
            <div class="cap-box">${cap} ${chip ? `<span class="c-badge">${chipMeta[chip]}</span>` : ''}</div>
        `;

        // 2. Transfers & Hits
        const hits = res.picks.entry_history.event_transfer_cost;
        if (hits > 0) document.getElementById(`hits-${res.id}`).innerText = `-${hits} hit`;
        
        const transHTML = res.transfers.map(t => `<div class="in-out">in: ${playerMap[t.element_in].name}</div>`).join('');
        document.getElementById(`transfers-${res.id}`).innerHTML = transHTML || '<span class="none">None</span>';

        // 3. Differentials
        const diffs = res.squad.filter(id => ownership[id] === 1);
        document.getElementById(`diffs-${res.id}`).innerHTML = diffs.map(id => 
            `<span class="d-tag">${playerMap[id].name}</span>`).join('') || '<span class="none">Template</span>';

        // 4. Live Projections
        const liveGW = res.picks.entry_history.points - hits;
        const projTotal = (managers.find(m => m.entry === res.id).total - managers.find(m => m.entry === res.id).event_total) + liveGW;
        document.getElementById(`proj-${res.id}`).innerText = `Proj: ${projTotal}`;
    });

    updateMatchCenter(ownership, playerMap);
}

function picksDataToCap(picks, playerMap) {
    const capObj = picks.picks.find(p => p.is_captain);
    return playerMap[capObj.element].name;
}

function updateMatchCenter(ownership, playerMap) {
    const center = document.getElementById("match-center-content");
    if (!center) return;
    const topDiffs = Object.entries(ownership)
        .filter(([id, count]) => count === 1 && playerMap[id].points > 2)
        .map(([id]) => playerMap[id].name);
    
    center.innerHTML = topDiffs.length > 0 ? 
        `<strong>Live Differentials Popping:</strong> ${topDiffs.join(' • ')}` : 
        `<strong>Notice:</strong> No major differential scores yet.`;
}

document.addEventListener("DOMContentLoaded", fetchProLeague);
