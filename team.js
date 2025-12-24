/**
 * KOPALA FPL - AI Master Engine (v4.3.0)
 * INTEGRATED WITH YOUR HTML
 */

const PROXY = "https://corsproxy.io/?";
const API_BASE = "https://fantasy.premierleague.com/api/"; 

let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

// Initial 15-man squad structure
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

// --- INITIALIZATION ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${PROXY}${API_BASE}bootstrap-static/`),
            fetch(`${PROXY}${API_BASE}fixtures/`)
        ]);
        
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        // Process Teams
        data.teams.forEach(t => { 
            teamsDB[t.id] = { name: t.name.toLowerCase().replace(/\s+/g, '_'), short: t.short_name }; 
        });
        
        // Process Players
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team]?.name || 'default',
            teamCode: teamsDB[p.team]?.short || 'N/A',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            fdr: p.difficulty || 2
        })).sort((a,b) => b.xp - a.xp);

        ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Engine Online</span>";
        loadSquad();
        renderPitch();
    } catch (e) { 
        ticker.innerHTML = "⚠️ <span style='color:#ff4444'>CORS Blocked: Try using a local server</span>";
    }
}

// --- CORE FUNCTIONS ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    pitch.innerHTML = ''; bench.innerHTML = '';

    // Sort squad into rows by position
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    // Render Bench
    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    
    updateStats();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(x => x.name === slotData.name);
    
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';

    div.innerHTML = `
        <div class="jersey ${jerseyClass}"></div>
        <div class="player-card">
            <div class="card-header">${slotData.name || slotData.pos}</div>
            ${p ? `<div class="xp-badge">${p.xp} XP</div>` : ''}
        </div>`;

    div.onclick = () => {
        selectedSlotId = slotData.id;
        renderPitch();
        renderPlayerList(slotData.pos);
    };
    return div;
}

function renderPlayerList(filterPos = 'ALL') {
    const container = document.getElementById('player-list-results');
    const search = document.getElementById('player-search').value.toLowerCase();
    
    let filtered = playerDB.filter(p => p.name.toLowerCase().includes(search));
    if (filterPos !== 'ALL') filtered = filtered.filter(p => p.pos === filterPos);

    container.innerHTML = filtered.slice(0, 25).map(p => `
        <div class="list-item" onclick="selectPlayer('${p.name}')">
            <div><b>${p.name}</b><br><small>${p.teamCode} | ${p.pos}</small></div>
            <div style="text-align:right"><b>£${p.price}m</b><br><small>${p.xp} XP</small></div>
        </div>`).join('');
}

function selectPlayer(name) {
    if (selectedSlotId === null) return;
    squad[selectedSlotId].name = name;
    saveSquad();
    renderPitch();
}

function updateStats() {
    let totalXp = 0, spent = 0;
    const starters = squad.filter(s => !s.isBench);
    
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            spent += parseFloat(p.price);
            if (!s.isBench) totalXp += p.xp;
        }
    });

    document.getElementById('budget-val').textContent = `£${(100 - spent).toFixed(1)}m`;
    document.getElementById('v-xp').textContent = totalXp.toFixed(1);
    
    // Auto-detect formation
    const def = starters.filter(s => s.pos === 'DEF' && s.name).length;
    const mid = starters.filter(s => s.pos === 'MID' && s.name).length;
    const fwd = starters.filter(s => s.pos === 'FWD' && s.name).length;
    document.getElementById('formation-ticker').textContent = `FORMATION: ${def}-${mid}-${fwd}`;
}

// --- UTILS & AI ---
function resetSquad() {
    if(confirm("Clear your team?")) {
        squad.forEach(s => s.name = "");
        saveSquad();
        renderPitch();
    }
}

function saveSquad() { localStorage.setItem('kopala_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_squad');
    if (saved) squad = JSON.parse(saved);
}

// Attach Wildcard button
document.getElementById('wildcard-btn').onclick = () => {
    alert("AI is calculating the best 100m squad...");
    const limits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };
    squad.forEach(s => s.name = "");
    
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const best = playerDB.filter(p => p.pos === pos).slice(0, limits[pos]);
        best.forEach((p, i) => {
            const slot = squad.find(s => s.pos === pos && s.name === "");
            if (slot) slot.name = p.name;
        });
    });
    renderPitch();
};

document.addEventListener('DOMContentLoaded', syncData);
