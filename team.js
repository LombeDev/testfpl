/**
 * KOPALA FPL - MASTER ENGINE (v4.3.9)
 * Full 2025/26 Season Production Script
 * Includes: Animated Subs, Next Fixture, & Dynamic Formations
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

const STORAGE_KEY = 'kopala_v4_3_7';

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

// --- 1. HELPERS ---

function getNextFixture(teamId) {
    if (!fixturesDB.length) return "";
    const next = fixturesDB.find(f => !f.finished && (f.team_h === teamId || f.team_a === teamId));
    if (!next) return "TBC";
    const isHome = next.team_h === teamId;
    const opponentSlug = teamsDB[isHome ? next.team_a : next.team_h] || "???";
    return `${opponentSlug.substring(0, 3).toUpperCase()} (${isHome ? 'H' : 'A'})`;
}

function calculateStats() {
    let totalCost = 0, baseXP = 0, maxXP = 0, captainName = "";
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
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        const bank = (100.0 - totalCost).toFixed(1);
        budgetEl.textContent = `£${bank}m`;
        budgetEl.style.color = (bank < 0) ? '#ff005a' : '#2d3436';
    }
    if (document.getElementById('v-xp')) document.getElementById('v-xp').textContent = (baseXP + maxXP).toFixed(1);
}

// --- 2. DATA SYNC ---

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
            if (slug.includes('city')) slug = 'man_city';
            if (slug.includes('united') && slug.includes('man')) slug = 'man_utd';
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id, name: p.web_name, teamId: p.team,
            teamSlug: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0
        }));

        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error", e); }
}

// --- 3. UI RENDERING ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    // Dynamic Pitch Rows (allows formation to change)
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
    const fixText = p ? `<span style="opacity: 0.6; font-weight: 400; font-size: 8px;"> ${getNextFixture(p.teamId)}</span>` : "";

    div.innerHTML = `
        <div class="player-card-wrapper ${selectedSlotId === slotData.id ? 'swap-target' : ''}">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default'}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
                </div>
                <button class="sub-btn" onclick="event.stopPropagation(); startSubstitution(${slotData.id})">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
            <div class="p-name-box">${slotData.name || slotData.pos}${fixText}</div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b) => b.ownership - a.ownership).slice(0, 20)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 4. ENGINE CONTROLS (THE SWAP) ---

async function startSubstitution(id) {
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

        // GK Constraint
        if ((s1.pos === 'GKP' || s2.pos === 'GKP') && s1.pos !== s2.pos) {
            alert("Goalkeepers can only be swapped with other Goalkeepers.");
            renderPitch(); return;
        }

        // Simulate Swap for Validation
        const oldN1 = s1.name, oldP1 = s1.pos;
        const oldN2 = s2.name, oldP2 = s2.pos;

        s1.name = oldN2; s1.pos = oldP2;
        s2.name = oldN1; s2.pos = oldP1;

        if (!validateFormation()) {
            alert("Invalid Formation! Min: 3 DEF, 2 MID, 1 FWD.");
            s1.name = oldN1; s1.pos = oldP1;
            s2.name = oldN2; s2.pos = oldP2;
            renderPitch(); return;
        }

        // Animation
        const el1 = document.getElementById(`slot-${id1}`);
        const el2 = document.getElementById(`slot-${id2}`);
        if (el1 && el2) {
            const r1 = el1.getBoundingClientRect();
            const r2 = el2.getBoundingClientRect();
            el1.style.transform = `translate(${r2.left - r1.left}px, ${r2.top - r1.top}px)`;
            el2.style.transform = `translate(${r1.left - r2.left}px, ${r1.top - r2.top}px)`;
        }

        setTimeout(() => {
            saveSquad();
            renderPitch();
        }, 400);
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
    if (confirm("Reset squad?")) {
        squad.forEach(slot => slot.name = '');
        saveSquad(); renderPitch();
    }
}

// --- 5. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    syncData();
    if (document.querySelector('.btn-reset')) document.querySelector('.btn-reset').onclick = resetTeam;
});
