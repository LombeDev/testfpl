/**
 * KOPALA FPL - AI MASTER ENGINE (v4.0 Aggressive Edition)
 * "The Hub Style" - High Upside & Value Protection
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

// AI Weighting Configuration
const AI_WEIGHTS = { GW1: 0.6, GW2: 0.3, GW3: 0.1 };

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
    try {
        if (ticker) ticker.textContent = "Syncing live Opta-style data...";
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
            form: parseFloat(p.form) || 0,
            ict: parseFloat(p.ict_index) || 0
        })).sort((a,b) => b.xp - a.xp);

        fixturesDB = rawFixtures;
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "🔥 <span style='color:#00ff87'>AI Engine: Aggressive Mode Active</span>";
    } catch (e) {
        console.error("Sync Error:", e);
    }
}

// --- 2. AGGRESSIVE AI CALCULATIONS ---

function getAggressiveXP(player) {
    if (!player) return 0;
    const fixtures = getNextFixtures(player.teamId);
    if (!fixtures.length) return player.xp;

    // Weighting fixtures (Aggressive focus on GW1)
    let score = 0;
    fixtures.forEach((f, i) => {
        const weight = i === 0 ? AI_WEIGHTS.GW1 : (i === 1 ? AI_WEIGHTS.GW2 : AI_WEIGHTS.GW3);
        const difficultyMultiplier = (6 - f.diff) / 3; // Easy fixture (2) = 1.33x boost
        score += (player.xp * difficultyMultiplier * weight);
    });
    
    // Bonus for high ICT (Influence, Creativity, Threat) - The "Hub" secret sauce
    if (player.ict > 10) score += 0.5; 
    
    return parseFloat(score.toFixed(2));
}

function analyzeTeam() {
    if (squad.some(s => s.name === "")) return alert("Complete your team first!");
    
    const analysis = squad.map(slot => {
        const p = playerDB.find(pdb => pdb.name === slot.name);
        return { ...slot, playerObj: p, aggScore: getAggressiveXP(p) };
    });

    // 1. Captain Decision (Aggressive upside)
    const cap = [...analysis].sort((a, b) => b.aggScore - a.aggScore)[0];

    // 2. Transfer Suggestions (Weakest starter out)
    const starters = analysis.filter(s => !s.isBench);
    const budget = 100 - analysis.reduce((acc, s) => acc + parseFloat(s.playerObj.price), 0);
    const weakLink = starters.sort((a, b) => a.aggScore - b.aggScore)[0];

    const tips = [];
    // Find a replacement with higher aggressive xP
    const replacement = playerDB.find(p => 
        p.pos === weakLink.pos && 
        parseFloat(p.price) <= (parseFloat(weakLink.playerObj.price) + budget) &&
        !squad.some(s => s.name === p.name) &&
        getAggressiveXP(p) > (weakLink.aggScore + 1.5) // Only suggest if +1.5 xP gain
    );

    if (replacement) {
        tips.push(`🚀 <b>HIGH UPSIDE MOVE:</b> Sell ${weakLink.name} ➔ Buy ${replacement.name} (+${(getAggressiveXP(replacement) - weakLink.aggScore).toFixed(1)} xP)`);
    } else {
        tips.push(`✅ <b>SQUAD STRENGTH:</b> Your starting XI is highly aggressive for this Gameweek.`);
    }

    displayModal(cap.name, tips);
}

// --- 3. UI RENDERERS ---

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    const jersey = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';
    const fixtures = p ? getNextFixtures(p.teamId) : [];
    const aggXp = p ? getAggressiveXP(p) : 0;

    div.innerHTML = `
        <div class="jersey ${jersey}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <span class="p-name">${slotData.name || slotData.pos}</span>
            <span class="p-xp">${p ? `Agg-xP: ${aggXp}` : ''}</span>
            <div class="card-fixtures">${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}</div>`).join('')}</div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(pdb => pdb.pos === slotData.pos).map(pdb => `<option value="${pdb.name}" ${slotData.name === pdb.name ? 'selected' : ''}>${pdb.name} (£${pdb.price}m)</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 4. CORE ENGINE (SQUAD MANAGEMENT) ---

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.id !== p2.id) {
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers only swap with Goalkeepers!");
            } else {
                const tempBench = p1.isBench;
                p1.isBench = p2.isBench;
                p2.isBench = tempBench;
                if (!isValidFormation()) {
                    p2.isBench = p1.isBench; p1.isBench = tempBench;
                } else { saveSquad(); }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function updatePlayer(id, name) {
    const slot = squad.find(s => s.id === id);
    if (!name) { slot.name = ""; saveSquad(); renderPitch(); return; }
    
    const player = playerDB.find(p => p.name === name);
    const teamCount = squad.filter(s => {
        if (s.id === id) return false;
        const p = playerDB.find(pdb => pdb.name === s.name);
        return p && p.teamId === player.teamId;
    }).length;

    if (teamCount >= 3) {
        alert("Max 3 players per team!");
        renderPitch(); return;
    }

    slot.name = name;
    saveSquad();
    renderPitch();
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

function updateStats() {
    let aggTotal = 0, currentVal = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            currentVal += parseFloat(p.price);
            if (!s.isBench) aggTotal += getAggressiveXP(p);
        }
    });

    const itb = (100 - currentVal).toFixed(1);
    const rating = Math.min(100, (aggTotal / 65) * 100).toFixed(0);
    
    if(document.getElementById('budget-val')) document.getElementById('budget-val').textContent = `£${itb}m`;
    if(document.getElementById('team-rating')) {
        document.getElementById('team-rating').textContent = `${rating}%`;
        document.getElementById('team-rating').style.color = rating > 80 ? '#00ff87' : '#ff005a';
    }
}

function getNextFixtures(teamId) {
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return { opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), diff: isHome ? f.team_h_difficulty : f.team_a_difficulty };
        });
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const d = active.filter(s => s.pos === 'DEF').length;
    const m = active.filter(s => s.pos === 'MID').length;
    const f = active.filter(s => s.pos === 'FWD').length;
    return d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3;
}

function displayModal(cap, tips) {
    const modal = document.getElementById('analysis-modal');
    document.getElementById('analysis-results').innerHTML = `
        <div class="analysis-section"><h3>👑 Aggressive Captain</h3><p>${cap}</p></div>
        <div class="analysis-section"><h3>⚡ AI Strategy Moves</h3>${tips.map(t => `<div class="transfer-item">${t}</div>`).join('')}</div>
    `;
    modal.style.display = "block";
    document.getElementById('close-modal').onclick = () => modal.style.display = "none";
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

document.addEventListener('DOMContentLoaded', () => {
    syncData();
    if (document.getElementById('analyze-btn')) document.getElementById('analyze-btn').onclick = analyzeTeam;
});
