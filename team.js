/**
 * KOPALA FPL - AI Master Engine (v3.5.0)
 * INTEGRATED: 
 * - Dynamic Team Rating & XP Calculation
 * - Intelligent AI Transfer Recommendations
 * - Formation Validator (Enforces FPL Rules)
 * - Substitution/Swap Logic & Mobile Auto-Scroll
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

// --- 1. DATA SYNC & INITIALIZATION ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    const cachedTeams = localStorage.getItem('kopala_teams_cache');

    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad();
        renderPitch();
        renderPlayerList('ALL');
        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Loaded</span>";
    }

    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        data.teams.forEach(t => { teamsDB[t.id] = t.name.toLowerCase().replace(/\s+/g, '_'); });
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0
        })).sort((a,b) => b.xp - a.xp);

        fixturesDB = rawFixtures;
        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        
        renderPitch();
    } catch (e) { console.warn("Live sync failed, using cache."); }
}

// --- 2. CORE UTILITIES ---
function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

function resetSquad() {
    if (confirm("Clear your entire team?")) {
        squad.forEach(slot => slot.name = "");
        saveSquad();
        renderPitch();
        renderPlayerList();
    }
}

function scrollToElement(id) {
    const el = document.getElementById(id);
    if (window.innerWidth <= 768 && el) {
        const yOffset = -20; 
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// --- 3. LOGIC: RATING & RECOMMENDATIONS ---
function calculateTeamRating() {
    const starters = squad.filter(s => !s.isBench && s.name !== "");
    if (starters.length === 0) return 0;

    const totalXP = starters.reduce((sum, s) => {
        const p = playerDB.find(x => x.name === s.name);
        return sum + (p ? p.xp : 0);
    }, 0);
    
    // Benchmarking: 60+ XP is elite. Multiply by fill rate to penalize empty slots.
    const xpRating = Math.min((totalXP / 62) * 100, 100);
    const fillRate = (starters.length / 11);
    return Math.round(xpRating * fillRate);
}

function generateRecommendations() {
    const listContainer = document.getElementById('transfer-list');
    const starters = squad.filter(s => !s.isBench && s.name !== "");
    
    if (starters.length < 11) {
        listContainer.innerHTML = `<div class="empty-state"><p id="ai-msg">Fill your starting 11 to unlock AI logic.</p></div>`;
        return;
    }

    const starterDetails = starters.map(s => playerDB.find(p => p.name === s.name)).filter(Boolean);
    const weakest = starterDetails.sort((a, b) => a.xp - b.xp)[0];
    
    const bankStr = document.getElementById('budget-val').textContent.replace('£', '').replace('m', '');
    const maxBudget = parseFloat(weakest.price) + parseFloat(bankStr);

    const upgrade = playerDB.find(p => p.pos === weakest.pos && !starters.some(s => s.name === p.name) && parseFloat(p.price) <= maxBudget && p.xp > weakest.xp);

    if (upgrade) {
        listContainer.innerHTML = `
            <div class="transfer-item">
                <div class="t-col"><small>OUT</small><span class="transfer-out">${weakest.name}</span></div>
                <div class="transfer-arrow"><i class="fa-solid fa-right-long"></i></div>
                <div class="t-col"><small>IN</small><span class="transfer-in">${upgrade.name}</span></div>
            </div>`;
    } else {
        listContainer.innerHTML = `<div class="empty-state"><p>✅ Team Optimized</p></div>`;
    }
}

// --- 4. SQUAD MANAGEMENT (SUB/TRANSFER) ---
function isValidFormation(squadToTest) {
    const starters = squadToTest.filter(s => !s.isBench);
    const counts = starters.reduce((acc, s) => { acc[s.pos] = (acc[s.pos] || 0) + (s.name ? 1 : 0); return acc; }, {});
    const totalFilled = starters.filter(s => s.name !== "").length;
    if (totalFilled < 11) return { valid: true }; 

    if ((counts['GKP'] || 0) !== 1) return { valid: false, error: "Exactly 1 GK required." };
    if ((counts['DEF'] || 0) < 3) return { valid: false, error: "Min 3 Defenders required." };
    if ((counts['FWD'] || 0) < 1) return { valid: false, error: "Min 1 Forward required." };
    return { valid: true };
}

function swapPlayers(id1, id2) {
    const idx1 = squad.findIndex(s => s.id === id1);
    const idx2 = squad.findIndex(s => s.id === id2);
    const testSquad = JSON.parse(JSON.stringify(squad));
    [testSquad[idx1].name, testSquad[idx2].name] = [testSquad[idx2].name, testSquad[idx1].name];

    const validation = isValidFormation(testSquad);
    if (!validation.valid) { alert(validation.error); selectedSlotId = null; renderPitch(); return; }

    squad = testSquad;
    selectedSlotId = null;
    saveSquad(); renderPitch(); renderPlayerList();
}

function updatePlayer(id, name) {
    const slot = squad.find(s => s.id === id);
    if (name) {
        const player = playerDB.find(p => p.name === name);
        const teamCounts = squad.reduce((acc, s) => {
            if(s.name) { const p = playerDB.find(x => x.name === s.name); if(p) acc[p.teamId] = (acc[p.teamId] || 0) + 1; }
            return acc;
        }, {});
        if ((teamCounts[player.teamId] || 0) >= 3) { alert("Max 3 players per team!"); return; }
    }
    slot.name = name;
    selectedSlotId = null;
    saveSquad(); renderPitch(); renderPlayerList();
}

// --- 5. RENDER UI ---
function renderPlayerList(filterPos = 'ALL') {
    const container = document.getElementById('player-list-results');
    const search = document.getElementById('player-search').value.toLowerCase();
    
    let filtered = playerDB.filter(p => p.name.toLowerCase().includes(search) || p.teamShort.toLowerCase().includes(search));
    if (filterPos !== 'ALL') filtered = filtered.filter(p => p.pos === filterPos);

    let html = (selectedSlotId !== null) ? `
        <div class="selection-actions" style="display:flex; gap:10px; margin-bottom:10px;">
            <button onclick="selectedSlotId=null;renderPitch();renderPlayerList();" style="flex:1; padding:10px; border-radius:8px; border:none;">✕ Back</button>
            <button onclick="updatePlayer(selectedSlotId, '')" style="flex:1; padding:10px; border-radius:8px; border:none; background:#fee2e2; color:#ef4444;">🗑️ Remove</button>
        </div>` : '';

    html += filtered.slice(0, 50).map(p => `
        <div class="list-item" onclick="updatePlayer(selectedSlotId, '${p.name}')">
            <div><b>${p.name}</b><br><small>${p.teamShort.toUpperCase()} | ${p.pos}</small></div>
            <div style="text-align:right"><b>£${p.price}m</b><br><small>${p.xp} XP</small></div>
        </div>`).join('');
    container.innerHTML = html;
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const player = playerDB.find(p => p.name === slotData.name);
    const jersey = player ? (player.pos === 'GKP' ? 'gkp_color' : player.teamShort) : 'default';

    div.onclick = () => {
        if (selectedSlotId !== null && selectedSlotId !== slotData.id) { swapPlayers(selectedSlotId, slotData.id); return; }
        selectedSlotId = slotData.id;
        renderPitch(); 
        renderPlayerList(slotData.pos);
        scrollToElement(slotData.isBench ? 'player-list-results' : 'bench-container');
    };

    div.innerHTML = `<div class="sub-button">⇄</div><div class="jersey ${jersey}"></div>
        <div class="player-card">
            <div class="card-header"><span class="p-name">${slotData.name || slotData.pos}</span></div>
        </div>`;
    return div;
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div'); row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });
    const bRow = document.createElement('div'); bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);

    updateStats();
    generateRecommendations();
}

function updateStats() {
    let xp = 0, val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) { val += parseFloat(p.price); if (!s.isBench) xp += p.xp; }
    });
    document.getElementById('budget-val').textContent = `£${(100 - val).toFixed(1)}m`;
    document.getElementById('v-xp').textContent = xp.toFixed(1);
    
    const rating = calculateTeamRating();
    const ratingEl = document.getElementById('team-rating');
    ratingEl.textContent = `${rating}%`;
    ratingEl.style.color = rating > 80 ? "#00ff87" : (rating > 50 ? "#eab308" : "#ef4444");
    
    const starters = squad.filter(s => !s.isBench);
    const def = starters.filter(s => s.pos === 'DEF' && s.name).length;
    const mid = starters.filter(s => s.pos === 'MID' && s.name).length;
    const fwd = starters.filter(s => s.pos === 'FWD' && s.name).length;
    document.getElementById('formation-ticker').textContent = `FORMATION: ${def}-${mid}-${fwd}`;
}

document.addEventListener('DOMContentLoaded', syncData);
