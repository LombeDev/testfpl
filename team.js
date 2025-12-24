/**
 * KOPALA FPL - AI Master Engine (v2.7)
 * UPDATED: Fixture-Weighted AI, Transfer Insights, and Value Logic
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
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
    } catch (e) {
        console.warn("Sync failed. Using cached fixtures.");
        if (ticker && playerDB.length > 0) {
            ticker.innerHTML = "📡 <span style='color:orange'>Offline: Fixtures Cached</span>";
        }
    }
}

// --- 2. ADVANCED SWAP LOGIC ---
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
                const tempName = p1.name;
                const tempPos = p1.pos;

                p1.name = p2.name;
                p1.pos = p2.pos;
                p2.name = tempName;
                p2.pos = tempPos;

                if (!isValidFormation()) {
                    alert("Invalid Formation! FPL requires at least 3 Defenders, 2 Midfielders, and 1 Forward.");
                    p2.name = p1.name;
                    p2.pos = p1.pos;
                    p1.name = tempName;
                    p1.pos = tempPos;
                } else {
                    saveSquad();
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
    return defs >= 3 && mids >= 2 && fwds >= 1;
}

// --- 3. AI RECOMMENDER & WILDCARD ---
function runAIWildcard() {
    if (!playerDB || playerDB.length === 0) {
        alert("Data not loaded. Please wait for sync.");
        return;
    }

    if (!confirm("AI will rebuild your squad based on fixture difficulty and expected points. Continue?")) return;

    let budget = 100.0;
    const newSquad = [];
    const usedIds = new Set();
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    // Rank players by Score (XP adjusted by next 3 fixtures)
    const rankedPlayers = playerDB.map(p => {
        const fixtures = getNextFixtures(p.teamId);
        const avgDiff = fixtures.reduce((acc, f) => acc + (5 - f.diff), 0) / (fixtures.length || 1);
        return { ...p, score: p.xp * (1 + (avgDiff / 10)) };
    }).sort((a, b) => b.score - a.score);

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        for (let i = 0; i < posLimits[pos]; i++) {
            const buffer = 4.3 * (15 - newSquad.length); // Safety buffer for remaining slots
            const choice = rankedPlayers.find(p => 
                p.pos === pos && 
                !usedIds.has(p.id) && 
                parseFloat(p.price) <= (budget - buffer)
            ) || rankedPlayers.find(p => p.pos === pos && !usedIds.has(p.id));

            if (choice) {
                newSquad.push({ 
                    id: newSquad.length, 
                    pos: pos, 
                    name: choice.name, 
                    isBench: false 
                });
                usedIds.add(choice.id);
                budget -= parseFloat(choice.price);
            }
        }
    });

    // Smart benching: Put lowest scored players on bench (except one GKP)
    newSquad.sort((a, b) => {
        const pA = playerDB.find(p => p.name === a.name);
        const pB = playerDB.find(p => p.name === b.name);
        return (pA?.xp || 0) - (pB?.xp || 0);
    });
    
    let benched = 0;
    newSquad.forEach(s => {
        if (benched < 4 && (s.pos !== 'GKP' || benched === 0)) {
            s.isBench = true;
            benched++;
        }
    });

    squad = newSquad;
    saveSquad();
    renderPitch();
}

function displayRecommendations() {
    const recList = document.getElementById('recommendation-list');
    if (!recList) return;

    const valEl = document.getElementById('budget-val');
    const currentITB = valEl ? parseFloat(valEl.textContent.replace('£', '').replace('m', '')) : 0;
    let recs = [];

    squad.forEach(slot => {
        if (!slot.name) return;
        const currentP = playerDB.find(p => p.name === slot.name);
        if (!currentP) return;

        const bestUpgrade = playerDB.find(p => 
            p.pos === slot.pos && 
            p.name !== currentP.name &&
            parseFloat(p.price) <= (parseFloat(currentP.price) + currentITB) &&
            !squad.some(s => s.name === p.name) &&
            p.xp > currentP.xp
        );

        if (bestUpgrade) {
            recs.push({
                old: currentP.name,
                new: bestUpgrade.name,
                gain: (bestUpgrade.xp - currentP.xp).toFixed(1),
                cost: bestUpgrade.price
            });
        }
    });

    recs.sort((a, b) => b.gain - a.gain);
    recList.innerHTML = recs.length ? recs.slice(0, 3).map(r => `
        <div class="rec-card">
            <div class="rec-swap"><span class="out">${r.old}</span> ➔ <span class="in">${r.new}</span></div>
            <div class="rec-meta">Gain: <span class="gain">+${r.gain} xP</span> | Cost: £${r.cost}m</div>
        </div>`).join('') : "<p>Squad is optimized!</p>";
}

// --- 4. RENDERERS & UTILS ---
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

    // Trigger AI Recommendations
    displayRecommendations();
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

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    const wcBtn = document.getElementById('wildcard-btn');
    if (wcBtn) wcBtn.onclick = runAIWildcard;
});
