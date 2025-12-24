/**
 * KOPALA FPL - AI Master Engine (v4.2.0)
 * FEATURES: 
 * - Live Data via CORS Proxy
 * - Strict GK Validation (No outfield players in goal)
 * - Triple Fixture Predictor (Next 3 Games + FDR Colors)
 * - AI Wildcard Optimization
 * - Auto-Formation Detection
 */

const PROXY = "https://corsproxy.io/?";
const API_BASE = "https://fantasy.premierleague.com/api/"; 

let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

// Standard FPL Squad Layout
let squad = [
    { id: 0, pos: 'GKP', name: '', isBench: false },
    { id: 1, pos: 'DEF', name: '', isBench: false },
    { id: 2, pos: 'DEF', name: '', isBench: false },
    { id: 3, pos: 'DEF', name: '', isBench: false },
    { id: 4, pos: 'DEF', name: '', isBench: false },
    { id: 5, pos: 'MID', name: '', isBench: false },
    { id: 6, pos: 'MID', name: '', isBench: false },
    { id: 7, pos: 'MID', name: '', isBench: false },
    { id: 8, pos: 'MID', name: '', isBench: false },
    { id: 9, pos: 'FWD', name: '', isBench: false },
    { id: 10, pos: 'FWD', name: '', isBench: false },
    { id: 11, pos: 'GKP', name: '', isBench: true },
    { id: 12, pos: 'DEF', name: '', isBench: true },
    { id: 13, pos: 'MID', name: '', isBench: true },
    { id: 14, pos: 'FWD', name: '', isBench: true }
];

// --- 1. DATA INITIALIZATION ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    if (ticker) ticker.innerHTML = "⏳ Syncing Live FPL Data...";

    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${PROXY}${API_BASE}bootstrap-static/`),
            fetch(`${PROXY}${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        // Map Team Data
        data.teams.forEach(t => { 
            teamsDB[t.id] = { 
                name: t.name.toLowerCase().replace(/\s+/g, '_'), 
                short: t.short_name 
            }; 
        });
        
        // Map Player Data
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team]?.name || 'default',
            teamCode: teamsDB[p.team]?.short || 'N/A',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            form: p.form
        })).sort((a,b) => b.xp - a.xp);

        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Engine Online</span>";
        
        loadSquad();
        renderPitch();
        renderPlayerList('ALL');
    } catch (e) { 
        console.error("Sync Error:", e);
        if (ticker) ticker.innerHTML = "⚠️ <span style='color:#ff4444'>Connection Error</span>";
    }
}

// --- 2. FIXTURE PREDICTOR ---
function getNextFixtures(teamId) {
    return fixturesDB
        .filter(f => (f.team_a === teamId || f.team_h === teamId) && !f.finished)
        .slice(0, 3)
        .map(f => {
            const isHome = f.team_h === teamId;
            const oppId = isHome ? f.team_a : f.team_h;
            return {
                opp: teamsDB[oppId]?.short || '???',
                difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
}

// --- 3. SWAP & VALIDATION LOGIC ---
function swapPlayers(id1, id2) {
    const s1 = squad.find(s => s.id === id1);
    const s2 = squad.find(s => s.id === id2);

    // Rule: Outfield players cannot be swapped into the GKP slot
    if ((s1.pos === 'GKP' || s2.pos === 'GKP') && s1.pos !== s2.pos) {
        alert("🚨 FPL Rule: Goalkeepers can only be swapped with other Goalkeepers.");
        selectedSlotId = null;
        renderPitch();
        return;
    }

    const tempName = s1.name;
    s1.name = s2.name;
    s2.name = tempName;

    selectedSlotId = null;
    saveSquad();
    renderPitch();
}

// --- 4. AI WILDCARD ENGINE ---
function runAIWildcard() {
    if(!confirm("AI will optimize your 15-man squad for maximum points within £100m. Continue?")) return;
    
    // Reset Current Names
    squad.forEach(s => s.name = "");
    let currentBudget = 100.0;
    const limits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const pool = playerDB.filter(p => p.pos === pos);
        let count = 0;
        for (let p of pool) {
            if (count < limits[pos] && (currentBudget - parseFloat(p.price)) >= 0) {
                const slot = squad.find(s => s.pos === pos && s.name === "");
                if (slot) {
                    slot.name = p.name;
                    currentBudget -= parseFloat(p.price);
                    count++;
                }
            }
        }
    });

    saveSquad();
    renderPitch();
    alert("✨ AI Wildcard Successful!");
}

// --- 5. RENDER UI ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const player = playerDB.find(p => p.name === slotData.name);
    const jersey = player ? (player.pos === 'GKP' ? 'gkp_color' : player.teamShort) : 'default';

    let fixtureHtml = '';
    if (player) {
        const fixtures = getNextFixtures(player.teamId);
        fixtureHtml = `<div class="card-fixtures">` + 
            fixtures.map(f => `<div class="fix-item fdr-${f.difficulty}">${f.opp}</div>`).join('') + 
            `</div>`;
    }

    div.onclick = (e) => {
        e.stopPropagation();
        if (selectedSlotId !== null && selectedSlotId !== slotData.id) {
            swapPlayers(selectedSlotId, slotData.id);
            return;
        }
        selectedSlotId = slotData.id;
        renderPitch();
        renderPlayerList(slotData.pos);
    };

    div.innerHTML = `
        <div class="sub-button">⇄</div>
        <div class="jersey ${jersey}"></div>
        <div class="player-card">
            <div class="card-header">${slotData.name || slotData.pos}</div>
            ${fixtureHtml}
            ${player ? `<div class="xp-badge">${player.xp} Predicted Pts</div>` : ''}
        </div>`;
    return div;
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    
    updateStats();
}

function renderPlayerList(filterPos = 'ALL') {
    const container = document.getElementById('player-list-results');
    if(!container) return;
    const search = document.getElementById('player-search')?.value.toLowerCase() || "";
    
    let filtered = playerDB.filter(p => p.name.toLowerCase().includes(search));
    if (filterPos !== 'ALL') filtered = filtered.filter(p => p.pos === filterPos);

    container.innerHTML = filtered.slice(0, 30).map(p => `
        <div class="list-item" onclick="updatePlayer(selectedSlotId, '${p.name}')">
            <div><b>${p.name}</b><br><small>${p.teamCode} | ${p.pos}</small></div>
            <div style="text-align:right"><b>£${p.price}m</b><br><small>${p.xp} XP</small></div>
        </div>`).join('');
}

// --- 6. STATS & STORAGE ---
function updateStats() {
    let xp = 0, val = 0;
    const starters = squad.filter(s => !s.isBench);
    
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
            if (!s.isBench) xp += p.xp;
        }
    });

    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) budgetEl.textContent = `£${(100 - val).toFixed(1)}m`;
    
    const xpEl = document.getElementById('v-xp');
    if(xpEl) xpEl.textContent = xp.toFixed(1);

    const def = starters.filter(s => s.pos === 'DEF' && s.name).length;
    const mid = starters.filter(s => s.pos === 'MID' && s.name).length;
    const fwd = starters.filter(s => s.pos === 'FWD' && s.name).length;
    const formTicker = document.getElementById('formation-ticker');
    if(formTicker) formTicker.textContent = `FORMATION: ${def}-${mid}-${fwd}`;
}

function updatePlayer(id, name) {
    if(id === null) return;
    const slot = squad.find(s => s.id === id);
    slot.name = name;
    selectedSlotId = null;
    saveSquad();
    renderPitch();
    renderPlayerList();
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// Initialize
document.addEventListener('DOMContentLoaded', syncData);
