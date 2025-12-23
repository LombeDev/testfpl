const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 
let globalOwnership = {};

async function fetchProLeague() {
    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);
        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, team: p.team, pos: p.element_type };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // First, render the basic table shell
        renderTable(leagueData.standings.results);
        
        // Then, fetch deep data for Chips, Values, Diffs, and Transfers
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { console.error(err); }
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}">
            <td class="rank-col"><strong>${m.rank}</strong></td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
                <div class="m-name">${m.player_name}</div>
                <div id="chip-${m.entry}"></div> 
            </td>
            <td class="pts-col">
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" style="font-size:10px; color:red;"></div>
            </td>
            <td class="val-col">
                <div id="val-${m.entry}" class="val-tag">...</div>
            </td>
            <td id="cap-${m.entry}" class="cap-col">—</td>
            <td class="diff-col"><div id="diffs-${m.entry}" class="diff-tag-list">...</div></td>
            <td class="trans-col"><div id="trans-${m.entry}" class="trans-tag-list">...</div></td>
        </tr>
    `).join('');
}

async function loadLeagueIntelligence(managers, eventId) {
    const ownership = {};
    const managerData = {};

    // 1. Parallel fetch all manager picks
    const promises = managers.map(async (m) => {
        const [picksRes, transRes] = await Promise.all([
            fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
            fetch(`${API_BASE}entry/${m.entry}/transfers/`)
        ]);
        const picks = await picksRes.json();
        const trans = await transRes.json();
        
        managerData[m.entry] = { picks, trans: trans.filter(t => t.event === eventId) };
        managerSquads[m.entry] = picks;

        // Count ownership for differentials
        picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
    });

    await Promise.all(promises);

    // 2. Update the Table Cells with deep data
    managers.forEach(m => {
        const data = managerData[m.entry];
        if (!data) return;

        // Chips
        if (data.picks.active_chip) {
            document.getElementById(`chip-${m.entry}`).innerHTML = `<span class="chip-tag">${data.picks.active_chip}</span>`;
        }

        // Team Value
        const val = (data.picks.entry_history.value / 10).toFixed(1);
        document.getElementById(`val-${m.entry}`).innerText = `£${val}m`;

        // Hits
        const hits = data.picks.entry_history.event_transfer_cost;
        if (hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits} hit`;

        // Captain
        const cap = data.picks.picks.find(p => p.is_captain);
        document.getElementById(`cap-${m.entry}`).innerText = playerMap[cap.element].name;

        // Differentials (Owned by only 1 person in this league)
        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => 
            `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';

        // Transfers
        document.getElementById(`trans-${m.entry}`).innerHTML = data.trans.map(t => `
            <span class="mini-tag tag-in">In: ${playerMap[t.element_in].name}</span>
            <span class="mini-tag tag-out">Out: ${playerMap[t.element_out].name}</span>
        `).join('') || '<span style="color:#999; font-size:10px;">None</span>';
    });
}