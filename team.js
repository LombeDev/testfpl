/**
 * KOPALA FPL - MASTER ENGINE (v4.4.2)
 * FULL PRODUCTION SOURCE - NO OMISSIONS
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;
const STORAGE_KEY = 'kopala_v4_4_2';

// 15-man squad structure
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

// --- CORE UTILITIES ---

function getNextFixture(teamId) {
    if (!fixturesDB || fixturesDB.length === 0) return "";
    const next = fixturesDB.find(f => !f.finished && (f.team_h === teamId || f.team_a === teamId));
    if (!next) return "TBC";
    const isHome = next.team_h === teamId;
    const opponentId = isHome ? next.team_a : next.team_h;
    const opponentSlug = teamsDB[opponentId] || "???";
    return `${opponentSlug.substring(0, 3).toUpperCase()} (${isHome ? 'H' : 'A'})`;
}

function calculateStats() {
    let totalCost = 0, baseXP = 0, maxXP = 0, captainName = "";
    let counts = { 'DEF': 0, 'MID': 0, 'FWD': 0 };

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            totalCost += parseFloat(p.price);
            if (!slot.isBench) {
                const xp = parseFloat(p.xp);
                baseXP += xp;
                if (xp > maxXP) { maxXP = xp; captainName = p.name; }
                if (counts.hasOwnProperty(slot.pos)) counts[slot.pos]++;
            }
        }
    });

    window.currentCaptain = captainName;
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        const bankVal = (100.0 - totalCost).toFixed(1);
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#fff';
    }

    const totalXP = (baseXP + maxXP).toFixed(1);
    const xpEl = document.getElementById('v-xp');
    if (xpEl) xpEl.textContent = totalXP;

    const formEl = document.getElementById('formation-label');
    if (formEl) formEl.textContent = `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}

// --- DATA SYNC & JERSEY MAPPING ---

async function syncData() {
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            // Strict Mapping to match CSS
            if (slug.includes('man_city') || (slug.includes('man') && slug.includes('city'))) slug = 'man_city';
            if (slug.includes('man_utd') || (slug.includes('man') && slug.includes('united'))) slug = 'man_utd';
            if (slug.includes('forest')) slug = 'nottm_forest';
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'tottenham';
            if (slug.includes('palace')) slug = 'crystal_palace';
            if (slug.includes('wolves')) slug = 'wolves';
            if (slug.includes('ham')) slug = 'west_ham';
            if (slug.includes('villa')) slug = 'aston_villa';
            if (slug.includes('leeds')) slug = 'leeds';
            if (slug.includes('burnley')) slug = 'burnley';
            if (slug.includes('sunderland')) slug = 'sunderland';
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

        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error: ", e); }
}

// --- UI & INTERACTION ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(posType => {
        const playersInPos = squad.filter(s => !s.isBench && s.pos === posType);
        if (playersInPos.length > 0) {
            const row = document.createElement('div');
            row.className = 'row';
            playersInPos.forEach(slot => row.appendChild(createSlotUI(slot)));
            pitch.appendChild(row);
        }
    });

    const bRow = document.createElement('div');
    bRow.className = 'row bench-row';
    squad.filter(s => s.isBench).sort((a,b) => a.id - b.id).forEach(slot => {
        bRow.appendChild(createSlotUI(slot));
    });
    bench.appendChild(bRow);
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = 'slot';
    div.id = `slot-${slotData.id}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_jersey' : p.teamSlug) : 'default';

    div.innerHTML = `
        <div class="player-card-wrapper ${selectedSlotId === slotData.id ? 'swap-target' : ''}">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${jerseyClass}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
                </div>
                <button class="sub-btn" onclick="event.stopPropagation(); startSubstitution(${slotData.id})">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
            <div class="p-name-box">${slotData.name || slotData.pos}</div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b) => b.ownership - a.ownership).slice(0, 20)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- AUTO-TEAM TEMPLATE ENGINE (FIXED) ---

function loadTemplate() {
    if (!playerDB || playerDB.length === 0) return;
    
    // 1. Reset everything
    squad.forEach(slot => slot.name = '');
    let budget = 100.0;
    const selectedPlayers = new Set();
    const teamCounts = {}; // Key: teamId, Value: count

    // 2. Sort by XP (to get "best" players first)
    const sortedDB = [...playerDB].sort((a, b) => b.xp - a.xp);

    // 3. Fill Squad
    squad.forEach((slot, index) => {
        const remainingSlots = 15 - index;
        const reservedBudget = remainingSlots * 4.2; // Keep ~4.2m for others
        
        const bestFit = sortedDB.find(p => 
            p.pos === slot.pos && 
            parseFloat(p.price) <= (budget - (reservedBudget - 4.2)) && 
            !selectedPlayers.has(p.name) &&
            (teamCounts[p.teamId] || 0) < 3 // THE FIX: STRICTOR 3-PER-TEAM
        );

        if (bestFit) {
            slot.name = bestFit.name;
            budget -= parseFloat(bestFit.price);
            selectedPlayers.add(bestFit.name);
            teamCounts[bestFit.teamId] = (teamCounts[bestFit.teamId] || 0) + 1;
        }
    });

    saveSquad();
    renderPitch();
}

// --- SQUAD LOGIC ---

function startSubstitution(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
        renderPitch(); 
    } else {
        const id1 = selectedSlotId;
        const id2 = id;
        selectedSlotId = null;
        const s1 = squad.find(s => s.id === id1);
        const s2 = squad.find(s => s.id === id2);

        if (id1 === id2) { renderPitch(); return; }
        if ((s1.pos === 'GKP' || s2.pos === 'GKP') && s1.pos !== s2.pos) {
            alert("Goalkeepers only swap with Goalkeepers.");
            renderPitch(); return;
        }

        // Swap Logic
        const tempName = s1.name;
        s1.name = s2.name;
        s2.name = tempName;

        if (!validateFormation()) {
            alert("Invalid Formation! Min: 3 DEF, 2 MID, 1 FWD.");
            s2.name = s1.name; s1.name = tempName; // Revert
        }

        saveSquad();
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

function saveSquad() { localStorage.setItem(STORAGE_KEY, JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem(STORAGE_KEY); 
    if(s) squad = JSON.parse(s); 
}

function resetTeam() {
    if (confirm("Reset Squad?")) {
        squad.forEach(slot => { slot.name = ''; });
        saveSquad(); renderPitch();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    // Buttons
    const rBtn = document.querySelector('.btn-reset');
    if (rBtn) rBtn.onclick = resetTeam;
    const tBtn = document.getElementById('wildcard-btn');
    if (tBtn) tBtn.onclick = loadTemplate;
});
