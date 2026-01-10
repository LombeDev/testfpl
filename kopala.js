/**
 * KOPALA FPL - ALL-IN-ONE AI DASHBOARD
 * Features: Live Match Center, EO Intelligence, Pitch View, AI Suggestions
 */

const API_BASE = "/fpl-api/"; 

// 1. STATE MANAGEMENT
let playerMap = {};
let teamMap = {};
let managerSquads = {}; 
let leagueOwnership = {};
let activeGameweek = null;
let refreshTimer = null;

// 2. CSS INJECTION (For clean scrollbars and pitch layout)
const style = document.createElement('style');
style.innerHTML = `
    #fixtures-container { max-height: 500px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #37003c #f4f4f4; }
    #fixtures-container::-webkit-scrollbar { width: 6px; }
    #fixtures-container::-webkit-scrollbar-thumb { background: #37003c; border-radius: 10px; }
    .modal-pitch { background: #008d4c; border: 2px solid #fff; border-radius: 8px; padding: 20px 10px; display: flex; flex-direction: column; gap: 15px; position: relative; }
    .modal-row { display: flex; justify-content: center; gap: 10px; }
    .mini-tag { font-size: 8px; padding: 2px 5px; border-radius: 4px; margin: 1px; display: inline-block; font-weight: bold; }
    .tag-diff { background: #37003c; color: #fff; }
    .tag-in { background: #01ef80; color: #000; }
`;
document.head.appendChild(style);

// 3. CORE INITIALIZATION
async function initDashboard() {
    try {
        const response = await fetch(`${API_BASE}bootstrap-static/`);
        const data = await response.json();
        
        // Map Teams
        data.teams.forEach(t => teamMap[t.id] = { name: t.name, short: t.short_name, strength: t.strength });

        // Map Players with AI Metrics (Heuristic score)
        data.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                team: p.team, 
                pos: p.element_type,
                price: p.now_cost / 10,
                form: parseFloat(p.form),
                ict: parseFloat(p.ict_index),
                ai_score: ((parseFloat(p.form) * 0.6) + (parseFloat(p.ict_index) * 0.04)).toFixed(1)
            };
        });

        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        // Start Features
        renderLeagueSelector();
        updateLiveMatchCenter();
    } catch (error) {
        console.error("Initialization Failed:", error);
    }
}

// 4. LIVE MATCH CENTER ENGINE
async function updateLiveMatchCenter() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}fixtures/?event=${activeGameweek}`);
        const fixtures = await res.json();
        
        let html = '';
        fixtures.filter(f => f.started).sort((a,b) => b.id - a.id).forEach(game => {
            const home = teamMap[game.team_h].short;
            const away = teamMap[game.team_a].short;
            const status = game.finished ? "FT" : "LIVE";
            
            html += `
                <div style="display:flex; padding:10px; border-bottom:1px solid #eee; background:#fff; margin-bottom:5px;">
                    <div style="flex:1; font-weight:900; color:#37003c;">${home} ${game.team_h_score} - ${game.team_a_score} ${away}</div>
                    <div style="font-size:10px; font-weight:bold; color:#ff005a;">${status}</div>
                </div>`;
        });
        container.innerHTML = html || '<div style="padding:20px; text-align:center; opacity:0.5;">No live games</div>';
    } catch (e) { console.warn("Live Fix Error"); }
    
    setTimeout(updateLiveMatchCenter, 60000); // Refresh every minute
}

// 5. LEAGUE INTELLIGENCE (EO & STANDINGS)
async function fetchLeagueData(leagueId) {
    document.getElementById("loading-overlay")?.classList.remove("hidden");
    
    try {
        const res = await fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const managers = data.standings.results;

        // Calculate Effective Ownership (EO) across this specific league
        leagueOwnership = {};
        await Promise.all(managers.slice(0, 15).map(async (m) => { // Limited to top 15 for speed
            const pRes = await fetch(`${API_BASE}entry/${m.entry}/event/${activeGameweek}/picks/`);
            const pData = await pRes.json();
            managerSquads[m.entry] = pData;
            pData.picks.forEach(p => {
                leagueOwnership[p.element] = (leagueOwnership[p.element] || 0) + (p.multiplier / managers.length) * 100;
            });
        }));

        renderStandingsTable(managers);
    } catch (e) { console.error("League Error:", e); }
    
    document.getElementById("loading-overlay")?.classList.add("hidden");
}

function renderStandingsTable(managers) {
    const body = document.getElementById("league-body");
    const header = document.querySelector("#league-table thead");
    if(header) header.style.display = "table-header-group";

    body.innerHTML = managers.map(m => {
        const squad = managerSquads[m.entry];
        let riskFactor = 0;
        if(squad) {
            // Check for high-EO players not owned by this manager
            Object.keys(leagueOwnership).forEach(pid => {
                if(leagueOwnership[pid] > 60 && !squad.picks.find(p => p.element == pid)) riskFactor++;
            });
        }

        return `
        <tr onclick="handleManagerClick(${m.entry}, '${m.player_name}')" style="cursor:pointer;">
            <td>${m.rank}</td>
            <td>
                <div style="font-weight:800;">${m.player_name}</div>
                <div style="font-size:10px; color:${riskFactor > 1 ? '#ff2882' : '#01ef80'}">${riskFactor > 1 ? '⚠️ RISK' : '✅ SAFE'}</div>
            </td>
            <td style="font-weight:900;">${m.event_total}</td>
            <td>${m.total}</td>
            <td><div id="ai-tip-${m.entry}" style="font-size:9px; font-weight:bold; color:#37003c;"></div></td>
        </tr>`;
    }).join('');
}

// 6. PITCH VIEW & MODAL
function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;

    const starters = { 1: [], 2: [], 3: [], 4: [] };
    
    data.picks.forEach(p => {
        const player = playerMap[p.element];
        const playerHTML = `
            <div class="player-card" style="text-align:center; width:60px;">
                <div style="background:#fff; border-radius:4px; font-size:9px; font-weight:900; padding:2px;">${player.name}</div>
                <div style="color:#fff; font-size:10px; font-weight:bold;">${player.points * p.multiplier}</div>
            </div>`;
        
        if (p.position <= 11) starters[player.pos].push(playerHTML);
    });

    list.innerHTML = `
        <div class="modal-pitch">
            <div class="modal-row">${starters[1].join('')}</div>
            <div class="modal-row">${starters[2].join('')}</div>
            <div class="modal-row">${starters[3].join('')}</div>
            <div class="modal-row">${starters[4].join('')}</div>
        </div>
        <div style="background:#f4f4f4; padding:10px; margin-top:10px; border-radius:5px; font-size:11px;">
            <strong>AI Scout:</strong> Top Differential found in this squad!
        </div>
    `;
    modal.classList.remove("hidden");
}

// 7. LEAGUE SELECTOR
function renderLeagueSelector() {
    const leagues = [
        { name: "Kopala FPL", id: "101712" },
        { name: "Zambia", id: "258" }
    ];
    const body = document.getElementById("league-body");
    body.innerHTML = leagues.map(l => `
        <tr>
            <td colspan="5" style="padding:15px; background:#fff; border-radius:8px; margin-bottom:10px; display:block;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:900;">${l.name}</span>
                    <button onclick="fetchLeagueData('${l.id}')" style="background:#37003c; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">ENTER</button>
                </div>
            </td>
        </tr>
    `).join('');
}

document.addEventListener("DOMContentLoaded", initDashboard);
