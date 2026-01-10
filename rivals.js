const API_BASE = "/fpl-api/";
const LEAGUES_LIST = [
    { name: "Kopala FPL", id: "101712" },
    { name: "Bayporteers", id: "147133" },
    { name: "Zedian Premier League", id: "1745660" }
];

let playerMap = {};
let managerSquads = {}; 

async function fetchProLeague(leagueId) {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`),
            fetch(`${API_BASE}fixtures/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();
        const fixData = await fixRes.json();

        staticData.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, points: p.event_points, 
                team: p.team, pos: p.element_type, price: p.now_cost / 10, form: parseFloat(p.form)
            };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        renderTable(leagueData.standings.results);
        await loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { console.error(err); }
    if (loader) loader.classList.add("hidden");
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map(m => `
        <tr>
            <td>${m.rank}</td>
            <td onclick="handleManagerClick(${m.entry}, '${m.player_name}')"><strong>${m.player_name}</strong><br><small>${m.entry_name}</small></td>
            <td>${m.event_total}</td>
            <td>${m.total}</td>
            <td id="cap-${m.entry}">...</td>
            <td id="diffs-${m.entry}">...</td>
            <td id="trans-${m.entry}">...</td>
        </tr>
    `).join('');
}

async function loadLeagueIntelligence(managers, eventId) {
    await Promise.all(managers.map(async (m) => {
        const picksRes = await fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`);
        const picks = await picksRes.json();
        managerSquads[m.entry] = picks;
        
        // Update Table Cells
        const cap = picks.picks.find(p => p.is_captain);
        document.getElementById(`cap-${m.entry}`).innerText = playerMap[cap.element].name;
    }));

    // Trigger Rivals AI
    const rivalsData = calculateRivals(managers);
    renderRivals(rivalsData);
}

function calculateRivals(managers) {
    const sorted = [...managers].sort((a, b) => a.rank - b.rank);
    const rivals = [];

    for (let i = 0; i < sorted.length; i += 2) {
        if (!sorted[i + 1]) break;
        const m1 = sorted[i];
        const m2 = sorted[i+1];

        // Probabilities
        const m1Avg = m1.total / 20; // Simulated GW count
        const m2Avg = m2.total / 20;
        const m1Prob = Math.round((m1Avg / (m1Avg + m2Avg)) * 100);

        // Winner Logic
        let status = m1.event_total === m2.event_total ? "DRAW" : (m1.event_total > m2.event_total ? `${m1.player_name} LEADING` : `${m2.player_name} LEADING`);

        rivals.push({ m1, m2, m1Prob, m2Prob: 100 - m1Prob, status });
    }
    return rivals;
}

function renderRivals(rivals) {
    const container = document.getElementById("rivals-container");
    container.innerHTML = `<div class="rivals-grid">` + rivals.map(match => `
        <div class="rival-card">
            <div class="rival-matchup">
                <div class="rival-manager">
                    <div class="m-name-small">${match.m1.player_name}</div>
                    <div class="m-score-large">${match.m1.event_total}</div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="rival-manager">
                    <div class="m-name-small">${match.m2.player_name}</div>
                    <div class="m-score-large">${match.m2.event_total}</div>
                </div>
            </div>
            <div class="prob-container">
                <div class="prob-fill-m1" style="width:${match.m1Prob}%"></div>
                <div class="prob-fill-m2" style="width:${match.m2Prob}%"></div>
            </div>
            <div class="ai-status-bar">${match.status}</div>
        </div>
    `).join('') + `</div>`;
}

// Init
document.addEventListener("DOMContentLoaded", () => fetchProLeague(LEAGUES_LIST[0].id));
