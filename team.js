/**
 * KOPALA FPL - AI Master Engine (v3.2)
 * FULL FEATURE RESTORE: Constraints, Formations, Swapping, Wildcard, & AI Analysis
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
    
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad(); renderPitch();
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
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id, name: p.web_name, teamId: p.team,
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
        
        loadSquad(); renderPitch();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine Online (Live)</span>";
    } catch (e) {
        if (ticker) ticker.innerHTML = "📡 <span style='color:orange'>Offline Mode</span>";
    }
}

// --- 2. SQUAD MANAGEMENT (SWAPS, TEAMS, FORMATIONS) ---

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
                    alert("Invalid Formation! FPL requires 3-5 DEFs, 2-5 MIDs, and 1-3 FWDs.");
                    p2.isBench = p1.isBench; p1.isBench = tempBench; // Revert
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
    const teamCount = squad.filter(s => {
        if (s.id === id) return false;
        const p = playerDB.find(pdb => pdb.name === s.name);
        return p && p.teamId === player.teamId;
    }).length;

    if (teamCount >= 3) {
        alert(`Rule Violation: Max 3 players from ${player.teamShort.toUpperCase()}.`);
        renderPitch(); return;
    }
    squad.find(s => s.id === id).name = name;
    saveSquad(); renderPitch();
}

function changeFormation(formationStr) {
    const [d, m, f] = formationStr.split('-').map(Number);
    squad.forEach(s => s.isBench = true);
    squad.find(s => s.pos === 'GKP').isBench = false;
    const activate = (pos, limit) => {
        let count = 0;
        squad.filter(s => s.pos === pos).forEach(s => { if (count < limit) { s.isBench = false; count++; } });
    };
    activate('DEF', d); activate('MID', m); activate('FWD', f);
    saveSquad(); renderPitch();
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const d = active.filter(s => s.pos === 'DEF').length;
    const m = active.filter(s => s.pos === 'MID').length;
    const f = active.filter(s => s.pos === 'FWD').length;
    return d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3;
}

// --- 3. AI ENGINES (ANALYSIS & WILDCARD) ---

function analyzeTeam() {
    if (squad.some(s => s.name === "")) return alert("Please fill your squad first!");
    const analysis = squad.map(slot => {
        const p = playerDB.find(pdb => pdb.name === slot.name);
        const fixes = getNextFixtures(p.teamId);
        const ease = fixes.reduce((acc, f) => acc + (5 - f.diff), 0) / 3;
        return { ...slot, xp: p.xp, price: parseFloat(p.price), teamId: p.teamId, totalScore: p.xp * (1 + ease / 10) };
    });

    const cap = [...analysis].sort((a, b) => b.totalScore - a.totalScore)[0];
    const sortedLow = [...analysis].sort((a, b) => a.totalScore - b.totalScore);
    const gkpBench = analysis.filter(p => p.pos === 'GKP').sort((a,b) => a.totalScore - b.totalScore)[0];
    const bench = [gkpBench.name, ...sortedLow.filter(p => p.id !== gkpBench.id).slice(0, 3).map(p=>p.name)];

    const budget = (100 - analysis.reduce((acc, p) => acc + p.price, 0));
    const tips = [];
    sortedLow.slice(0, 3).forEach(weak => {
        const up = playerDB.find(p => p.pos === weak.pos && parseFloat(p.price) <= (weak.price + budget) && !squad.some(s => s.name === p.name) && (squad.filter(s => playerDB.find(pdb => pdb.name === s.name)?.teamId === p.teamId).length < 3));
        if (up) tips.push(`OUT: ${weak.name} ➔ IN: ${up.name} (£${up.price}m)`);
    });

    const modal = document.getElementById('analysis-modal');
    document.getElementById('analysis-results').innerHTML = `
        <div class="analysis-section"><h3>👑 Captain</h3><p>${cap.name}</p></div>
        <div class="analysis-section"><h3>🪑 Bench Order</h3><p>${bench.join(', ')}</p></div>
        <div class="analysis-section"><h3>🔄 AI Transfers</h3>${tips.map(t => `<div class="transfer-item">${t}</div>`).join('')}</div>
    `;
    modal.style.display = "block";
    document.getElementById('close-modal').onclick = () => modal.style.display = "none";
}

function runAIWildcard() {
    if (!playerDB.length) return;
    if (!confirm("AI will rebuild your squad based on fixture difficulty and XP. Continue?")) return;

    let budget = 100.0;
    const newSquad = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        for (let i = 0; i < posLimits[pos]; i++) {
            const buffer = 4.2 * (15 - newSquad.length);
            const choice = playerDB.find(p => p.pos === pos && !newSquad.some(s => s.name === p.name) && (teamCounts[p.teamId] || 0) < 3 && parseFloat(p.price) <= (budget - buffer)) || playerDB.find(p => p.pos === pos && !newSquad.some(s => s.name === p.name));

            if (choice) {
                newSquad.push({ id: newSquad.length, pos: pos, name: choice.name, isBench: false });
                teamCounts[choice.teamId] = (teamCounts[choice.teamId] || 0) + 1;
                budget -= parseFloat(choice.price);
            }
        }
    });
    squad = newSquad; changeFormation('4-4-2');
}

// --- 4. RENDERERS & UTILS ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div'); row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    const bRow = document.createElement('div'); bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    updateStats();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    const jersey = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';
    const fixtures = p ? getNextFixtures(p.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${jersey}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <span class="p-name">${slotData.name || slotData.pos}</span>
            <div class="card-fixtures">${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}</div>`).join('')}</div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(pdb => pdb.pos === slotData.pos).map(pdb => `<option value="${pdb.name}" ${slotData.name === pdb.name ? 'selected' : ''}>${pdb.name} (£${pdb.price}m)</option>`).join('')}
        </select>
    `;
    return div;
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return { opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), diff: isHome ? f.team_h_difficulty : f.team_a_difficulty };
        });
}

function updateStats() {
    let xp = 0, val = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) { val += parseFloat(p.price); if (!s.isBench) xp += p.xp; }
    });
    const itb = (100 - val).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) { budgetEl.textContent = `£${itb}m`; budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87'; }
    if(document.getElementById('v-xp')) document.getElementById('v-xp').textContent = xp.toFixed(1);
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    if (document.getElementById('wildcard-btn')) document.getElementById('wildcard-btn').onclick = runAIWildcard;
    if (document.getElementById('analyze-btn')) document.getElementById('analyze-btn').onclick = analyzeTeam;
    if (document.getElementById('formation-select')) document.getElementById('formation-select').onchange = (e) => changeFormation(e.target.value);
});
