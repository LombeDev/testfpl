/**
 * KOPALA FPL - MASTER ENGINE (v4.3.7)
 * Full 2025/26 Season Production Script
 * Feature: Manual Substitution Button + GK Logic
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

const STORAGE_KEY = 'kopala_v4_3_7';

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

// --- 0. HELPERS ---
function getNextFixture(teamId) {
    if (!fixturesDB.length) return "";
    const next = fixturesDB.find(f => !f.finished && (f.team_h === teamId || f.team_a === teamId));
    if (!next) return "TBC";
    const isHome = next.team_h === teamId;
    const opponentSlug = teamsDB[isHome ? next.team_a : next.team_h] || "???";
    return `${opponentSlug.substring(0, 3).toUpperCase()} (${isHome ? 'H' : 'A'})`;
}

// --- 1. CORE STATS ---
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
    if (budgetEl) budgetEl.textContent = `£${(100.0 - totalCost).toFixed(1)}m`;
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

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        if (row.children.length) pitch.appendChild(row);
    });

    const bRow = document.createElement('div');
    bRow.className = 'row bench-row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    const isSelected = selectedSlotId === slotData.id;
    div.className = `slot ${isSelected ? 'selected' : ''}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;
    const fixText = p ? `<span style="opacity: 0.6; font-weight: 400; font-size: 8px;"> ${getNextFixture(p.teamId)}</span>` : "";

    div.innerHTML = `
        <div class="player-card-wrapper ${isSelected ? 'active-swap' : ''}">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default'}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
                </div>
                <button class="sub-btn" onclick="event.stopPropagation(); handleSwap(${slotData.id})">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
            <div class="p-name-box">
                ${slotData.name || slotData.pos}${fixText}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => x.pos === slotData.pos)
                .sort((a,b) => b.ownership - a.ownership).slice(0, 15)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 4. SUBSTITUTION LOGIC ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);

        if (p1.id !== p2.id) {
            const isGK1 = p1.pos === 'GKP';
            const isGK2 = p2.pos === 'GKP';

            // Constraint: GKP can only swap with GKP
            if ((isGK1 || isGK2) && p1.pos !== p2.pos) {
                alert("Goalkeepers can only be substituted for other Goalkeepers.");
            } else {
                // Perform Swap
                const tempName = p1.name;
                p1.name = p2.name;
                p2.name = tempName;

                if (!validateFormation()) {
                    alert("Invalid Formation! Must have at least 3 DEF, 2 MID, and 1 FWD.");
                    p2.name = p1.name; 
                    p1.name = tempName;
                } else {
                    saveSquad();
                }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
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
    if (confirm("Reset your entire squad?")) {
        squad.forEach(slot => slot.name = '');
        saveSquad();
        renderPitch();
    }
}

function loadTemplate() {
    if (!playerDB.length) return;
    let budget = 100.0;
    const sorted = [...playerDB].sort((a,b) => b.ownership - a.ownership);
    squad.forEach((slot, i) => {
        const p = sorted.find(p => p.pos === slot.pos && parseFloat(p.price) <= (budget - (squad.length - i) * 4));
        if (p) { slot.name = p.name; budget -= parseFloat(p.price); }
    });
    saveSquad();
    renderPitch();
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    if (document.querySelector('.btn-reset')) document.querySelector('.btn-reset').onclick = resetTeam;
    if (document.getElementById('wildcard-btn')) document.getElementById('wildcard-btn').onclick = loadTemplate;
});
