/**
 * KOPALA FPL - AI Master Engine (v2.8.0)
 * FEATURES: Two-Column Desktop Layout + Original Mobile Dropdowns
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

// --- 1. DATA SYNC & CACHING ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    const cachedTeams = localStorage.getItem('kopala_teams_cache');
    const cachedTime = localStorage.getItem(TIME_KEY);
    
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad();
        renderPitch();
        renderPlayerList('ALL');
        
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Fresh</span>";
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
        const rawFixtures = await fixRes.json();

        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            if (slug.includes('man_city')) slug = 'man_city';
            if (slug.includes('man_utd')) slug = 'man_utd';
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'tottenham';
            teamsDB[t.id] = slug;
        });

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
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        renderPlayerList('ALL');
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Master Engine Online</span>";
    } catch (e) {
        console.warn("Sync failed.", e);
    }
}

// --- 2. VALIDATION HELPERS ---
function getTeamCounts() {
    const counts = {};
    squad.forEach(slot => {
        if (slot.name) {
            const player = playerDB.find(p => p.name === slot.name);
            if (player) {
                counts[player.teamId] = (counts[player.teamId] || 0) + 1;
            }
        }
    });
    return counts;
}

// --- 3. DESKTOP MARKET LOGIC ---
function renderPlayerList(filterPos = 'ALL') {
    const listContainer = document.getElementById('player-list-results');
    const searchInput = document.getElementById('player-search');
    if (!listContainer || window.innerWidth <= 900) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    
    // Update Tab UI active states
    document.querySelectorAll('.filter-tabs button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${filterPos}`);
    if(activeBtn) activeBtn.classList.add('active');

    let filtered = playerDB.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.teamShort.toLowerCase().includes(searchTerm)
    );

    if (filterPos !== 'ALL') {
        filtered = filtered.filter(p => p.pos === filterPos);
    }

    listContainer.innerHTML = filtered.slice(0, 50).map(p => `
        <div class="list-item" onclick="selectFromList('${p.name}')">
            <div>
                <b style="font-size: 0.9rem;">${p.name}</b><br>
                <small style="color: #666;">${p.teamShort.toUpperCase()} | ${p.pos}</small>
            </div>
            <div style="text-align: right;">
                <span style="color: #008037; font-weight: bold;">£${p.price}m</span><br>
                <small>${p.xp} XP</small>
            </div>
        </div>
    `).join('');
}

function selectFromList(playerName) {
    if (selectedSlotId === null) {
        alert("Please select a position on the pitch first.");
        return;
    }
    updatePlayer(selectedSlotId, playerName);
}

// --- 4. CORE SQUAD UPDATES ---
function updatePlayer(id, name) { 
    if (!name) {
        squad.find(s => s.id === id).name = "";
        saveSquad(); 
        renderPitch();
        return;
    }

    const player = playerDB.find(p => p.name === name);
    const teamCounts = getTeamCounts();
    const currentSlot = squad.find(s => s.id === id);
    const existingPlayer = playerDB.find(p => p.name === currentSlot.name);

    // Rule: Max 3 players per team
    if (!existingPlayer || existingPlayer.teamId !== player.teamId) {
        if ((teamCounts[player.teamId] || 0) >= 3) {
            alert(`Limit reached! 3 players already selected from ${player.teamShort.toUpperCase()}.`);
            renderPitch(); // Reset UI
            return;
        }
    }

    currentSlot.name = name; 
    saveSquad(); 
    selectedSlotId = null; 
    renderPitch(); 
}

// --- 5. PITCH RENDERING ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    const isDesktop = window.innerWidth > 900;
    
    div.className = `slot ${(isDesktop && selectedSlotId === slotData.id) ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    let jerseyClass = player ? ((player.pos === 'GKP') ? 'gkp_color' : player.teamShort) : 'default';
    const fixtures = player ? getNextFixtures(player.teamId) : [];

    // Desktop Click Handler
    div.onclick = () => {
        if (isDesktop) {
            selectedSlotId = slotData.id;
            renderPitch(); 
            renderPlayerList(slotData.pos);
        }
    };

    div.innerHTML = `
        <div class="jersey ${jerseyClass}"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.length > 0 ? fixtures.map(f => `
                    <div class="fix-item diff-${f.diff}">${f.opp}</div>`).join('') : '<div class="fix-item">---</div>'}
            </div>
        </div>

        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)" onclick="event.stopPropagation()">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => 
                `<option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name} (£${p.price}m)</option>`
            ).join('')}
        </select>
    `;
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

// --- 6. AI & UTILS ---
function getNextFixtures(teamId) {
    if (!fixturesDB || fixturesDB.length === 0) return [];
    return fixturesDB
        .filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3)
        .map(f => {
            const isHome = f.team_h === teamId;
            const oppId = isHome ? f.team_a : f.team_h;
            return {
                opp: (teamsDB[oppId] || "???").substring(0,3).toUpperCase(),
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
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
    if(budgetEl) budgetEl.textContent = `£${(100 - val).toFixed(1)}m`;
    const xpDisplay = document.getElementById('v-xp');
    if(xpDisplay) xpDisplay.textContent = xp.toFixed(1);
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// Listen for resizing to swap UI modes
window.addEventListener('resize', () => {
    renderPitch();
    if (window.innerWidth > 900) renderPlayerList('ALL');
});

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = () => alert("AI Wildcard logic processing..."); 
});
