const API_BASE = "/fpl-api/";
const LEAGUES = [
    { id: "101712", name: "Kopala FPL" },
    { id: "1745660", name: "Zedian Premier League" },
    { id: "1019777", name: "A league has no name" },
    { id: "147133", name: "Bayport" } // Add more here
];

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 
let topManagersData = [];

async function fetchAllLeagues() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        // 1. Static Data
        const staticRes = await fetch(`${API_BASE}bootstrap-static/`);
        const staticData = await staticRes.json();
        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);
        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, team: p.team, pos: p.element_type };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Setup Dropdown
        const selector = document.getElementById("league-select");
        selector.innerHTML = `<option value="compare">🏆 Comparison Mode</option>` + 
                             LEAGUES.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

        // 3. Fetch Each League
        topManagersData = [];
        const wrapper = document.getElementById("leagues-wrapper");
        
        for (const league of LEAGUES) {
            await fetchAndRenderLeague(league.id, currentEvent);
        }

        switchLeague("compare");

    } catch (err) { console.error(err); }
    if (loader) loader.classList.add("hidden");
}

async function fetchAndRenderLeague(leagueId, eventId) {
    const res = await fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`);
    const data = await res.json();
    const managers = data.standings.results;

    // Capture leader for comparison
    if(managers[0]) {
        topManagersData.push({
            league: data.league.name,
            name: managers[0].player_name,
            team: managers[0].entry_name,
            gw: managers[0].event_total,
            total: managers[0].total
        });
    }

    const leagueCard = document.createElement("div");
    leagueCard.className = "card league-card";
    leagueCard.id = `card-${leagueId}`;
    leagueCard.innerHTML = `
        <h2 style="color:var(--fpl-primary);">${data.league.name}</h2>
        <table class="league-table-style">
            <thead>
                <tr>
                    <th>#</th><th>Manager</th><th>GW</th><th>TOT</th><th>Captain</th><th>Diffs</th><th>Trans</th>
                </tr>
            </thead>
            <tbody id="body-${leagueId}"></tbody>
        </table>
    `;
    document.getElementById("leagues-wrapper").appendChild(leagueCard);

    renderRows(leagueId, managers);
    await loadIntelligence(managers, eventId);
}

function renderRows(leagueId, managers) {
    const body = document.getElementById(`body-${leagueId}`);
    body.innerHTML = managers.map(m => `
        <tr>
            <td>${m.rank}</td>
            <td onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
                <div class="m-name">${m.player_name}</div>
                <div style="font-size:9px; opacity:0.6;">${m.entry_name}</div>
                <div id="val-${m.entry}" style="font-size:9px; font-weight:bold;">£--.-m</div>
            </td>
            <td>
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" style="color:red; font-size:8px;"></div>
            </td>
            <td class="bold-p">${m.total}</td>
            <td id="cap-${m.entry}">--</td>
            <td id="diffs-${m.entry}">--</td>
            <td id="trans-${m.entry}">--</td>
        </tr>
    `).join('');
}

function switchLeague(val) {
    document.querySelectorAll('.league-card').forEach(c => c.classList.add('hidden'));
    if (val === "compare") {
        document.getElementById("comparison-view").classList.remove('hidden');
        renderComparison();
    } else {
        document.getElementById(`card-${val}`).classList.remove('hidden');
    }
}

function renderComparison() {
    document.getElementById("comparison-body").innerHTML = topManagersData.map(m => `
        <tr>
            <td style="color:var(--fpl-primary); font-weight:bold;">${m.league}</td>
            <td><b>${m.name}</b><br><small>${m.team}</small></td>
            <td>${m.gw}</td>
            <td class="bold-p">${m.total}</td>
        </tr>
    `).join('');
}

async function loadIntelligence(managers, eventId) {
    const ownership = {};
    const details = {};

    await Promise.all(managers.map(async (m) => {
        const [pRes, tRes] = await Promise.all([
            fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
            fetch(`${API_BASE}entry/${m.entry}/transfers/`)
        ]);
        const picks = await pRes.json();
        const trans = await tRes.json();
        details[m.entry] = { picks, trans: trans.filter(t => t.event === eventId) };
        managerSquads[m.entry] = picks;
        picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
    }));

    managers.forEach(m => {
        const d = details[m.entry];
        if(!d) return;
        document.getElementById(`val-${m.entry}`).innerText = `£${(d.picks.entry_history.value / 10).toFixed(1)}m`;
        const cap = d.picks.picks.find(p => p.is_captain);
        document.getElementById(`cap-${m.entry}`).innerText = playerMap[cap.element].name;
        
        const diffs = d.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.slice(0,2).map(p => `<small>${playerMap[p.element].name}</small>`).join(', ');

        const hits = d.picks.entry_history.event_transfer_cost;
        if(hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits}`;
    });
}

// Modal handling
document.getElementById("close-modal").onclick = () => document.getElementById("team-modal").classList.add("hidden");

document.addEventListener("DOMContentLoaded", fetchAllLeagues);
