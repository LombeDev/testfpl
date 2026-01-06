/**
 * KOPALA FPL - AI MASTER ENGINE (v3.6.2)
 * FIXED: Template Team (Wildcard) and Analysis Modal restored.
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

const pickerFilters = {
    maxPrice: 15.0,
    minPrice: 4.0,
    minOwnership: 0.0,
    sortBy: 'xp' 
};

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

// --- UI BOOTSTRAP ---
function ensureUIElements() {
    ensurePlayerModal();
    ensurePickerControls();
    ensureFormationSelectId();
}

function ensurePlayerModal() {
    if (document.getElementById('player-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'player-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="padding:16px; max-width:640px; margin:48px auto; position:relative;">
            <button id="close-player-modal" style="position:absolute; right:12px; top:12px; background:none; border:none; font-size:1.4rem; cursor:pointer;">&times;</button>
            <div id="player-modal-content"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-player-modal').onclick = () => modal.style.display = 'none';
}

function ensurePickerControls() {
    if (document.getElementById('picker-min-price')) return;
    const statusBar = document.querySelector('.status-bar') || document.body;
    const wrapper = document.createElement('div');
    wrapper.className = "picker-wrapper"; // Use your CSS class
    wrapper.innerHTML = `
        <input id="picker-min-price" type="number" step="0.1" value="4.0" style="width:60px" />
        <input id="picker-max-price" type="number" step="0.1" value="15.0" style="width:60px" />
        <select id="picker-sort"><option value="xp">xP</option><option value="price">Price</option></select>
    `;
    statusBar.appendChild(wrapper);
}

function ensureFormationSelectId() {
    let formSelect = document.querySelector('select[onchange*="changeFormation"]');
    if (formSelect) formSelect.id = 'formation-select';
}

// --- DATA SYNC ---
async function syncData() {
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        data.teams.forEach(t => {
            teamsDB[t.id] = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default',
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

// --- SQUAD LOGIC ---
function runAIWildcard() {
    let budget = 100.0;
    const newSquad = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        for (let i = 0; i < posLimits[pos]; i++) {
            const buffer = 4.3 * (15 - newSquad.length);
            const choice = playerDB.filter(p => 
                p.pos === pos && !newSquad.some(s => s.name === p.name) && 
                (teamCounts[p.teamId] || 0) < 3 && parseFloat(p.price) <= (budget - buffer)
            ).sort((a, b) => b.xp - a.xp)[0];

            if (choice) {
                newSquad.push({ id: newSquad.length, pos: pos, name: choice.name, isBench: false });
                teamCounts[choice.teamId] = (teamCounts[choice.teamId] || 0) + 1;
                budget -= parseFloat(choice.price);
            }
        }
    });
    squad = newSquad;
    changeFormation('4-4-2');
}

function analyzeTeam() {
    if (squad.some(s => s.name === "")) return alert("Fill your squad first!");
    const analysis = squad.map(slot => {
        const p = playerDB.find(pdb => pdb.name === slot.name);
        return { ...slot, xp: p.xp, price: parseFloat(p.price) };
    });
    
    displayModal(analysis);
}

function displayModal(analysis) {
    const modal = document.getElementById('analysis-modal');
    const content = document.getElementById('analysis-results');
    if(!modal || !content) return;

    const totalXP = analysis.filter(s => !s.isBench).reduce((acc, p) => acc + p.xp, 0).toFixed(1);
    
    content.innerHTML = `
        <div class="analysis-section">
            <h3>📊 Squad Performance</h3>
            <p>Active Gameweek xP: <strong>${totalXP}</strong></p>
            <p>ITB: £${(100 - analysis.reduce((acc,p)=>acc+p.price, 0)).toFixed(1)}m</p>
        </div>
        <button onclick="document.getElementById('analysis-modal').style.display='none'" class="btn">Close</button>
    `;
    modal.style.display = "block";
}

// --- RENDERERS ---
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
    const jersey = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';
    const fixtures = p ? getNextFixtures(p.teamId).slice(0, 1) : [];

    div.innerHTML = `
        <div class="jersey ${jersey}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <span class="p-name" onclick="openPlayerModal('${slotData.name}')">${slotData.name || slotData.pos}</span>
            <div class="card-fixtures">
                ${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}${f.isHome ? '(H)' : '(A)'}</div>`).join('')}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            ${buildPlayerOptions(slotData.pos, slotData.name)}
        </select>
    `;
    return div;
}

// (Helper functions handleSwap, updatePlayer, changeFormation, buildPlayerOptions, etc. remain same as before)
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

function buildPlayerOptions(pos, sel) {
    const choices = playerDB.filter(p => p.pos === pos).sort((a,b) => b.xp - a.xp).slice(0, 50);
    return `<option value="">-- Pick --</option>` + choices.map(c => `<option value="${c.name}" ${sel===c.name?'selected':''}>${c.name} (£${c.price})</option>`).join('');
}

function getNextFixtures(teamId) {
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .map(f => ({ opp: (teamsDB[f.team_h === teamId ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), diff: f.team_h === teamId ? f.team_h_difficulty : f.team_a_difficulty, isHome: f.team_h === teamId }));
}

function updateStats() {
    let v = 0; squad.forEach(s => { const p = playerDB.find(x => x.name === s.name); if(p) v += parseFloat(p.price); });
    const b = document.getElementById('budget-val'); if(b) b.textContent = `£${(100-v).toFixed(1)}m`;
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() { const s = localStorage.getItem('kopala_saved_squad'); if(s) squad = JSON.parse(s); }

function openPlayerModal(n) {
    const p = playerDB.find(x => x.name === n); if(!p) return;
    document.getElementById('player-modal-content').innerHTML = `<h3>${p.name}</h3><p>Price: £${p.price}m</p>`;
    document.getElementById('player-modal').style.display = 'block';
}

// --- EVENT BINDING ---
document.addEventListener('DOMContentLoaded', () => {
    ensureUIElements();
    
    // RESTORED BUTTON BINDINGS
    const wildcardBtn = document.getElementById('wildcard-btn');
    if (wildcardBtn) wildcardBtn.onclick = runAIWildcard;

    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) analyzeBtn.onclick = analyzeTeam;

    const formSelect = document.getElementById('formation-select');
    if (formSelect) formSelect.onchange = (e) => changeFormation(e.target.value);

    syncData();
});
