/**
 * FPL AI ENGINE - CORE INTELLIGENCE SCRIPT
 * Features: AI Rivals, Transfer Scout, War Room Analytics, Hall of Fame
 */

const API_BASE = "/fpl-api/";
const LEAGUES_LIST = [{ name: "Kopala FPL", id: "101712" }];

// Global State
let playerMap = {};
let managerSquads = {}; 
let currentGW = 0;

/**
 * 1. INITIALIZATION & DATA FETCHING
 */
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

        // Build High-Speed Player Map
        staticData.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                total: p.total_points,
                form: parseFloat(p.form),
                price: p.now_cost / 10,
                pos: p.element_type // 1:GK, 2:DEF, 3:MID, 4:FWD
            };
        });

        currentGW = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentGW}`;

        renderTable(leagueData.standings.results);
        await loadLeagueIntelligence(leagueData.standings.results, currentGW);

    } catch (err) { 
        console.error("AI Engine Data Sync Error:", err); 
    }
    
    if (loader) loader.classList.add("hidden");
}

/**
 * 2. LEAGUE TABLE RENDERING
 */
function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map(m => `
        <tr>
            <td>${m.rank}</td>
            <td><strong>${m.player_name}</strong></td>
            <td>${m.event_total}</td>
            <td>${m.total}</td>
            <td id="cap-${m.entry}" class="table-cap-cell">...</td>
        </tr>
    `).join('');
}

/**
 * 3. DEEP INTELLIGENCE LOADING
 */
async function loadLeagueIntelligence(managers, eventId) {
    // Fetch all squads in parallel for efficiency
    await Promise.all(managers.map(async (m) => {
        try {
            const res = await fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`);
            const data = await res.json();
            managerSquads[m.entry] = data;
            
            // Update Captain in Table
            const cap = data.picks.find(p => p.is_captain);
            const capName = playerMap[cap.element]?.name || "Unknown";
            document.getElementById(`cap-${m.entry}`).innerText = capName;
        } catch (e) {
            console.warn(`Could not load squad for manager ${m.entry}`);
        }
    }));

    const rivals = calculateRivals(managers);
    renderRivals(rivals, managers);
}

/**
 * 4. AI ANALYTICS & PREDICTIVE LOGIC
 */
function getManagerTrait(mId) {
    const squad = managerSquads[mId];
    if (!squad) return "🧠 THE ANALYST";
    
    const benchPts = squad.entry_history.points_on_bench;
    const hits = squad.entry_history.event_transfer_cost;

    if (hits > 4) return "📉 THE GAMBLER";
    if (benchPts > 10) return "🪑 THE HOARDER";
    return "🎯 THE TACTICIAN";
}

function predictNextMove(mId) {
    const squad = managerSquads[mId]?.picks;
    if (!squad) return { buy: "Hidden", sell: "None" };

    // Find the starter with the lowest form (Weak Link)
    const weakLink = squad
        .filter(p => p.multiplier > 0)
        .map(p => ({ id: p.element, ...playerMap[p.element] }))
        .sort((a, b) => a.form - b.form)[0];

    // Find a replacement in same position with higher form
    const target = Object.values(playerMap)
        .filter(p => p.pos === weakLink.pos && p.price <= (weakLink.price + 0.5))
        .sort((a, b) => b.form - a.form)[0];

    return {
        sell: weakLink.name,
        buy: target ? target.name : "Top Secret"
    };
}

function calculateRivals(managers) {
    const sorted = [...managers].sort((a, b) => a.rank - b.rank);
    const rivals = [];
    const history = JSON.parse(localStorage.getItem('fpl_rivals_history') || '{}');

    for (let i = 0; i < sorted.length; i += 2) {
        if (!sorted[i + 1]) break;
        const m1 = sorted[i], m2 = sorted[i+1];
        
        const m1Prob = Math.round(((m1.total) / (m1.total + m2.total)) * 100);
        const matchKey = [m1.entry, m2.entry].sort().join('_');

        rivals.push({
            m1, m2, 
            m1Prob, m2Prob: 100 - m1Prob,
            m1Trait: getManagerTrait(m1.entry),
            m2Trait: getManagerTrait(m2.entry),
            m1Scout: predictNextMove(m1.entry),
            m2Scout: predictNextMove(m2.entry),
            isMOTW: i === 0,
            record: history[matchKey] || { [m1.entry]: 0, [m2.entry]: 0 }
        });
    }
    return rivals;
}

