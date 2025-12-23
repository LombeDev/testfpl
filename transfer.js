/**
 * KOPALA FPL - AI Master Engine (Dec 2025)
 * Features: AI Wildcard, Budget-Aware Transfers, Fixture Cards, Live API Sync
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

// --- 1. LIVE DATA SYNC ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        // Build Team Map (ID to Short Name)
        data.teams.forEach(t => teamsDB[t.id] = t.short_name);
        
        // Build Player Database
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
        
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Engine Online: Dec 2025</span>";
    } catch (e) {
        console.error("Sync Error:", e);
        if (ticker) ticker.textContent = "⚠️ API Error. Using Offline Mode.";
    }
}

// --- 2. AI WILDCARD (Optimizes for £100m) ---
function runAIWildcard() {
    if (!confirm("AI will rebuild your team for max points within £100m. This clears your team. Proceed?")) return;

    let currentBudget = 100.0;
    const selectedNames = [];
    const sorted = [...playerDB].sort((a, b) => b.xp - a.xp);

    squad.forEach((slot, index) => {
        // Reserve a buffer (min ~£4.2m) for the remaining players to avoid bankruptcy
        const reserveCount = squad.length - 1 - index;
        const budgetBuffer = reserveCount * 4.2; 
        
        // Find best XP player in position that fits budget
        const bestChoice = sorted.find(p => 
            p.pos === slot.pos && 
            !selectedNames.includes(p.name) && 
            parseFloat(p.price) <= (currentBudget - budgetBuffer)
        );

        const choice = bestChoice || sorted.filter(p => p.pos === slot.pos && !selectedNames.includes(p.name)).sort((a,b) => a.price - b.price)[0];

        slot.name = choice.name;
        selectedNames.push(choice.name);
        currentBudget -= parseFloat(choice.price);
    });

    saveSquad();
    renderPitch();
}

// --- 3. UI RENDERING & FIXTURES ---
function getNextFixtures(teamId) {
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

// --- 4. ANALYTICS & STATS ---
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
    if(xpEl) xpEl.textContent = xp.toFixed(1);

    const rating = Math.min(100, (xp / 70) * 100);
    const ratingEl = document.getElementById('team-rating');
    if(ratingEl) ratingEl.textContent = rating.toFixed(0) + '%';
    
    const gwEl = document.getElementById('gw-rating');
    if(gwEl) gwEl.textContent = rating > 75 ? "A+" : (rating > 55 ? "B" : "C");

    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) {
        const itb = (100 - val).toFixed(1);
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87';
    }

    renderTransferRecs(players, (100 - val));
}

function renderTransferRecs(squadPlayers, itb) {
    const list = document.getElementById('transfer-list');
    if (!list || squadPlayers.length < 11) return;

    // Suggest Selling 2 Lowest XP players
    const sellCands = [...squadPlayers].sort((a, b) => a.xp - b.xp).slice(0, 2);
    const names = squadPlayers.map(p => p.name);

    list.innerHTML = sellCands.map((sellP) => {
        const limit = parseFloat(sellP.price) + parseFloat(itb);
        // Find highest XP player in same position under budget
        const bestBuy = playerDB.find(p => p.pos === sellP.pos && !names.includes(p.name) && parseFloat(p.price) <= limit);

        return bestBuy ? `
            <div class="transfer-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:white; margin-bottom:8px; border-radius:8px; border-left:5px solid #ff005a; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <div style="flex:1;"><small style="color:#ff005a; font-weight:bold;">SELL ${sellP.pos}</small><br><b>${sellP.name}</b></div>
                <div style="text-align:center; padding:0 10px;"><i class="fa-solid fa-arrow-right"></i></div>
                <div style="flex:1; text-align:right;"><small style="color:#00ff87; font-weight:bold;">BUY ${bestBuy.pos}</small><br><b>${bestBuy.name}</b></div>
            </div>
        ` : '';
    }).join('');
}

// --- 5. CORE LOGIC ---
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

function updatePlayer(id, name) { squad.find(s => s.id === id).name = name; saveSquad(); renderPitch(); }
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
        if (p1.isBench !== p2.isBench) { p1.isBench = !p1.isBench; p2.isBench = !p2.isBench; saveSquad(); }
        selectedSlotId = null;
    }
    renderPitch();
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;
});
