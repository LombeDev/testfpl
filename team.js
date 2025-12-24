/**
 * KOPALA FPL - AI Master Engine (v2.8)
 * FEATURES: Bouncy Animations, Auto-Formation, FPL Subs, AI Wildcard
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;
let managerSquads = {}; // Used for the League Table side if applicable

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

// --- 1. DATA SYNC & CACHING ---
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
        triggerLineupBounce();
        
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Fresh (Cached)</span>";
            return; 
        }
    }

    try {
        if (ticker) ticker.textContent = "Syncing live FPL data...";
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
            if (slug.includes('spurs') || slug.includes('tottenham')) slug = 'tottenham';
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0
        })).sort((a,b) => b.xp - a.xp);

        fixturesDB = rawFixtures;

        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        triggerLineupBounce();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
    } catch (e) {
        console.warn("Sync failed.");
    }
}

// --- 2. ADVANCED SUBSTITUTION & FORMATION LOGIC ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);

        if (p1.id !== p2.id) {
            // Rule 1: GKP can only swap with GKP
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers can only be swapped with other Goalkeepers.");
            } else {
                // Store original state
                const s1Orig = { name: p1.name, pos: p1.pos, isBench: p1.isBench };
                const s2Orig = { name: p2.name, pos: p2.pos, isBench: p2.isBench };

                // Execute Swap
                p1.name = s2Orig.name; p1.pos = s2Orig.pos; p1.isBench = s2Orig.isBench;
                p2.name = s1Orig.name; p2.pos = s1Orig.pos; p2.isBench = s1Orig.isBench;

                // Rule 2: Validate Formation
                if (!isValidFormation()) {
                    alert("Invalid Formation! Min: 3 DEF, 2 MID, 1 FWD.");
                    // Revert
                    p1.name = s1Orig.name; p1.pos = s1Orig.pos; p1.isBench = s1Orig.isBench;
                    p2.name = s2Orig.name; p2.pos = s2Orig.pos; p2.isBench = s2Orig.isBench;
                } else {
                    saveSquad();
                    triggerLineupBounce();
                }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const gkps = active.filter(s => s.pos === 'GKP').length;
    const defs = active.filter(s => s.pos === 'DEF').length;
    const mids = active.filter(s => s.pos === 'MID').length;
    const fwds = active.filter(s => s.pos === 'FWD').length;
    return gkps === 1 && defs >= 3 && mids >= 2 && fwds >= 1;
}

// --- 3. UI ANIMATIONS ---
function triggerLineupBounce() {
    const pitchWrap = document.querySelector('.pitch-outer-wrap');
    if (!pitchWrap) return;
    pitchWrap.classList.remove('animate-bounce');
    void pitchWrap.offsetWidth; // Force Reflow
    pitchWrap.classList.add('animate-bounce');
}

function initSwipeHint() {
    const hint = document.getElementById('scroll-hint');
    const tableWrapper = document.querySelector('.table-wrapper');
    if (!hint || !tableWrapper) return;
    tableWrapper.addEventListener('scroll', () => hint.classList.add('hidden-hint'), { once: true });
    setTimeout(() => hint.classList.add('hidden-hint'), 5000);
}

// --- 4. RENDERERS ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    let jerseyClass = 'default';
    if (player) {
        jerseyClass = (player.pos === 'GKP') ? 'gkp_color' : player.teamShort;
    }

    const fixtures = player ? getNextFixtures(player.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.length > 0 ? fixtures.map(f => `
                    <div class="fix-item diff-${f.diff}">
                        ${f.opp}<br>${f.loc}
                    </div>`).join('') : '<div class="fix-item">---</div>'}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => 
                `<option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
        </select>
    `;
    return div;
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    const formationLabel = document.getElementById('formation-text');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    const active = squad.filter(s => !s.isBench);
    
    // Update Formation Text (e.g., 4-4-2)
    if(formationLabel) {
        const f = `${active.filter(s=>s.pos==='DEF').length}-${active.filter(s=>s.pos==='MID').length}-${active.filter(s=>s.pos==='FWD').length}`;
        formationLabel.textContent = f;
    }

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        active.filter(s => s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    
    updateStats();
}

// --- 5. UTILS & HANDLERS ---
function getNextFixtures(teamId) {
    if (!fixturesDB || fixturesDB.length === 0) return [];
    return fixturesDB
        .filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3)
        .map(f => {
            const isHome = f.team_h === teamId;
            const oppId = isHome ? f.team_a : f.team_h;
            return {
                opp: (teamsDB[oppId] || "???").substring(0,3).toUpperCase(),
                loc: isHome ? 'H' : 'A',
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
}

function updateStats() {
    let xp = 0, val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
            if (!s.isBench) xp += p.xp;
        }
    });
    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) {
        const itb = (100 - val).toFixed(1);
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87';
    }
    const xpDisplay = document.getElementById('v-xp');
    if(xpDisplay) xpDisplay.textContent = xp.toFixed(1);
}

function runAIWildcard() {
    if (!playerDB.length) return;
    if (!confirm("AI will rebuild your squad for max points. Continue?")) return;

    let budget = 100.0;
    const used = [];
    squad.forEach((slot, i) => {
        const buffer = (squad.length - 1 - i) * 4.5;
        const choice = playerDB.find(p => 
            p.pos === slot.pos && !used.includes(p.name) && parseFloat(p.price) <= (budget - buffer)
        ) || playerDB.filter(p => p.pos === slot.pos && !used.includes(p.name))
                     .sort((a,b) => a.price - b.price)[0];

        if (choice) {
            slot.name = choice.name;
            used.push(choice.name);
            budget -= parseFloat(choice.price);
        }
    });
    saveSquad();
    renderPitch();
    triggerLineupBounce();
}

function updatePlayer(id, name) { 
    squad.find(s => s.id === id).name = name; 
    saveSquad(); 
    renderPitch(); 
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// --- 6. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    syncData();
    initSwipeHint();
    
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;

    const resetBtn = document.querySelector('.btn-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm("Reset Squad?")) {
                localStorage.removeItem('kopala_saved_squad');
                location.reload();
            }
        });
    }
});
