const API_BASE = "/fpl-api/";
const LEAGUES_LIST = [{ name: "Kopala FPL", id: "101712" }];

let playerMap = {};
let managerSquads = {}; 

async function fetchProLeague(leagueId) {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, total: p.total_points };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        renderTable(leagueData.standings.results);
        await loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { console.error("Error:", err); }
    if (loader) loader.classList.add("hidden");
}

function renderTable(managers) {
    document.getElementById("league-body").innerHTML = managers.map(m => `
        <tr>
            <td>${m.rank}</td>
            <td><strong>${m.player_name}</strong></td>
            <td>${m.event_total}</td>
            <td>${m.total}</td>
            <td id="cap-${m.entry}">...</td>
        </tr>
    `).join('');
}

async function loadLeagueIntelligence(managers, eventId) {
    await Promise.all(managers.map(async (m) => {
        const res = await fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`);
        managerSquads[m.entry] = await res.json();
        const cap = managerSquads[m.entry].picks.find(p => p.is_captain);
        document.getElementById(`cap-${m.entry}`).innerText = playerMap[cap.element].name;
    }));

    const rivals = calculateRivals(managers);
    renderRivals(rivals, managers);
}

function calculateRivals(managers) {
    const sorted = [...managers].sort((a, b) => a.rank - b.rank);
    const rivals = [];
    const history = JSON.parse(localStorage.getItem('fpl_rivals_history') || '{}');

    for (let i = 0; i < sorted.length; i += 2) {
        if (!sorted[i + 1]) break;
        const m1 = sorted[i], m2 = sorted[i+1];
        
        // Win Probability
        const m1Prob = Math.round(((m1.total) / (m1.total + m2.total)) * 100);
        const matchKey = [m1.entry, m2.entry].sort().join('_');

        rivals.push({
            m1, m2, m1Prob, m2Prob: 100 - m1Prob,
            isMOTW: i === 0,
            record: history[matchKey] || { [m1.entry]: 0, [m2.entry]: 0 }
        });
    }
    return rivals;
}

function renderRivals(rivals, allManagers) {
    const hofContainer = document.getElementById("hof-container");
    const container = document.getElementById("rivals-container");

    // Hall of Fame
    hofContainer.innerHTML = `
        <div class="hall-of-fame">
            <h3>🏆 HALL OF FAME</h3>
            ${rivals.slice(0, 3).map(r => `<div class="hof-row"><span>${r.m1.player_name}</span><span>${r.record[r.m1.entry]} Wins</span></div>`).join('')}
        </div>`;

    // Rivals Grid
    container.innerHTML = `<div class="rivals-grid">` + rivals.map(match => `
        <div class="rival-card ${match.isMOTW ? 'match-of-the-week' : ''}">
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
            <div class="prob-container"><div class="prob-fill-m1" style="width:${match.m1Prob}%"></div><div class="prob-fill-m2" style="width:${match.m2Prob}%"></div></div>
            <button class="compare-btn" onclick="openWarRoom(${match.m1.entry}, ${match.m2.entry})">WAR ROOM ANALYTICS</button>
        </div>
    `).join('') + `</div>`;
}

function openWarRoom(m1Id, m2Id) {
    const s1 = managerSquads[m1Id].picks, s2 = managerSquads[m2Id].picks;
    let html = `<div class="war-room-overlay">`;
    for(let i=0; i<11; i++) {
        const p1 = playerMap[s1[i].element], p2 = playerMap[s2[i].element];
        html += `<div class="battle-row"><span>${p1.name} (${p1.points})</span><span>VS</span><span>${p2.name} (${p2.points})</span></div>`;
    }
    document.getElementById("modal-squad-list").innerHTML = html + `</div>`;
    document.getElementById("team-modal").classList.remove("hidden");
}

document.getElementById("close-modal").onclick = () => document.getElementById("team-modal").classList.add("hidden");
document.addEventListener("DOMContentLoaded", () => fetchProLeague(LEAGUES_LIST[0].id));
