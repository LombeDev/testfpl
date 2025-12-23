/**
 * KOPALA FPL - AI Master Engine (v2.4)
 * Features: Offline Jersey Logic, 24hr Smart Cache, AI Wildcard
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

// Initial Squad Structure
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

// --- 1. DATA SYNC (With Persistent Jersey Slugs) ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const CACHE_KEY = 'kopala_player_cache';
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    // STEP A: Load from Cache immediately (Supports Offline Colors)
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

    // STEP B: Fetch fresh data
    try {
        if (ticker) ticker.textContent = "Syncing live FPL data...";
        
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        // Map Teams and create CSS Slugs (e.g., "Man Utd" -> "man_utd")
        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            // Manual overrides for API variations
            if (slug.includes('man_city')) slug = 'man_city';
            if (slug.includes('man_utd')) slug = 'man_utd';
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'tottenham';
            
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default', // Matches your CSS classes
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);

        // Update Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(playerDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
    } catch (e) {
        console.warn("Network sync failed. Offline mode active.");
        if (ticker && playerDB.length > 0) {
            ticker.innerHTML = "📡 <span style='color:orange'>Offline: Using Cached Kits</span>";
        }
    }
}

// --- 2. DYNAMIC UI GENERATION ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    
    // Logic: Goalies always use goalie kit, others use their team kit class
    let jerseyClass = 'default';
    if (player) {
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

// --- 3. CORE LOGIC ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    // Main Field
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    // Bench
    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    
    updateStats();
}

function updateStats() {
    let xp = 0, val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
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

// --- 4. ENGINE HELPERS ---
function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return {
                opp: teamsDB[isHome ? f.team_a : f.team_h]?.toUpperCase().substring(0,3) || 'TBD',
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

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id && p1.pos === p2.pos) {
            const temp = p1.name;
            p1.name = p2.name;
            p2.name = temp;
            saveSquad();
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function runAIWildcard() {
    if (!playerDB.length) return;
    if (!confirm("AI will rebuild your squad. Continue?")) return;

    let budget = 100.0;
    const used = [];
    const sorted = [...playerDB].sort((a,b) => b.xp - a.xp);

    squad.forEach((slot, i) => {
        const buffer = (squad.length - 1 - i) * 4.4;
        const choice = sorted.find(p => p.pos === slot.pos && !used.includes(p.name) && p.price <= (budget - buffer)) 
                      || sorted.filter(p => p.pos === slot.pos && !used.includes(p.name)).sort((a,b)=>a.price-b.price)[0];
        if (choice) {
            slot.name = choice.name;
            used.push(choice.name);
            budget -= parseFloat(choice.price);
        }
    });
    saveSquad();
    renderPitch();
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// --- 5. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;
});
