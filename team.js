/**
 * KOPALA FPL - AI Master Engine (v2.2)
 * Features: 24-Hour Smart Cache, AI Wildcard, Render Fixes
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

// --- 1. DATA SYNC (WITH 24-HOUR SMART CACHING) ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const CACHE_KEY = 'kopala_player_cache';
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    // STEP A: Try to load from Cache first for speed
    if (cachedData) {
        playerDB = JSON.parse(cachedData);
        teamsDB = JSON.parse(localStorage.getItem('kopala_teams_cache') || '{}');
        loadSquad();
        renderPitch();
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Fresh (Cached)</span>";
            return; // Exit if cache is still valid
        }
    }

    // STEP B: Fetch fresh data if cache is old or missing
    try {
        if (ticker) ticker.textContent = "Syncing live FPL data...";
        
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        data.teams.forEach(t => teamsDB[t.id] = t.short_name);
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team],
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
        console.warn("Network sync failed. Using last known data.");
        if (ticker && playerDB.length > 0) {
            ticker.innerHTML = "📡 <span style='color:orange'>Offline: Using Cached Data</span>";
        }
    }
}

// --- 2. AI WILDCARD (BUDGET-OPTIMIZED) ---
function runAIWildcard() {
    if (!playerDB || playerDB.length === 0) {
        alert("No player data available. Please check your connection.");
        return;
    }

    if (!confirm("AI will rebuild your team for £100m. This replaces your current squad. Proceed?")) return;

    let currentBudget = 100.0;
    const selectedNames = [];
    const sorted = [...playerDB].sort((a, b) => b.xp - a.xp);

    squad.forEach((slot, index) => {
        const reserveCount = squad.length - 1 - index;
        const budgetBuffer = reserveCount * 4.3; // Reserves cash for remaining positions
        
        const bestChoice = sorted.find(p => 
            p.pos === slot.pos && 
            !selectedNames.includes(p.name) && 
            parseFloat(p.price) <= (currentBudget - budgetBuffer)
        );

        // Fallback to budget picks if AI picks are too expensive
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

// --- 3. UI GENERATION ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const player = playerDB.find(p => p.name === slotData.name);
    const fixtures = player ? getNextFixtures(player.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${player ? player.teamShort.toLowerCase() : 'default'}" onclick="handleSwap(${slotData.id})"></div>
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

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return {
                opp: teamsDB[isHome ? f.team_a : f.team_h],
                loc: isHome ? 'H' : 'A',
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
}

// --- 4. ENGINE CORE ---
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

    const xpEl = document.getElementById('v-xp');
    const ratingEl = document.getElementById('team-rating');
    const budgetEl = document.getElementById('budget-val');

    if(xpEl) xpEl.textContent = xp.toFixed(1);
    if(ratingEl) ratingEl.textContent = Math.min(100, (xp / 70) * 100).toFixed(0) + '%';
    
    if(budgetEl) {
        const itb = (100 - val).toFixed(1);
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87';
    }

    renderTransferRecs(players, (100 - val));
}

function renderTransferRecs(squadPlayers, itb) {
    const list = document.getElementById('transfer-list');
    if (!list) return;
    if (squadPlayers.length < 11) {
        list.innerHTML = `<p style="padding:10px; opacity:0.5;">Fill team to see AI recommendations...</p>`;
        return;
    }

    // Sort by actual XP ascending to find worst performers
    const sellCands = [...squadPlayers].sort((a, b) => a.xp - b.xp).slice(0, 2);
    const names = squadPlayers.map(p => p.name);

    list.innerHTML = sellCands.map((sellP) => {
        const limit = parseFloat(sellP.price) + parseFloat(itb);
        const bestBuy = playerDB.find(p => p.pos === sellP.pos && !names.includes(p.name) && parseFloat(p.price) <= limit);

        return bestBuy ? `
            <div class="transfer-row">
                <div>
                    <span class="status-badge-sell">SELL ${sellP.pos}</span>
                    <span class="player-name-small">${sellP.name}</span>
                </div>
                <i class="fa-solid fa-arrow-right"></i>
                <div style="text-align: right;">
                    <span class="status-badge-buy">BUY ${bestBuy.pos}</span>
                    <span class="player-name-small">${bestBuy.name}</span>
                </div>
            </div>
        ` : '';
    }).join('');
}

// --- 5. HELPERS ---
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
            const tempName = p1.name;
            p1.name = p2.name;
            p2.name = tempName;
            saveSquad();
        }
        selectedSlotId = null;
    }
    renderPitch();
}

// --- 6. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;
});
