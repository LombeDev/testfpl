/**
 * KOPALA FPL - AI Master Engine (v4.6.0)
 * MERGED: Advanced Swap Logic + Mobile CORS Bypass + 24hr Cache
 */

const PROXY = "https://corsproxy.io/?";
const API_BASE = "https://fantasy.premierleague.com/api/"; 
const TIME_KEY = 'kopala_cache_timestamp';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

let squad = JSON.parse(localStorage.getItem('kopala_saved_squad')) || [
    { id: 0, pos: 'GKP', name: '', isBench: false },
    { id: 1, pos: 'DEF', name: '', isBench: false }, { id: 2, pos: 'DEF', name: '', isBench: false },
    { id: 3, pos: 'DEF', name: '', isBench: false }, { id: 4, pos: 'DEF', name: '', isBench: false },
    { id: 5, pos: 'MID', name: '', isBench: false }, { id: 6, pos: 'MID', name: '', isBench: false },
    { id: 7, pos: 'MID', name: '', isBench: false }, { id: 8, pos: 'MID', name: '', isBench: false },
    { id: 9, pos: 'FWD', name: '', isBench: false }, { id: 10, pos: 'FWD', name: '', isBench: false },
    { id: 11, pos: 'GKP', name: '', isBench: true }, { id: 12, pos: 'DEF', name: '', isBench: true },
    { id: 13, pos: 'MID', name: '', isBench: true }, { id: 14, pos: 'FWD', name: '', isBench: true }
];

async function syncData() {
    const ticker = document.getElementById('ticker');
    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedTime = localStorage.getItem(TIME_KEY);
    
    // 1. Mobile Cache Check
    if (cachedPlayers && cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS)) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(localStorage.getItem('kopala_fixtures_cache') || '[]');
        teamsDB = JSON.parse(localStorage.getItem('kopala_teams_cache') || '{}');
        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Fresh (Cached)</span>";
        renderPitch();
        return;
    }

    // 2. Fetch via Proxy (Mobile Fix)
    if (ticker) ticker.textContent = "Syncing live FPL data...";
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${PROXY}${encodeURIComponent(API_BASE + 'bootstrap-static/')}`),
            fetch(`${PROXY}${encodeURIComponent(API_BASE + 'fixtures/')}`)
        ]);
        
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        // Process Teams
        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            teamsDB[t.id] = slug;
        });

        // Process Players
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

        // Save everything to localStorage
        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
        renderPitch();
    } catch (e) {
        console.error("Sync failed:", e);
        if (ticker) ticker.innerHTML = "📡 <span style='color:orange'>Offline: Using Cached Data</span>";
    }
}

// --- Swap & Validation ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);

        if (p1.id !== p2.id) {
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers can only be swapped with Goalkeepers.");
            } else {
                // Swap logic
                const tempName = p1.name;
                const tempPos = p1.pos;
                p1.name = p2.name; p1.pos = p2.pos;
                p2.name = tempName; p2.pos = tempPos;

                if (!isValidFormation()) {
                    alert("Invalid! Need 3+ DEF, 2+ MID, 1+ FWD");
                    p2.name = p1.name; p2.pos = p1.pos;
                    p1.name = tempName; p1.pos = tempPos;
                } else {
                    localStorage.setItem('kopala_saved_squad', JSON.stringify(squad));
                }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const defs = active.filter(s => s.pos === 'DEF').length;
    const mids = active.filter(s => s.pos === 'MID').length;
    const fwds = active.filter(s => s.pos === 'FWD').length;
    return defs >= 3 && mids >= 2 && fwds >= 1;
}

// --- Renderers ---
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

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    const jerseyClass = player ? (player.pos === 'GKP' ? 'gkp_color' : player.teamShort) : 'default';
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
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => 
                `<option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
        </select>`;
    return div;
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB
        .filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3)
        .map(f => {
            const isHome = f.team_h === teamId;
            return {
                opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(),
                loc: isHome ? 'H' : 'A',
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

function updatePlayer(id, name) { 
    squad.find(s => s.id === id).name = name; 
    localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); 
    renderPitch(); 
}

document.addEventListener('DOMContentLoaded', syncData);
