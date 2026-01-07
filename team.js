/**
 * KOPALA FPL - MASTER ENGINE (v4.3.7)
 * Full 2025/26 Season Production Script
 * Features: Dynamic Formations, GK Swap Locks, 20-Team Mapping, Balanced Templates
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

// --- 1. CORE STATS & FORMATION ENGINE ---
function calculateStats() {
    let totalCost = 0;
    let baseXP = 0;
    let maxXP = 0;
    let captainName = "";

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            totalCost += parseFloat(p.price);
            if (!slot.isBench) {
                const xp = parseFloat(p.xp);
                baseXP += xp;
                if (xp > maxXP) { maxXP = xp; captainName = p.name; }
            }
        }
    });

    window.currentCaptain = captainName;

    const bankVal = (100.0 - totalCost).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#2d3436';
    }

    const totalXP = (baseXP + maxXP).toFixed(1);
    const xpEl = document.getElementById('v-xp');
    if (xpEl) xpEl.textContent = totalXP;

    const ratingPercent = Math.min(100, Math.max(0, (totalXP / 75) * 100)).toFixed(0);
    const ratingEl = document.getElementById('team-rating');
    if (ratingEl) ratingEl.textContent = `${ratingPercent}%`;
}

// --- 2. DATA SYNC ---
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
            if (slug.includes('city')) slug = 'man_city';
            if (slug.includes('united') && slug.includes('man')) slug = 'man_utd';
            if (slug.includes('forest')) slug = 'nottm_forest';
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'tottenham';
            if (slug.includes('palace')) slug = 'crystal_palace';
            if (slug.includes('wolves')) slug = 'wolves';
            if (slug.includes('ham')) slug = 'west_ham';
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
            ownership: parseFloat(p.selected_by_percent) || 0
        }));

        fixturesDB = rawFixtures;
        loadSquad();
        renderPitch();
    } catch (e) { 
        console.error("Sync Error: ", e); 
    }
}

// --- 3. UI RENDERING ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const startersInPos = squad.filter(s => !s.isBench && s.pos === pos);
        if (startersInPos.length > 0) {
            const row = document.createElement('div');
            row.className = 'row';
            startersInPos.forEach(p => row.appendChild(createSlotUI(p)));
            pitch.appendChild(row);
        }
    });

    const bRow = document.createElement('div');
    bRow.className = 'row bench-row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;
    const currentSquadNames = squad.map(s => s.name).filter(n => n && n !== slotData.name);
    
    const teamCounts = {};
    squad.forEach(s => {
        const pl = playerDB.find(x => x.name === s.name);
        if(pl) teamCounts[pl.teamId] = (teamCounts[pl.teamId] || 0) + 1;
    });

    div.innerHTML = `
        <div class="player-card-wrapper" onclick="handleSwap(${slotData.id})">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default'}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
                </div>
            </div>
            <div class="p-name-box">${slotData.name || slotData.pos}</div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => x.pos === slotData.pos && !currentSquadNames.includes(x.name) && ((teamCounts[x.teamId] || 0) < 3 || (p && x.teamId === p.teamId)))
                .sort((a,b) => b.ownership - a.ownership).slice(0, 25)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 4. ENGINE CONTROLS ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
        renderPitch();
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id) {
            const involvesGK = p1.pos === 'GKP' || p2.pos === 'GKP';
            const differentPos = p1.pos !== p2.pos;
            if (involvesGK && differentPos) {
                alert("Goalkeepers can only be swapped with other Goalkeepers.");
            } else {
                const tempName = p1.name;
                const tempPos = p1.pos;
                p1.name = p2.name; p1.pos = p2.pos;
                p2.name = tempName; p2.pos = tempPos;
                if (!validateFormation()) {
                    alert("Invalid Formation! (Min: 3 DEF, 2 MID, 1 FWD)");
                    p2.name = p1.name; p2.pos = p1.pos;
                    p1.name = tempName; p1.pos = tempPos;
                } else {
                    saveSquad();
                }
            }
        }
        selectedSlotId = null;
        renderPitch();
    }
}

function validateFormation() {
    const starters = squad.filter(s => !s.isBench);
    const counts = { 'GKP': 0, 'DEF': 0, 'MID': 0, 'FWD': 0 };
    starters.forEach(s => counts[s.pos]++);
    return (counts['GKP'] === 1 && counts['DEF'] >= 3 && counts['MID'] >= 2 && counts['FWD'] >= 1);
}

function updatePlayer(id, name) {
    const s = squad.find(slot => slot.id === id);
    if (s) { s.name = name; saveSquad(); renderPitch(); }
}

function saveSquad() { localStorage.setItem('kopala_v4_3_7', JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem('kopala_v4_3_7'); 
    if(s) squad = JSON.parse(s); 
}

// --- 5. NEW: REPAIRED RESET & TEMPLATE LOGIC ---

function resetTeam() {
    if (confirm("Clear entire squad?")) {
        // Clear all names in the data
        squad.forEach(slot => {
            slot.name = '';
        });
        saveSquad();   // Save the empty state
        renderPitch(); // Re-draw the pitch (removes jerseys)
    }
}

function loadTemplate() {
    if (playerDB.length === 0) {
        alert("Data still loading, please wait...");
        return;
    }

    let currentBudget = 100.0;
    const playersSelected = new Set();
    const teamCounts = {};
    const sortedDB = [...playerDB].sort((a, b) => b.ownership - a.ownership);

    squad.forEach((slot, index) => {
        const slotsRemaining = squad.length - index;
        const maxSpend = currentBudget - (slotsRemaining * 4.0);
        
        // Find the most owned player that fits budget and team limits
        const bestFit = sortedDB.find(p => 
            p.pos === slot.pos && 
            parseFloat(p.price) <= maxSpend &&
            !playersSelected.has(p.name) &&
            (teamCounts[p.teamId] || 0) < 3
        );

        if (bestFit) {
            slot.name = bestFit.name;
            currentBudget -= parseFloat(bestFit.price);
            playersSelected.add(bestFit.name);
            teamCounts[bestFit.teamId] = (teamCounts[bestFit.teamId] || 0) + 1;
        }
    });

    saveSquad();
    renderPitch();
}

// Initialize and Bind Buttons
document.addEventListener('DOMContentLoaded', () => {
    syncData();

    // Fix: Using querySelector to ensure we find the buttons
    const rBtn = document.getElementById('reset-team-btn');
    const tBtn = document.getElementById('template-team-btn');

    if (rBtn) {
        rBtn.onclick = resetTeam; // Alternative to addEventListener for reliability
    }
    
    if (tBtn) {
        tBtn.onclick = loadTemplate;
    }
});
