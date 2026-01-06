/**
 * KOPALA FPL - MASTER ENGINE (v3.7.0)
 * Logic: High Ownership Priority + Current Team Mapping
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
            ownership: parseFloat(p.selected_by_percent) || 0
        }));

        fixturesDB = rawFixtures;
        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error", e); }
}

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
                newSquad.push({ id: newSquad.length, pos: pos, name: choice.name, isBench: false });
                teamCounts[choice.teamId] = (teamCounts[choice.teamId] || 0) + 1;
                budget -= parseFloat(choice.price);
            }
        }
    });
    squad = newSquad;
    changeFormation('3-4-3');
}

function analyzeTeam() {
    const modal = document.getElementById('analysis-modal');
    const content = document.getElementById('analysis-results');
    if(!modal || !content) return;

    const totalXP = squad.filter(s => !s.isBench).reduce((acc, s) => {
        const p = playerDB.find(x => x.name === s.name);
        return acc + (p ? p.xp : 0);
    }, 0).toFixed(1);

    content.innerHTML = `
        <h3>📊 AI Analysis</h3>
        <p>Projected Points: <strong>${totalXP}</strong></p>
        <p>Strategy: High Ownership / Template</p>
        <button onclick="document.getElementById('analysis-modal').style.display='none'" class="btn-primary">Close</button>
    `;
    modal.style.display = "block";
}

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
    updateStats();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamSlug) : 'default';
    const fixture = p ? getNextFixtures(p.teamId)[0] : null;

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <span class="p-name">${slotData.name || slotData.pos}</span>
            <div class="card-fixtures">
                ${fixture ? `<div class="fix-item diff-${fixture.diff}">${fixture.opp} ${fixture.isHome?'(H)':'(A)'}</div>` : ''}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b)=>b.ownership-a.ownership).slice(0,25).map(x => 
                `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name} (${x.ownership}%)</option>`
            ).join('')}
        </select>
    `;
    return div;
}

function handleSwap(id) {
    if (selectedSlotId === null) { selectedSlotId = id; } 
    else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id && p1.pos === p2.pos) {
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

function updateStats() {
    let v = 0; squad.forEach(s => { const p = playerDB.find(x => x.name === s.name); if(p) v += parseFloat(p.price); });
    const b = document.getElementById('budget-val'); if(b) b.textContent = `£${(100-v).toFixed(1)}m`;
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() { const s = localStorage.getItem('kopala_saved_squad'); if(s) squad = JSON.parse(s); }

document.addEventListener('DOMContentLoaded', () => {
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;

    const azBtn = document.getElementById('analyze-btn');
    if (azBtn) azBtn.onclick = analyzeTeam;

    const fs = document.getElementById('formation-select');
    if (fs) fs.onchange = (e) => changeFormation(e.target.value);

    syncData();
});
