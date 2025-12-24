/**
 * KOPALA FPL - AI Master Engine (v3.0)
 * FEATURES: Bouncy Animations, Auto-Formation, FPL Subs, 3-GW Projections
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

// --- 1. DATA SYNC & CACHING ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    const cachedTeams = localStorage.getItem('kopala_teams_cache');
    const cachedTime = localStorage.getItem(TIME_KEY);
    
    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad();
        renderPitch();
        triggerLineupBounce();
        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Data: Loaded</span>";
        if (cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS)) return; 
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
        
        renderPitch();
    } catch (e) { console.error("Sync Error", e); }
}

// --- 2. THE PROJECTION ENGINE ---
function calculateProjectedPoints(player) {
    if (!player || isNaN(player.xp)) return 0;
    const fixtures = getNextFixtures(player.teamId);
    
    // Start with Game 1 (Official FPL EP)
    let total3GW = player.xp;

    // Estimate Game 2 and 3 based on Fixture Difficulty (FDR)
    fixtures.slice(1, 3).forEach(f => {
        let modifier = 1.0;
        if (f.diff <= 2) modifier = 1.25; // Easy Fixture Bonus
        if (f.diff >= 4) modifier = 0.70; // Hard Fixture Penalty
        
        // Decay factor (uncertainty increases the further out we look)
        total3GW += (player.xp * modifier * 0.85); 
    });

    return total3GW;
}

// --- 3. FORMATION & SUBSTITUTION LOGIC ---
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
                const s1Orig = { ...p1 };
                const s2Orig = { ...p2 };

                // Execute logical swap
                p1.name = s2Orig.name; p1.pos = s2Orig.pos; p1.isBench = s2Orig.isBench;
                p2.name = s1Orig.name; p2.pos = s1Orig.pos; p2.isBench = s1Orig.isBench;

                if (!isValidFormation()) {
                    alert("Invalid Formation! Min: 3 DEF, 2 MID, 1 FWD.");
                    Object.assign(p1, s1Orig); Object.assign(p2, s2Orig); // Revert
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
    const defs = active.filter(s => s.pos === 'DEF').length;
    const mids = active.filter(s => s.pos === 'MID').length;
    const fwds = active.filter(s => s.pos === 'FWD').length;
    return active.length === 11 && defs >= 3 && mids >= 2 && fwds >= 1;
}

// --- 4. UI RENDERERS ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    const formationLabel = document.getElementById('formation-text');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    const active = squad.filter(s => !s.isBench);
    
    if(formationLabel) {
        formationLabel.textContent = `${active.filter(s=>s.pos==='DEF').length}-${active.filter(s=>s.pos==='MID').length}-${active.filter(s=>s.pos==='FWD').length}`;
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

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    let jerseyClass = 'default';
    if (player) jerseyClass = (player.pos === 'GKP') ? 'gkp_color' : player.teamShort;

    const fixtures = player ? getNextFixtures(player.teamId) : [];
    const proj3 = player ? calculateProjectedPoints(player).toFixed(1) : '0.0';

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}<br>${f.loc}</div>`).join('')}
            </div>
            <div class="projected-badge">${proj3} pts (3-GW)</div>
        </div>
    `;
    return div;
}

// --- 5. HELPERS ---
function updateStats() {
    let xp1 = 0, xp3 = 0, val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
            if (!s.isBench) {
                xp1 += p.xp;
                xp3 += calculateProjectedPoints(p);
            }
        }
    });

    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) {
        const itb = (100 - val).toFixed(1);
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87';
    }

    const xpDisplay = document.getElementById('v-xp');
    if(xpDisplay) {
        xpDisplay.innerHTML = `${xp1.toFixed(1)} <small style="color:#aaa; font-size:12px; margin-left:5px;">Next GW</small> 
                               <br><span style="color:#00ff87">${xp3.toFixed(0)}</span> <small style="color:#aaa; font-size:12px;">Next 3 GWs</small>`;
    }
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return {
                opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(),
                loc: isHome ? 'H' : 'A',
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty
            };
        });
}

function triggerLineupBounce() {
    const wrap = document.querySelector('.pitch-outer-wrap');
    if (!wrap) return;
    wrap.classList.remove('animate-bounce');
    void wrap.offsetWidth; 
    wrap.classList.add('animate-bounce');
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const resetBtn = document.querySelector('.btn-reset');
    if (resetBtn) resetBtn.onclick = () => { localStorage.removeItem('kopala_saved_squad'); location.reload(); };
});
