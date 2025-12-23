const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

// Global storage for squad data and player details
const squadCache = {}; 
let playerMap = {};

/**
 * INITIALIZATION & DATA FETCHING
 */
async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings//`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        // Map for Player Details
        staticData.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                team: p.team,
                pos: p.element_type // 1: GKP, 2: DEF, 3: MID, 4: FWD
            };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next)?.id || 1;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // Render League Table
        renderTable(leagueData.standings.results, currentEvent);
        
        // Load deep intelligence (including squad picks)
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

/**
 * TABLE RENDERING
 */
function renderTable(managers, currentEvent) {
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
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')" style="cursor: pointer;">
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

/**
 * DEEP DATA LOADING
 */
async function loadLeagueIntelligence(managers, currentEvent) {
    const ownership = {};

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

            // Cache squad for popup use
            squadCache[m.entry] = squadIds;

            // Update UI components
            updateManagerUI(m.entry, picksData, transData, currentEvent, ownership);
        } catch (e) { console.error(`Failed to load for manager ${m.entry}`, e); }
    });

    await Promise.all(promises);
    updateMatchCenter(ownership);
}

/**
 * MODAL & POPUP LOGIC
 */
function handleManagerClick(managerId, managerName) {
    const squad = squadCache[managerId];
    if (!squad) return;

    const modal = document.getElementById("team-modal");
    const container = document.getElementById("app-container"); // The main wrapper of your site
    const list = document.getElementById("modal-squad-list");
    const title = document.getElementById("modal-manager-name");

    title.textContent = `${managerName}'s Team`;
    
    // Sort squad by position (GKP -> FWD)
    const sortedSquad = [...squad].sort((a, b) => playerMap[a].pos - playerMap[b].pos);

    list.innerHTML = sortedSquad.map(id => {
        const p = playerMap[id];
        return `
            <div class="squad-row">
                <div class="p-info">
                    <span class="p-pos pos-${p.pos}">${getPosLabel(p.pos)}</span>
                    <span class="p-name">${p.name}</span>
                </div>
                <span class="p-pts">${p.points}pts</span>
            </div>
        `;
    }).join('');

    // Open Modal & Blur Background
    modal.classList.remove("hidden");
    if (container) container.classList.add("blur-bg");

    // Close Actions
    const closeModal = () => {
        modal.classList.add("hidden");
        if (container) container.classList.remove("blur-bg");
    };

    document.getElementById("close-modal").onclick = closeModal;
    window.onclick = (e) => { if (e.target == modal) closeModal(); };
}

function getPosLabel(pos) {
    return { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }[pos];
}

/**
 * HELPER UI UPDATES
 */
function updateManagerUI(id, picksData, transData, currentEvent, ownership) {
    // 1. Captain & Chip
    const capObj = picksData.picks.find(p => p.is_captain);
    const chip = picksData.active_chip;
    const chipLabel = chip ? `<span class="c-badge">${chip}</span>` : '';
    document.getElementById(`cap-${id}`).innerHTML = `${playerMap[capObj.element].name} ${chipLabel}`;

    // 2. Transfers
    const eventTrans = transData.filter(t => t.event === currentEvent);
    const transHTML = eventTrans.map(t => `<div class="in-out">in: ${playerMap[t.element_in].name}</div>`).join('');
    document.getElementById(`transfers-${id}`).innerHTML = transHTML || '<span class="none">None</span>';

    // 3. Differential Logic (Simulated for this snippet)
    // Note: You would normally run this after all squads are loaded to calculate ownership properly.
}

function updateMatchCenter(ownership) {
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