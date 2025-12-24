/**
 * KOPALA FPL - AI Master Engine (v3.5)
 * FEATURES: 3-GW Bottom Totals, Auto-Formation, FPL Subs, Jersey Logic
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

// --- 1. DATA SYNC ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    
    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(localStorage.getItem('kopala_teams_cache') || '{}');
        loadSquad();
        renderPitch();
    }

    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        
        data.teams.forEach(t => teamsDB[t.id] = t.name.toLowerCase().replace(/\s+/g, '_'));

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0
        }));

        fixturesDB = await fixRes.json();
        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        
        renderPitch();
    } catch (e) { console.warn("Sync error - using cache."); }
}

// --- 2. AI LOGIC (3-WEEK PROJECTION) ---
function getProj3(player) {
    if (!player) return 0;
    const fixs = getNextFixtures(player.teamId);
    let total = player.xp; // Week 1 (Official FPL EP)

    fixs.slice(1, 3).forEach(f => {
        // Multiplier based on FDR (Fixture Difficulty Rating)
        let mod = f.diff <= 2 ? 1.25 : (f.diff >= 4 ? 0.75 : 1.0);
        total += (player.xp * mod * 0.85); // 0.85 = uncertainty decay
    });
    return total;
}

// --- 3. UI HANDLERS ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);

        if (p1.id !== p2.id) {
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers can only swap with Goalkeepers.");
            } else {
                const s1 = { ...p1 }, s2 = { ...p2 };
                p1.name = s2.name; p1.pos = s2.pos; p1.isBench = s2.isBench;
                p2.name = s1.name; p2.pos = s1.pos; p2.isBench = s1.isBench;

                if (!isValidFormation()) {
                    alert("Invalid Formation! Must have 3+ DEF, 2+ MID, 1+ FWD.");
                    Object.assign(p1, s1); Object.assign(p2, s2);
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
    const d = active.filter(s => s.pos === 'DEF').length;
    const m = active.filter(s => s.pos === 'MID').length;
    const f = active.filter(s => s.pos === 'FWD').length;
    return active.length === 11 && d >= 3 && m >= 2 && f >= 1;
}

// --- 4. RENDERERS ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    const active = squad.filter(s => !s.isBench);
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
    const jersey = player ? (player.pos === 'GKP' ? 'gkp_color' : player.teamShort) : 'default';

    div.innerHTML = `
        <div class="jersey ${jersey}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <span class="p-name">${slotData.name || slotData.pos}</span>
            <span class="p-points">${player ? player.xp.toFixed(1) : ''}</span>
        </div>
    `;
    return div;
}

function updateStats() {
    let totalXp1 = 0, totalXp3 = 0, totalCost = 0;

    // Calculate ONLY for the Starting 11
    squad.filter(s => !s.isBench).forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalCost += parseFloat(p.price);
            totalXp1 += p.xp;
            totalXp3 += getProj3(p);
        }
    });

    // Update Bottom Total Display
    const footerPoints = document.getElementById('footer-points');
    if (footerPoints) {
        footerPoints.innerHTML = `
            <div class="total-stat">
                <span class="label">NEXT GW</span>
                <span class="value">${totalXp1.toFixed(1)}</span>
            </div>
            <div class="divider"></div>
            <div class="total-stat highlight">
                <span class="label">3-GW PROJECTION</span>
                <span class="value">${totalXp3.toFixed(0)} pts</span>
            </div>
        `;
    }

    const budgetVal = document.getElementById('budget-val');
    if(budgetVal) budgetVal.textContent = `£${(100 - totalCost).toFixed(1)}m`;
}

// --- 5. HELPERS ---
function getNextFixtures(teamId) {
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isH = f.team_h === teamId;
            return { opp: (teamsDB[isH ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), diff: isH ? f.team_h_difficulty : f.team_a_difficulty };
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

document.addEventListener('DOMContentLoaded', syncData);
