/**
 * KOPALA FPL - Total Efficiency Engine
 * Features: Live API Sync, Team Persistence, AI Ratings, and Fixture Cards
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = []; // Global store for upcoming matches
let selectedSlotId = null;

// Initial squad structure
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

// --- 1. DATA SYNC & FIXTURE MAPPING ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    try {
        // Fetch Teams and Players
        const res = await fetch(`${API_BASE}bootstrap-static/`);
        const data = await res.json();
        
        // Fetch Fixtures
        const fixRes = await fetch(`${API_BASE}fixtures/`);
        fixturesDB = await fixRes.json();

        // Map Team Short Names (e.g., 1 -> ARS)
        data.teams.forEach(t => teamsDB[t.id] = t.short_name);
        
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);
        
        if (ticker) ticker.innerHTML = "✅ <span style='color:var(--fpl-green)'>Sync Complete: Live Fixtures Loaded</span>";
        
        loadSquad();
        renderPitch();
    } catch (e) {
        if (ticker) ticker.textContent = "⚠️ Connection Error";
    }
}

function getNextFixtures(teamId, limit = 3) {
    return fixturesDB
        .filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, limit)
        .map(f => {
            const isHome = f.team_h === teamId;
            const oppId = isHome ? f.team_a : f.team_h;
            const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            return {
                opponent: teamsDB[oppId],
                location: isHome ? 'H' : 'A',
                diff: difficulty
            };
        });
}

// --- 2. STORAGE & INTERACTION ---
function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

function updatePlayer(slotId, name) {
    const slot = squad.find(s => s.id === slotId);
    slot.name = name;
    saveSquad();
    renderPitch();
}

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.isBench !== p2.isBench) {
            const temp = p1.isBench;
            p1.isBench = p2.isBench;
            p2.isBench = temp;
            saveSquad();
        }
        selectedSlotId = null;
    }
    renderPitch();
}

// --- 3. UI RENDERING ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    const teamClass = player ? player.teamShort.toLowerCase() : 'default';
    const fixtures = player ? getNextFixtures(player.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${teamClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.length > 0 ? fixtures.map(f => `
                    <div class="fix-item diff-${f.diff}">
                        <span class="opp-text">${f.opponent}</span>
                        <span class="loc-text">${f.location}</span>
                    </div>
                `).join('') : '<div class="fix-item">TBC</div>'}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `
                <option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>
            `).join('')}
        </select>
    `;
    return div;
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const starters = squad.filter(s => !s.isBench);
    
    positions.forEach(pos => {
        const rowPlayers = starters.filter(p => p.pos === pos);
        if (rowPlayers.length > 0) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowPlayers.forEach(p => rowDiv.appendChild(createSlotUI(p)));
            pitch.appendChild(rowDiv);
        }
    });

    const benchRow = document.createElement('div');
    benchRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);
    
    updateStats();
}

// --- 4. ANALYTICS ---
function updateStats() {
    let totalXP = 0, totalValue = 0, squadPlayers = [];
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalValue += parseFloat(p.price);
            squadPlayers.push({ ...p, isBench: s.isBench });
            if (!s.isBench) totalXP += p.xp;
        }
    });

    document.getElementById('v-xp').textContent = totalXP.toFixed(1);
    const budgetVal = (100 - totalValue).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    budgetEl.textContent = `£${budgetVal}m`;
    budgetEl.style.color = budgetVal < 0 ? '#ff005a' : '#05ff80';

    const ratingScore = Math.min(100, (totalXP / 70) * 100);
    document.getElementById('team-rating').textContent = `${ratingScore.toFixed(0)}%`;
    
    let grade = ratingScore > 75 ? "A+" : (ratingScore > 50 ? "B" : "C");
    document.getElementById('gw-rating').textContent = grade;

    renderTransferRecs(squadPlayers);
}

function renderTransferRecs(squadPlayers) {
    const list = document.getElementById('transfer-list');
    if (!list || squadPlayers.length < 11) return;

    const sell = [...squadPlayers].sort((a,b) => a.xp - b.xp).slice(0, 2);
    const currentNames = squadPlayers.map(p => p.name);
    const buy = playerDB.filter(p => !currentNames.includes(p.name)).sort((a,b) => b.xp - a.xp).slice(0, 2);

    list.innerHTML = sell.map((p, i) => `
        <div class="transfer-row">
            <span>SELL: <b>${p.name}</b></span>
            <i class="fa-solid fa-arrow-right"></i>
            <span>BUY: <b>${buy[i].name}</b></span>
        </div>
    `).join('');
}

function initNav() {
    const toggle = () => {
        document.getElementById('side-drawer').classList.toggle('open');
        document.getElementById('backdrop').classList.toggle('active');
    };
    document.getElementById('menu-btn').onclick = toggle;
    document.getElementById('close-btn').onclick = toggle;
}

document.addEventListener('DOMContentLoaded', () => { initNav(); syncData(); });


function runAIWildcard() {
    // 1. Safety Check: Is the data ready?
    if (!playerDB || playerDB.length === 0) {
        alert("AI is still syncing data from FPL servers. Please wait a few seconds.");
        return;
    }

    if (!confirm("AI will rebuild your team for max points within £100m. This will clear your current picks. Proceed?")) return;

    // 2. Clear current names to ensure a fresh start
    squad.forEach(slot => slot.name = "");

    let currentBudget = 100.0;
    const selectedNames = [];
    
    // 3. Sort players by Predicted Points (XP)
    const sorted = [...playerDB].sort((a, b) => b.xp - a.xp);

    // 4. Optimization Loop
    squad.forEach((slot, index) => {
        // Reserve a small buffer for the remaining slots (avg £4.3m per player)
        const reserveCount = squad.length - 1 - index;
        const budgetBuffer = reserveCount * 4.3; 
        
        // Find best player for this specific position
        const bestChoice = sorted.find(p => 
            p.pos === slot.pos && 
            !selectedNames.includes(p.name) && 
            parseFloat(p.price) <= (currentBudget - budgetBuffer)
        );

        // Fallback: If no high-XP player fits, grab the absolute cheapest player in that position
        const choice = bestChoice || sorted
            .filter(p => p.pos === slot.pos && !selectedNames.includes(p.name))
            .sort((a,b) => a.price - b.price)[0];

        if (choice) {
            slot.name = choice.name;
            selectedNames.push(choice.name);
            currentBudget -= parseFloat(choice.price);
        }
    });

    // 5. CRITICAL: Save and Re-render
    saveSquad();      // Saves to LocalStorage
    renderPitch();    // Physically updates the HTML on your screen
    
    // Optional UI Feedback
    const ticker = document.getElementById('ticker');
    if (ticker) {
        ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Wildcard Draft Complete!</span>";
        setTimeout(() => syncData(), 500); // Small delay to refresh fixture colors
    }
}
