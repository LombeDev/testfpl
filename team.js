/**
 * KOPALA FPL - MASTER ENGINE (v4.0.0)
 * Logic: High Ownership Priority + Auto-Captaincy + AI Rating
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;
window.currentCaptain = ""; // Track the highest xP starter

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

        // Map Team Slugs for 2025/26 Season
        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            if (slug.includes('man_city')) slug = 'man_city';
            if (slug.includes('man_utd')) slug = 'man_utd';
            if (slug.includes('forest')) slug = 'nottm_forest';
            teamsDB[t.id] = slug;
        });

        // Map Player Data
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamSlug: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0
        }));

        fixturesDB = rawFixtures;
        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error", e); }
}

// --- 2. AI SQUAD GENERATOR (Template/High Ownership) ---
function runAIWildcard() {
    let budget = 100.0;
    const newSquad = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        for (let i = 0; i < posLimits[pos]; i++) {
            const buffer = 4.4 * (15 - newSquad.length);
            const choice = playerDB.filter(p => 
                p.pos === pos && !newSquad.some(s => s.name === p.name) && 
                (teamCounts[p.teamId] || 0) < 3 && parseFloat(p.price) <= (budget - buffer)
            ).sort((a, b) => b.ownership - a.ownership || b.xp - a.xp)[0];

            if (choice) {
                newSquad.push({ 
                    id: newSquad.length, 
                    pos: pos, 
                    name: choice.name, 
                    isBench: newSquad.length > 10 
                });
                teamCounts[choice.teamId] = (teamCounts[choice.teamId] || 0) + 1;
                budget -= parseFloat(choice.price);
            }
        }
    });
    squad = newSquad;
    changeFormation('3-4-3'); 
}

// --- 3. STATS & RATING LOGIC ---
function updateStats() {
    let totalCost = 0;
    let baseXP = 0;
    let maxXP = 0;
    let captainName = "";

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            totalCost += parseFloat(p.price);
            if (!slot.isBench) {
                const pXP = parseFloat(p.xp);
                baseXP += pXP;
                if (pXP > maxXP) {
                    maxXP = pXP;
                    captainName = p.name;
                }
            }
        }
    });

    const totalPredictedPoints = (baseXP + maxXP).toFixed(1);
    const bankVal = (100 - totalCost).toFixed(1);
    
    // AI Rating Benchmark (72 pts is elite including captain)
    const eliteBenchmark = 72.0; 
    const ratingPercent = Math.min(100, (totalPredictedPoints / eliteBenchmark) * 100).toFixed(0);

    // Update UI Elements
    document.getElementById('v-xp').textContent = totalPredictedPoints;
    
    const ratingEl = document.getElementById('team-rating');
    if (ratingEl) {
        ratingEl.textContent = `${ratingPercent}%`;
        ratingEl.style.color = ratingPercent >= 80 ? '#00ff87' : (ratingPercent >= 50 ? '#ffd166' : '#ff005a');
    }

    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#2d3436';
    }

    window.currentCaptain = captainName;
}

// --- 4. UI RENDERING ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    updateStats(); // Run stats first to get Captain ID
    
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

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default';
    const fixture = p ? getNextFixtures(p.teamId)[0] : null;
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})">
            ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
        </div>
        <div class="player-card">
            <span class="p-name">${slotData.name || slotData.pos}</span>
            <div class="card-fixtures">
                ${fixture ? `<div class="fix-item diff-${fixture.diff}">${fixture.opp} ${fixture.isHome?'(H)':'(A)'}</div>` : ''}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b)=>b.ownership-a.ownership).slice(0,30).map(x => 
                `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name} (${x.ownership}%)</option>`
            ).join('')}
        </select>
    `;
    return div;
}

// --- 5. INTERACTION HELPERS ---
function handleSwap(id) {
    if (selectedSlotId === null) { selectedSlotId = id; } 
    else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id && (p1.pos === p2.pos || (p1.pos !== 'GKP' && p2.pos !== 'GKP'))) {
            const temp = p1.isBench; p1.isBench = p2.isBench; p2.isBench = temp;
            saveSquad();
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function updatePlayer(id, name) {
    squad.find(s => s.id === id).name = name;
    saveSquad(); renderPitch();
}

function changeFormation(f) {
    const [d, m, fwd] = f.split('-').map(Number);
    squad.forEach(s => s.isBench = true);
    squad.filter(s => s.pos === 'GKP')[0].isBench = false;
    const activate = (p, l) => { let c = 0; squad.filter(s => s.pos === p).forEach(s => { if(c<l){s.isBench=false; c++;}});};
    activate('DEF', d); activate('MID', m); activate('FWD', fwd);
    saveSquad(); renderPitch();
}

function getNextFixtures(teamId) {
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .map(f => ({ 
            opp: (teamsDB[f.team_h === teamId ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), 
            diff: f.team_h === teamId ? f.team_h_difficulty : f.team_a_difficulty, 
            isHome: f.team_h === teamId 
        }));
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() { const s = localStorage.getItem('kopala_saved_squad'); if(s) squad = JSON.parse(s); }

// --- 6. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;

    const fs = document.getElementById('formation-select');
    if (fs) fs.onchange = (e) => changeFormation(e.target.value);

    syncData();
});
