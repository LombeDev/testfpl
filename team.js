/**
 * KOPALA FPL - MASTER ENGINE (v4.3.0)
 * UI: Flat Virgil-Style | Logic: 2025/26 Season Ready
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;
window.currentCaptain = ""; 
window.currentViceCaptain = ""; 

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

// --- 1. DATA SYNC & 25/26 MAPPING ---
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
            // Specific overrides for the 25/26 Jersey Library
            if (slug.includes('man_city')) slug = 'man_city';
            if (slug.includes('man_utd')) slug = 'man_utd';
            if (slug.includes('forest')) slug = 'nottm_forest';
            if (slug.includes('palace')) slug = 'crystal_palace';
            if (slug.includes('villa')) slug = 'aston_villa';
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

// --- 2. STATS & AUTO-CAPTAINCY ENGINE ---
function updateStats() {
    let totalCost = 0;
    let baseXP = 0;
    let starerList = [];

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            totalCost += parseFloat(p.price);
            if (!slot.isBench) {
                baseXP += p.xp;
                starerList.push(p);
            }
        }
    });

    // Sort starters by Expected Points for C/V logic
    starerList.sort((a, b) => b.xp - a.xp);
    window.currentCaptain = starerList[0]?.name || "";
    window.currentViceCaptain = starerList[1]?.name || "";

    const bonusXP = starerList[0] ? starerList[0].xp : 0;
    const totalPredictedPoints = (baseXP + bonusXP).toFixed(1);
    const bankVal = (100 - totalCost).toFixed(1);

    // Update UI Elements
    if (document.getElementById('v-xp')) document.getElementById('v-xp').textContent = totalPredictedPoints;
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#2d3436';
    }
}

// --- 3. VIRGIL-STYLE UI RENDERING ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default';
    const fixture = p ? getNextFixtures(p.teamId)[0] : null;
    
    // Status Logic (Yellow warning if p.status is not 'a')
    const isFlagged = p && p.status !== 'a';
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;
    const isVice = p && p.name === window.currentViceCaptain && !slotData.isBench;

    div.innerHTML = `
        <div class="player-card-wrapper" onclick="handleSwap(${slotData.id})">
            <div class="card-visual-area">
                ${isFlagged ? '<div class="status-icon-yellow"><i class="fa-solid fa-triangle-exclamation"></i></div>' : ''}
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                
                <div class="jersey ${jerseyClass}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : (isVice ? '<div class="captain-badge" style="background:#8b97a8">V</div>' : '')}
                </div>
            </div>
            
            <div class="card-footer">
                <div class="p-name-box">${slotData.name || slotData.pos}</div>
                <div class="p-fixture-box">
                    ${fixture ? `${fixture.opp} (${fixture.isHome ? 'H' : 'A'})` : '-'}
                </div>
            </div>
        </div>
        
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(x => x.pos === slotData.pos)
                .sort((a,b) => b.ownership - a.ownership)
                .slice(0, 30)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name} (£${x.price})</option>`).join('')}
        </select>
    `;
    return div;
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    updateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    // Field Rows
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    // Bench Row
    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
}

// --- 4. ENGINE CONTROLS ---
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
        
        // Allowed if same position OR both are outfield starters
        const isSamePos = p1.pos === p2.pos;
        const bothOutfieldStarters = !p1.isBench && !p2.isBench && p1.pos !== 'GKP' && p2.pos !== 'GKP';

        if (p1.id !== p2.id && (isSamePos || bothOutfieldStarters)) {
            const tempName = p1.name;
            p1.name = p2.name;
            p2.name = tempName;
            saveSquad();
        }
        selectedSlotId = null;
        renderPitch();
    }
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .map(f => ({ 
            opp: (teamsDB[f.team_h === teamId ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), 
            isHome: f.team_h === teamId 
        }));
}

function saveSquad() { localStorage.setItem('kopala_saved_squad_v4', JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem('kopala_saved_squad_v4'); 
    if(s) squad = JSON.parse(s); 
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
});
