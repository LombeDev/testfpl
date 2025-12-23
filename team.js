/**
 * KOPALA FPL - Team AI & Pitch Logic
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let selectedSlotId = null;

// Initial squad structure
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

// --- NAVIGATION LOGIC ---
function initNav() {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('backdrop');

    const toggle = () => {
        drawer.classList.toggle('open');
        backdrop.classList.toggle('active');
    };

    if(menuBtn) menuBtn.onclick = toggle;
    if(closeBtn) closeBtn.onclick = toggle;
    if(backdrop) backdrop.onclick = toggle;
}

// --- DATA SYNC ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const cacheKey = "fpl_bootstrap_cache";
    
    try {
        const cached = localStorage.getItem(cacheKey);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
                data = parsed.content;
            }
        }

        if (!data) {
            const res = await fetch(`${API_BASE}bootstrap-static/`);
            data = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }
        
        data.teams.forEach(t => teamsDB[t.id] = t.name);
        
        playerDB = data.elements.map(p => ({
            name: p.web_name,
            team: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: p.now_cost / 10,
            xp: parseFloat(p.ep_next) || 0
        })).sort((a,b) => b.xp - a.xp);
        
        if (ticker) ticker.innerHTML = "✅ <span style='color:var(--fpl-green)'>Connected to FPL Live</span>";
        renderPitch();
    } catch (e) {
        if (ticker) ticker.textContent = "⚠️ Connection Error";
    }
}

// --- UI RENDERING ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    pitch.innerHTML = ''; 
    bench.innerHTML = '';

    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const starters = squad.filter(s => !s.isBench);
    
    positions.forEach(pos => {
        const rowPlayers = starters.filter(p => p.pos === pos);
        if (rowPlayers.length > 0) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowPlayers.forEach(p => rowDiv.appendChild(createSlotUI(p)));
            pitch.appendChild(rowDiv);
        }
    });

    const benchRow = document.createElement('div');
    benchRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);
    
    updateStats();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    // Format team name for CSS: "Man City" -> "man-city"
    const teamClass = player ? player.team.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '') : 'default';

    div.innerHTML = `
        <div class="jersey ${teamClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-name-tag">${slotData.name || slotData.pos}</div>
        <select class="player-match-tag" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `
                <option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>
            `).join('')}
        </select>
    `;
    return div;
}

function updatePlayer(slotId, name) {
    const slot = squad.find(s => s.id === slotId);
    slot.name = name;
    renderPitch();
}

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        
        if (p1.isBench !== p2.isBench) {
            const temp = p1.isBench;
            p1.isBench = p2.isBench;
            p2.isBench = temp;
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function updateStats() {
    let totalXP = 0;
    let totalValue = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalValue += p.price;
            if (!s.isBench) totalXP += p.xp;
        }
    });
    
    if(document.getElementById('budget-val')) document.getElementById('budget-val').textContent = `£${(100 - totalValue).toFixed(1)}m`;
    if(document.getElementById('score-display')) document.getElementById('score-display').textContent = totalXP.toFixed(0);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    syncData();
});