/**
 * 5. UI RENDERING
 */
function renderRivals(rivals, allManagers) {
    const hofContainer = document.getElementById("hof-container");
    const container = document.getElementById("rivals-container");

    // Hall of Fame Leaderboard
    const sortedHof = rivals
        .map(r => ({ name: r.m1.player_name, wins: r.record[r.m1.entry] }))
        .sort((a, b) => b.wins - a.wins);

    hofContainer.innerHTML = `
        <div class="hall-of-fame">
            <h3>🏆 AI RIVALS HALL OF FAME</h3>
            ${sortedHof.slice(0, 3).map(m => `
                <div class="hof-row"><span>${m.name}</span><span>${m.wins} Wins</span></div>
            `).join('')}
        </div>`;

    // Rivals Hub
    container.innerHTML = `<div class="rivals-grid">` + rivals.map(match => `
        <div class="rival-card ${match.isMOTW ? 'match-of-the-week' : ''}">
            <div class="rival-matchup">
                <div class="rival-manager">
                    <div class="m-name-small">${match.m1.player_name}</div>
                    <div class="m-score-large">${match.m1.event_total}</div>
                    <div class="trait-tag">${match.m1Trait}</div>
                </div>
                <div class="vs-badge">VS</div>
                <div class="rival-manager">
                    <div class="m-name-small">${match.m2.player_name}</div>
                    <div class="m-score-large">${match.m2.event_total}</div>
                    <div class="trait-tag">${match.m2Trait}</div>
                </div>
            </div>

            <div class="prob-container">
                <div class="prob-fill-m1" style="width:${match.m1Prob}%"></div>
                <div class="prob-fill-m2" style="width:${match.m2Prob}%"></div>
            </div>

            <div class="scout-report">
                <div class="scout-header"><div class="radar-pulse"></div> AI TRANSFER SCOUT</div>
                <div class="scout-prediction">
                    <span>Target: <b style="color:var(--fpl-pink)">${match.m2Scout.buy}</b></span>
                    <span style="opacity:0.5; font-size:0.6rem">Replacing ${match.m2Scout.sell}</span>
                </div>
            </div>

            <button class="compare-btn" onclick="openWarRoom(${match.m1.entry}, ${match.m2.entry})">
                ANALYZE WAR ROOM
            </button>
        </div>
    `).join('') + `</div>`;
}

/**
 * 6. WAR ROOM MODAL (TACTICAL COMPARISON)
 */
function openWarRoom(m1Id, m2Id) {
    const s1 = managerSquads[m1Id]?.picks;
    const s2 = managerSquads[m2Id]?.picks;
    
    if (!s1 || !s2) return alert("Squad data still loading...");

    const s1Ids = s1.map(p => p.element);
    const s2Ids = s2.map(p => p.element);
    const shared = s1Ids.filter(id => s2Ids.includes(id));

    let html = `
        <div class="intel-briefing">
            <span>🤝 SHARED: ${shared.length}</span>
            <span>⚔️ DIFFS: ${11 - shared.length}</span>
        </div>
        <div class="war-room-overlay">`;
    
    for(let i=0; i<11; i++) {
        const p1 = playerMap[s1[i].element], p2 = playerMap[s2[i].element];
        const isShared = shared.includes(s1[i].element);
        
        html += `
            <div class="battle-row ${isShared ? 'shared-player' : 'diff-battle'}">
                <div class="player-cell">
                    <span class="p-pts">${p1.points * s1[i].multiplier}</span>
                    <span class="p-name">${p1.name} ${s1[i].is_captain ? '(C)' : ''}</span>
                </div>
                <div class="battle-status">${isShared ? '🔒' : '⚔️'}</div>
                <div class="player-cell" style="text-align:right">
                    <span class="p-pts">${p2.points * s2[i].multiplier}</span>
                    <span class="p-name">${p2.name} ${s2[i].is_captain ? '(C)' : ''}</span>
                </div>
            </div>`;
    }
    
    document.getElementById("modal-squad-list").innerHTML = html + `</div>`;
    document.getElementById("team-modal").classList.remove("hidden");
}

// Event Listeners
document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
};

// Start AI Engine
document.addEventListener("DOMContentLoaded", () => {
    fetchProLeague(LEAGUES_LIST[0].id);
});
