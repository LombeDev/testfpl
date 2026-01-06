/**
 * KOPALA FPL - MASTER ENGINE (v4.3.3)
 * Full 2025/26 Season Update: 
 * - Fixed: ITB, Predicted Points, Team Mapping, and AI Rating
 * - Rule: Max 3 players per team, No duplicates
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

// --- 1. CORE STATS ENGINE ---
function calculateStats() {
    let totalCost = 0;
    let baseXP = 0;
    let maxXP = 0;
    let captainName = "";

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            const price = parseFloat(p.price);
            totalCost += price;

            if (!slot.isBench) {
                const xp = parseFloat(p.xp);
                baseXP += xp;
                // Captaincy: Highest XP starter gets (C)
                if (xp > maxXP) {
                    maxXP = xp;
                    captainName = p.name;
                }
            }
        }
    });

    window.currentCaptain = captainName;

    // 1. In The Bank (ITB)
    const bankVal = (100.0 - totalCost).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#2d3436';
    }

    // 2. Predicted Points (Total xP + Captain Bonus)
    const totalXP = (baseXP + maxXP).toFixed(1);
    const xpEl = document.getElementById('v-xp');
    if (xpEl) xpEl.textContent = totalXP;

    // 3. AI Rating (Target of 75 points for 100% rating)
    const ratingPercent = Math.min(100, Math.max(0, (totalXP / 75) * 100)).toFixed(0);
    const ratingEl = document.getElementById('team-rating');
    if (ratingEl) ratingEl.textContent = `${ratingPercent}%`;
}

// --- 2. DATA SYNC & 2025/26 MAPPING ---
async function syncData() {
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        // Updated 2025/26 Team Slug Mapping
        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            
            // Explicit overrides for 25/26 Clubs
            if (slug.includes('man_city')) slug = 'man_city';
            if (slug.includes('man_utd')) slug = 'man_utd';
            if (slug.includes('forest')) slug = 'nottm_forest';
            if (slug.includes('leeds')) slug = 'leeds';           // Promoted
            if (slug.includes('burnley')) slug = 'burnley';       // Promoted
            if (slug.includes('sunderland')) slug = 'sunderland'; // Promoted
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'spurs';
            
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
        alert("Check API connection or console.");
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
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
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
    
    // Squad State for Validation
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
            <div class="card-footer">
                <div class="p-name-box">${slotData.name || slotData.pos}</div>
            </div>
        </div>
        
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => {
                const samePos = x.pos === slotData.pos;
                const notDup = !currentSquadNames.includes(x.name);
                const underLimit = (teamCounts[x.teamId] || 0) < 3 || (p && x.teamId === p.teamId);
                return samePos && notDup && underLimit;
            })
            .sort((a,b) => b.ownership - a.ownership)
            .slice(0, 30)
            .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name} (£${x.price})</option>`).join('')}
        </select>
    `;
    return div;
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
        // Swap logic: must be same position OR both must be outfield
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

// --- 5. TEMPLATE TEAM (AI WILDCARD) ---
function runAIWildcard() {
    let budget = 100.0;
    let selectedNames = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    // Sort by Expected Points (XP) then Ownership
    const pool = [...playerDB].sort((a, b) => b.xp - a.xp || b.ownership - a.ownership);

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        let count = 0;
        for (let p of pool) {
            if (count >= posLimits[pos]) break;
            
            const price = parseFloat(p.price);
            const slotsLeft = 15 - selectedNames.length;
            const minReserve = slotsLeft * 4.2; // Reserve ~£4.2m for each remaining slot

            if (p.pos === pos && (teamCounts[p.teamId] || 0) < 3 && price <= (budget - minReserve)) {
                selectedNames.push(p.name);
                teamCounts[p.teamId] = (teamCounts[p.teamId] || 0) + 1;
                budget -= price;
                count++;
            }
        }
    });

    // Reset squad and fill with AI choices
    squad.forEach((slot) => {
        const matchingName = selectedNames.find(n => {
            const pObj = playerDB.find(x => x.name === n);
            return pObj.pos === slot.pos;
        });
        if (matchingName) {
            slot.name = matchingName;
            selectedNames = selectedNames.filter(n => n !== matchingName);
        } else {
            slot.name = ""; // Clear if no player found
        }
    });

    saveSquad();
    renderPitch();
}

function saveSquad() { localStorage.setItem('kopala_v4_3_3', JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem('kopala_v4_3_3'); 
    if(s) squad = JSON.parse(s); 
}

// --- 6. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    // Hook Template Button
    const btn = document.getElementById('wildcard-btn') || document.getElementById('ai-template-btn');
    if (btn) btn.onclick = runAIWildcard;
    
    syncData();
});
