/**
 * KOPALA FPL - AI Master Engine (v2.3)
 * Features: 24hr Cache, Offline Jersey Colors, AI Wildcard
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

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

// --- 1. DATA SYNC (24HR CACHE & OFFLINE COLORS) ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const CACHE_KEY = 'kopala_player_cache';
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    // Load from cache immediately for speed/offline
    if (cachedData) {
        playerDB = JSON.parse(cachedData);
        teamsDB = JSON.parse(localStorage.getItem('kopala_teams_cache') || '{}');
        loadSquad();
        renderPitch();
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Fresh (Cached)</span>";
            return; 
        }
    }

    try {
        if (ticker) ticker.textContent = "Syncing live FPL data...";
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        // Build Teams DB and clean names for CSS (e.g., "Man City" -> "man_city")
        data.teams.forEach(t => {
            teamsDB[t.id] = t.short_name.toLowerCase().replace(/\s+/g, '_');
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team], // This matches your CSS classes
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);

        localStorage.setItem(CACHE_KEY, JSON.stringify(playerDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
    } catch (e) {
        console.warn("Sync failed. Staying on cached data.");
        if (ticker && playerDB.length > 0) {
            ticker.innerHTML = "📡 <span style='color:orange'>Offline Mode</span>";
        }
    }
}

// --- 2. UI RENDERING (HANDLES JERSEY CLASS) ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    
    // Logic for Jersey Class
    let jerseyClass = 'default';
    if (player) {
        // If it's a Goalkeeper, use the goalie color, otherwise use team class
        jerseyClass = (player.pos === 'GKP') ? 'gkp_color' : player.teamShort;
    }

    const fixtures = player ? getNextFixtures(player.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}<br>${f.loc}</div>`).join('')}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `<option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 3. AI WILDCARD ---
function runAIWildcard() {
    if (!playerDB || playerDB.length === 0) return;
    if (!confirm("AI will rebuild your team for £100m. Proceed?")) return;

    let currentBudget = 100.0;
    const selectedNames = [];
    const sorted = [...playerDB].sort((a, b) => b.xp - a.xp);

    squad.forEach((slot, index) => {
        const reserveCount = squad.length - 1 - index;
        const budgetBuffer = reserveCount * 4.3; 
        
        const bestChoice = sorted.find(p => 
            p.pos === slot.pos && 
            !selectedNames.includes(p.name) && 
            parseFloat(p.price) <= (currentBudget - budgetBuffer)
        );

        const choice = bestChoice || sorted
            .filter(p => p.pos === slot.pos && !selectedNames.includes(p.name))
            .sort((a,b) => a.price - b.price)[0];

        if (choice) {
            slot.name = choice.name;
            selectedNames.push(choice.name);
            currentBudget -= parseFloat(choice.price);
        }
    });

    saveSquad();
    renderPitch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 4. CORE HELPERS ---
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

function updateStats() {
    let xp = 0, val = 0, players = [];
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
            players.push(p);
            if (!s.isBench) xp += p.xp;
        }
    });

    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) {
        const itb = (100 - val).toFixed(1);
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87';
    }
    
    document.getElementById('v-xp').textContent = xp.toFixed(1);
    document.getElementById('team-rating').textContent = Math.min(100, (xp / 70) * 100).toFixed(0) + '%';
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return {
                opp: teamsDB[isHome ? f.team_a : f.team_h] || 'TBD',
                loc: isHome ? 'H' : 'A',
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
}

function updatePlayer(id, name) { 
    squad.find(s => s.id === id).name = name; 
    saveSquad(); 
    renderPitch(); 
}
function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

function handleSwap(id) {
    if (selectedSlotId === null) { selectedSlotId = id; } 
    else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id && p1.pos === p2.pos) {
            [p1.name, p2.name] = [p2.name, p1.name];
            saveSquad();
        }
        selectedSlotId = null;
    }
    renderPitch();
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;
});
