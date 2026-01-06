/**
 * KOPALA FPL - MASTER ENGINE (v4.3.1)
 * Fixes: Duplicate Player Prevention, 3-Per-Team Rule, Template Team Logic
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

// --- 1. DATA SYNC ---
async function syncData() {
    try {
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
            if (slug.includes('forest')) slug = 'nottm_forest';
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamSlug: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0,
            status: p.status 
        }));

        fixturesDB = rawFixtures;
        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error", e); }
}

// --- 2. VALIDATION HELPERS ---
function getTeamCounts() {
    const counts = {};
    squad.forEach(slot => {
        if (!slot.name) return;
        const p = playerDB.find(x => x.name === slot.name);
        if (p) counts[p.teamId] = (counts[p.teamId] || 0) + 1;
    });
    return counts;
}

// --- 3. TEMPLATE TEAM (AI WILDCARD) ---
function runAIWildcard() {
    let budget = 100.0;
    let tempSquad = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    // Clear current names to start fresh
    const sortedPlayers = [...playerDB].sort((a, b) => b.xp - a.xp || b.ownership - a.ownership);

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        let count = 0;
        for (let p of sortedPlayers) {
            if (count >= posLimits[pos]) break;

            const price = parseFloat(p.price);
            const remainingSlots = 15 - tempSquad.length;
            const buffer = remainingSlots * 4.3; // Reserve money for remaining slots

            if (p.pos === pos && 
                (teamCounts[p.teamId] || 0) < 3 && 
                price <= (budget - buffer)) {
                
                tempSquad.push(p.name);
                teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1;
                budget -= price;
                count++;
            }
        }
    });

    // Map temp names back to the squad array
    let nameIdx = 0;
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        squad.filter(s => s.pos === pos).forEach(slot => {
            slot.name = tempSquad.find(n => {
                const p = playerDB.find(x => x.name === n);
                return p && p.pos === slot.pos && !squad.some(s2 => s2.name === n);
            }) || "";
            // Remove the name from temp list so it's not reused
            tempSquad = tempSquad.filter(n => n !== slot.name);
        });
    });

    saveSquad();
    renderPitch();
}

// --- 4. UI RENDERING ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const teamCounts = getTeamCounts();
    const currentSquadNames = squad.map(s => s.name).filter(n => n && n !== slotData.name);

    div.innerHTML = `
        <div class="player-card-wrapper" onclick="handleSwap(${slotData.id})">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default'}"></div>
            </div>
            <div class="card-footer">
                <div class="p-name-box">${slotData.name || slotData.pos}</div>
            </div>
        </div>
        
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(x => {
                const isSamePos = x.pos === slotData.pos;
                const isNotDuplicate = !currentSquadNames.includes(x.name);
                const isUnderTeamLimit = (teamCounts[x.teamId] || 0) < 3 || (p && x.teamId === p.teamId);
                return isSamePos && isNotDuplicate && isUnderTeamLimit;
            })
            .sort((a,b) => b.ownership - a.ownership)
            .slice(0, 25)
            .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name} (£${x.price})</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 5. CORE FUNCTIONS ---
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
}

function updatePlayer(id, name) {
    const s = squad.find(slot => slot.id === id);
    if (s) {
        s.name = name;
        saveSquad();
        renderPitch();
    }
}

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
        renderPitch();
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id && (p1.pos === p2.pos || (!p1.isBench && !p2.isBench))) {
            const temp = p1.name;
            p1.name = p2.name;
            p2.name = temp;
            saveSquad();
        }
        selectedSlotId = null;
        renderPitch();
    }
}

function saveSquad() { localStorage.setItem('kopala_v4_3', JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem('kopala_v4_3'); 
    if(s) squad = JSON.parse(s); 
}

document.addEventListener('DOMContentLoaded', () => {
    // FIX: Ensure the button ID matches your HTML
    const templateBtn = document.getElementById('wildcard-btn') || document.getElementById('ai-template-btn');
    if (templateBtn) templateBtn.onclick = runAIWildcard;
    syncData();
});
