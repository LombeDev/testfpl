/**
 * KOPALA FPL - MASTER ENGINE (v4.4.0)
 * Full 2025/26 Season Production Script
 * Includes: XP-Based Template, Dynamic Formations, Top-Left Sub Button & Animations
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

/**
 * Calculates next fixture for a team
 */
function getNextFixture(teamId) {
    if (!fixturesDB || fixturesDB.length === 0) return "";
    const next = fixturesDB.find(f => !f.finished && (f.team_h === teamId || f.team_a === teamId));
    if (!next) return "TBC";
    const isHome = next.team_h === teamId;
    const opponentId = isHome ? next.team_a : next.team_h;
    const opponentSlug = teamsDB[opponentId] || "???";
    return `${opponentSlug.substring(0, 3).toUpperCase()} (${isHome ? 'H' : 'A'})`;
}

/**
 * Calculates budget, XP, and Captaincy
 */
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
        const bankVal = (100.0 - totalCost).toFixed(1);
        budgetEl.textContent = `£${bankVal}m`;
        budgetEl.style.color = (bankVal < 0) ? '#ff005a' : '#2d3436';
    }

    const totalXP = (baseXP + maxXP).toFixed(1);
    const xpEl = document.getElementById('v-xp');
    if (xpEl) xpEl.textContent = totalXP;

    const ratingEl = document.getElementById('team-rating');
    if (ratingEl) {
        const ratingPercent = Math.min(100, Math.max(0, (totalXP / 75) * 100)).toFixed(0);
        ratingEl.textContent = `${ratingPercent}%`;
    }
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

        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error: ", e); }
}

// --- 3. UI RENDERING ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    // Render Pitch Rows dynamically based on player positions
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(posType => {
        const playersInPos = squad.filter(s => !s.isBench && s.pos === posType);
        if (playersInPos.length > 0) {
            const row = document.createElement('div');
            row.className = 'row';
            playersInPos.forEach(slot => row.appendChild(createSlotUI(slot)));
            pitch.appendChild(row);
        }
    });

    // Render Bench Row
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
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b) => b.ownership - a.ownership).slice(0, 15)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 4. ENGINE CONTROLS ---

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

        // Official FPL Logic: Swap Names AND Positions
        const oldN1 = s1.name, oldP1 = s1.pos;
        const oldN2 = s2.name, oldP2 = s2.pos;

        s1.name = oldN2; s1.pos = oldP2;
        s2.name = oldN1; s2.pos = oldP1;

        if (!validateFormation()) {
            alert("Invalid Formation! You must have at least 3 DEF, 2 MID, and 1 FWD on the pitch.");
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

// --- 5. TEMPLATE & PERSISTENCE ---

function loadTemplate() {
    if (!playerDB || playerDB.length === 0) return;
    
    // Reset to base 4-4-2 skeleton
    squad = [
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

    let budget = 100.0;
    const selected = new Set();
    const teamCounts = {};
    const sortedDB = [...playerDB].sort((a, b) => b.xp - a.xp); // Optimized for XP

    squad.forEach((slot, index) => {
        const remaining = 15 - index;
        const maxSpend = budget - (remaining * 4.0);

        const bestFit = sortedDB.find(p => 
            p.pos === slot.pos && 
            parseFloat(p.price) <= (maxSpend + 4.5) && 
            !selected.has(p.name) &&
            (teamCounts[p.teamId] || 0) < 3
        );

        if (bestFit) {
            slot.name = bestFit.name;
            slot.pos = bestFit.pos;
            budget -= parseFloat(bestFit.price);
            selected.add(bestFit.name);
            teamCounts[bestFit.teamId] = (teamCounts[bestFit.teamId] || 0) + 1;
        }
    });

    saveSquad();
    renderPitch();
}

function saveSquad() { localStorage.setItem(STORAGE_KEY, JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem(STORAGE_KEY); 
    if(s) squad = JSON.parse(s); 
}

function resetTeam() {
    if (confirm("Reset your entire squad?")) {
        squad.forEach(slot => { slot.name = ''; });
        saveSquad(); renderPitch();
    }
}

// --- 6. INITIALIZE ---

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    
    const rBtn = document.querySelector('.btn-reset');
    if (rBtn) rBtn.onclick = (e) => { e.preventDefault(); resetTeam(); };

    const tBtn = document.getElementById('wildcard-btn');
    if (tBtn) tBtn.onclick = (e) => { e.preventDefault(); loadTemplate(); };
});
