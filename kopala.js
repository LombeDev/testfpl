const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; // For the popup
let globalOwnership = {};

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

        // 1. Map Teams and Players
        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);
        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, team: p.team, pos: p.element_type };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Render Table Shell
        const managers = leagueData.standings.results;
        renderTable(managers);
        
        // 3. Load Deep Intelligence (Chips, Values, Diffs, Transfers)
        loadLeagueIntelligence(managers, currentEvent);

    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}">
            <td class="rank-col">
                <div class="curr-rank">${m.rank}</div>
            </td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')" style="cursor:pointer">
                <span class="m-name">${m.player_name}</span>
                <span class="t-name">${m.entry_name}</span>
                <div id="val-${m.entry}" class="val-text">Loading value...</div>
            </td>
            <td class="pts-col">
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" class="hits"></div>
            </td>
            <td class="total-col">
                <div class="bold-p">${m.total}</div>
                <div id="proj-${m.entry}" class="proj-val"></div>
            </td>
            <td id="cap-${m.entry}">—</td>
            <td><div id="diffs-${m.entry}" class="diff-col-scroll">...</div></td>
            <td><div id="trans-${m.entry}" class="trans-col-scroll">...</div></td>
        </tr>
    `).join('');
}

async function loadLeagueIntelligence(managers, eventId) {
    const ownership = {};
    const managerDetails = {};

    // Parallel fetch for all managers
    await Promise.all(managers.map(async (m) => {
        try {
            const [picksRes, transRes] = await Promise.all([
                fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
                fetch(`${API_BASE}entry/${m.entry}/transfers/`)
            ]);
            const picks = await picksRes.json();
            const trans = await transRes.json();

            managerDetails[m.entry] = { picks, trans: trans.filter(t => t.event === eventId) };
            managerSquads[m.entry] = picks; // Cache for Modal

            // Calculate Ownership for Differentials
            picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
        } catch (e) { console.warn(e); }
    }));

    // Update UI
    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        // 1. Team Value
        const val = (data.picks.entry_history.value / 10).toFixed(1);
        document.getElementById(`val-${m.entry}`).innerText = `£${val}m Value`;

        // 2. Chips & Captain
        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        document.getElementById(`cap-${m.entry}`).innerHTML = `
            ${playerMap[cap.element].name} ${chip ? `<span class="c-badge">${chip.toUpperCase()}</span>` : ''}
        `;

        // 3. Hits
        const hits = data.picks.entry_history.event_transfer_cost;
        if (hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits} hit`;

        // 4. Differentials (Owned by only 1 in league)
        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => 
            `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';

        // 5. Transfers In/Out
        document.getElementById(`trans-${m.entry}`).innerHTML = data.trans.map(t => `
            <span class="mini-tag tag-in">In: ${playerMap[t.element_in].name}</span>
            <span class="mini-tag tag-out">Out: ${playerMap[t.element_out].name}</span>
        `).join('') || '<span style="color:#ccc">No moves</span>';
        
        // 6. Project Total (Simple calculation)
        const proj = m.total; 
        document.getElementById(`proj-${m.entry}`).innerText = `Proj: ${proj}`;
    });

    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.add("hidden");
}

// THE MODAL POPUP LOGIC
function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;

    const sortedPicks = [...data.picks].sort((a, b) => playerMap[a.element].pos - playerMap[b.element].pos);
    let totalLive = 0;

    list.innerHTML = sortedPicks.map(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        totalLive += pts;
        return `
            <div class="squad-row" style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">
                <span>${player.name} (${teamMap[player.team]}) ${p.is_captain ? '★' : ''}</span>
                <span style="font-weight:bold">${pts}</span>
            </div>
        `;
    }).join('') + `<div style="padding:10px; text-align:right; font-weight:900; font-size:18px;">Total: ${totalLive}</div>`;

    modal.classList.remove("hidden");
}

document.getElementById("close-modal").onclick = () => document.getElementById("team-modal").classList.add("hidden");

document.addEventListener("DOMContentLoaded", fetchProLeague);