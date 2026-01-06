/**
 * KOPALA FPL - AI MASTER ENGINE (v3.6.1)
 * Modified: Single Fixture & Clean Card UI
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

// --- UI BOOTSTRAP HELPERS ---
function ensureUIElements() {
    ensurePlayerModal();
    ensurePickerControls();
    ensureFormationSelectId();
    const analysisResults = document.getElementById('analysis-results');
    if (!analysisResults) {
        const analysisModal = document.getElementById('analysis-modal');
        if (analysisModal) {
            const container = document.createElement('div');
            container.id = 'analysis-results';
            analysisModal.querySelector('.modal-content')?.appendChild(container);
        }
    }
}

function ensurePlayerModal() {
    if (document.getElementById('player-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'player-modal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="padding:16px; max-width:640px; margin:48px auto; position:relative;">
            <button id="close-player-modal" style="position:absolute; right:12px; top:12px; background:none; border:none; font-size:1.4rem; cursor:pointer;">&times;</button>
            <div id="player-modal-content"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-player-modal').onclick = () => {
        const m = document.getElementById('player-modal');
        if (m) m.style.display = 'none';
    };
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function ensurePickerControls() {
    const anyPickerPresent = document.getElementById('picker-min-price') || document.getElementById('picker-max-price') || document.getElementById('picker-sort');
    if (anyPickerPresent) return;

    const statusBar = document.querySelector('.status-bar') || document.querySelector('.main-container') || document.body;
    if (!statusBar) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'center';
    wrapper.style.marginLeft = '12px';

    wrapper.innerHTML = `
        <label style="font-weight:700; font-size:0.85rem; margin-right:4px;">Min Price</label>
        <input id="picker-min-price" type="number" step="0.1" value="${pickerFilters.minPrice}" style="width:72px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Max Price</label>
        <input id="picker-max-price" type="number" step="0.1" value="${pickerFilters.maxPrice}" style="width:72px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Min Own</label>
        <input id="picker-min-ownership" type="number" step="0.1" value="${pickerFilters.minOwnership}" style="width:62px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Sort</label>
        <select id="picker-sort" style="width:100px;">
            <option value="xp">xP</option>
            <option value="vapm">VAPM</option>
            <option value="price">Price</option>
            <option value="ownership">Ownership</option>
        </select>
    `;

    const formation = document.getElementById('formation-select') || document.querySelector('select[onchange*="changeFormation"]');
    if (formation && formation.parentElement) {
        formation.parentElement.insertBefore(wrapper, formation.nextSibling);
    } else {
        statusBar.appendChild(wrapper);
    }
}

function ensureFormationSelectId() {
    let formSelect = document.getElementById('formation-select');
    if (!formSelect) {
        formSelect = document.querySelector('select[onchange*="changeFormation"]');
        if (formSelect) formSelect.id = 'formation-select';
    }
}

// --- 1. DATA SYNC & INITIALIZATION ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    const cachedTeams = localStorage.getItem('kopala_teams_cache');
    const cachedTime = localStorage.getItem(TIME_KEY);
    
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad();
        renderPitch();
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "🚨 <span style='color:#00ff87'>AI Analysis Ready</span>";
            return; 
        }
    }

    try {
        if (ticker) ticker.textContent = "Syncing live Premier League data...";
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            teamsDB[t.id] = slug;
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
        })).sort((a,b) => b.xp - a.xp);

        fixturesDB = rawFixtures;

        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Active</span>";
    } catch (e) {
        console.error("Sync Error:", e);
        if (ticker) ticker.textContent = "Offline Mode Active";
    }
}

// --- 2. SQUAD RULES & INTERACTION ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id) {
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers can only be swapped with other Goalkeepers.");
            } else {
                const tempBench = p1.isBench;
                p1.isBench = p2.isBench;
                p2.isBench = tempBench;
                if (!isValidFormation()) {
                    alert("Invalid Formation!");
                    p2.isBench = p1.isBench; 
                    p1.isBench = tempBench; 
                } else {
                    saveSquad();
                }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function updatePlayer(id, name) {
    if (!name) {
        squad.find(s => s.id === id).name = "";
        saveSquad(); renderPitch(); return;
    }
    const player = playerDB.find(p => p.name === name);
    if (!player) { alert("Player not found"); return; }
    const teamCount = squad.filter(s => {
        if (s.id === id) return false;
        const p = playerDB.find(pdb => pdb.name === s.name);
        return p && p.teamId === player.teamId;
    }).length;
    if (teamCount >= 3) {
        alert(`Max 3 players from ${player.teamShort.toUpperCase()}.`);
        renderPitch(); 
        return;
    }
    squad.find(s => s.id === id).name = name;
    saveSquad();
    renderPitch();
}

function changeFormation(formationStr) {
    const [d, m, f] = formationStr.split('-').map(Number);
    squad.forEach(s => s.isBench = true);
    const gkStarters = squad.filter(s => s.pos === 'GKP').slice(0,1);
    gkStarters.forEach(g => g.isBench = false);
    const activate = (pos, limit) => {
        let count = 0;
        squad.filter(s => s.pos === pos).forEach(s => {
            if (count < limit) { s.isBench = false; count++; }
        });
    };
    activate('DEF', d); activate('MID', m); activate('FWD', f);
    saveSquad();
    renderPitch();
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const d = active.filter(s => s.pos === 'DEF').length;
    const m = active.filter(s => s.pos === 'MID').length;
    const f = active.filter(s => s.pos === 'FWD').length;
    return d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3;
}

// --- 3. CALCULATIONS ---
function getThreeWeekXP(player) {
    if (!player) return 0;
    const fixtures = getNextFixtures(player.teamId);
    let totalXP = player.xp; 
    fixtures.slice(0, 3).forEach((f, index) => {
        let multiplier = (6 - f.diff) / 3;
        if (f.isHome) multiplier *= 1.1;
        const decay = [1.0, 0.9, 0.8][index] || 0.7;
        totalXP += (player.xp * multiplier * decay);
    });
    return parseFloat(totalXP.toFixed(1));
}

function vapor(player) {
    const price = parseFloat(player.price);
    if (!price) return 0;
    return getThreeWeekXP(player) / price;
}

// --- 4. ANALYSIS & MODALS ---
function analyzeTeam() {
    if (squad.some(s => s.name === "")) return alert("Finish your squad first!");
    const analysis = squad.map(slot => {
        const p = playerDB.find(pdb => pdb.name === slot.name);
        return { ...slot, xp: p.xp, price: parseFloat(p.price), threeWk: getThreeWeekXP(p) };
    });
    // Simplified display for this context
    alert("AI Analysis Complete. Check results in modal.");
}

function openPlayerModal(name) {
    const player = playerDB.find(p => p.name === name);
    if (!player) return;
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    if (!modal || !content) return;
    const nextFix = getNextFixtures(player.teamId);
    content.innerHTML = `
        <h3 style="margin:0 0 8px 0;">${player.name} — £${player.price}m</h3>
        <p>Position: ${player.pos} | Ownership: ${player.ownership}%</p>
        <div class="card-fixtures" style="display:flex;gap:6px;margin-top:8px;">
            ${nextFix.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}${f.isHome ? '(H)' : '(A)'}</div>`).join('')}
        </div>
    `;
    modal.style.display = "block";
}

// --- 5. RENDERERS ---
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

/**
 * MODIFIED createSlotUI:
 * 1. Removed xP display
 * 2. Limited fixtures to slice(0, 1)
 */
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    const jersey = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';
    
    // Only one fixture
    const fixtures = p ? getNextFixtures(p.teamId).slice(0, 1) : [];

    const jerseyDiv = document.createElement('div');
    jerseyDiv.className = `jersey ${jersey}`;
    jerseyDiv.onclick = () => handleSwap(slotData.id);

    const cardDiv = document.createElement('div');
    cardDiv.className = 'player-card';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'p-name';
    nameSpan.textContent = slotData.name || slotData.pos;
    if (slotData.name) nameSpan.style.cursor = 'pointer';
    nameSpan.onclick = () => slotData.name && openPlayerModal(slotData.name);

    const fixtureDiv = document.createElement('div');
    fixtureDiv.className = 'card-fixtures';
    fixtureDiv.innerHTML = fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}${f.isHome ? '(H)' : '(A)'}</div>`).join('');

    cardDiv.appendChild(nameSpan);
    cardDiv.appendChild(fixtureDiv);

    const selectEl = document.createElement('select');
    selectEl.className = 'hidden-picker';
    selectEl.onchange = (e) => updatePlayer(slotData.id, e.target.value);
    selectEl.innerHTML = buildPlayerOptions(slotData.pos, slotData.name);

    div.appendChild(jerseyDiv);
    div.appendChild(cardDiv);
    div.appendChild(selectEl);
    return div;
}

function buildPlayerOptions(pos, selectedName) {
    let candidates = playerDB.filter(p => p.pos === pos
        && parseFloat(p.price) >= pickerFilters.minPrice
        && parseFloat(p.price) <= pickerFilters.maxPrice
        && p.ownership >= pickerFilters.minOwnership
    );
    return [
        `<option value="">-- Pick --</option>`,
        ...candidates.map(c => `<option value="${c.name}" ${selectedName === c.name ? 'selected' : ''}>${c.name} (£${c.price}m)</option>` )
    ].join('');
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return { 
                opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), 
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty,
                isHome: isHome
            };
        });
}

function updateStats() {
    let val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) val += parseFloat(p.price);
    });
    const itb = (100 - val).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) { 
        budgetEl.textContent = `£${itb}m`; 
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87'; 
    }
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// --- 6. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    ensureUIElements();
    const maxPriceEl = document.getElementById('picker-max-price');
    const minPriceEl = document.getElementById('picker-min-price');
    const minOwnershipEl = document.getElementById('picker-min-ownership');
    const sortSelectEl = document.getElementById('picker-sort');

    const refreshPickers = () => {
        if (maxPriceEl) pickerFilters.maxPrice = parseFloat(maxPriceEl.value || pickerFilters.maxPrice);
        if (minPriceEl) pickerFilters.minPrice = parseFloat(minPriceEl.value || pickerFilters.minPrice);
        if (minOwnershipEl) pickerFilters.minOwnership = parseFloat(minOwnershipEl.value || pickerFilters.minOwnership);
        if (sortSelectEl) pickerFilters.sortBy = sortSelectEl.value || pickerFilters.sortBy;
        renderPitch();
    };

    if (maxPriceEl) maxPriceEl.onchange = refreshPickers;
    if (minPriceEl) minPriceEl.onchange = refreshPickers;
    if (minOwnershipEl) minOwnershipEl.onchange = refreshPickers;
    if (sortSelectEl) sortSelectEl.onchange = refreshPickers;

    if (document.getElementById('formation-select')) {
        document.getElementById('formation-select').onchange = (e) => changeFormation(e.target.value);
    }
    syncData();
});
