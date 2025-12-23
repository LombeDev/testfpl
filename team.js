/**
 * KOPALA FPL - AI Team Logic & Performance Engine
 * Version: 2.1 (Dec 2025)
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let selectedSlotId = null;

// 1. INITIAL SQUAD STRUCTURE
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

// --- 2. DATA SYNC & CACHING ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const cacheKey = "fpl_bootstrap_cache";
    
    try {
        const cached = localStorage.getItem(cacheKey);
        let data;

        // Efficiency: Use cache for 15 mins to avoid unnecessary API hits
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
                data = parsed.content;
            }
        }

        if (!data) {
            const res = await fetch(`${API_BASE}bootstrap-static/`);
            data = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }
        
        // Build database
        data.teams.forEach(t => teamsDB[t.id] = t.name);
        playerDB = data.elements.map(p => ({
            name: p.web_name,
            team: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: p.now_cost / 10,
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);
        
        if (ticker) ticker.innerHTML = "✅ <span style='color:var(--fpl-green)'>Sync Complete: Dec 2025</span>";
        
        loadSquad(); 
        renderPitch();
    } catch (e) {
        if (ticker) ticker.textContent = "⚠️ Server Busy. Using offline mode.";
        console.error("FPL API Error:", e);
    }
}

// --- 3. STORAGE LOGIC ---
function saveSquad() {
    localStorage.setItem('kopala_saved_squad', JSON.stringify(squad));
}

function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// --- 4. UI RENDERING ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    pitch.innerHTML = ''; 
    bench.innerHTML = '';

    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const starters = squad.filter(s => !s.isBench);
    
    // Render Pitch Rows
    positions.forEach(pos => {
        const rowPlayers = starters.filter(p => p.pos === pos);
        if (rowPlayers.length > 0) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowPlayers.forEach(p => rowDiv.appendChild(createSlotUI(p)));
            pitch.appendChild(rowDiv);
        }
    });

    // Render Bench
    const benchRow = document.createElement('div');
    benchRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);
    
    updateStats();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    const teamClass = player ? player.team.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '') : 'default';

    div.innerHTML = `
        <div class="jersey ${teamClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-name-tag">${slotData.name || slotData.pos}</div>
        <select class="player-match-tag" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `
                <option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>
            `).join('')}
        </select>
    `;
    return div;
}

// --- 5. LOGIC & MATH ENGINE ---
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
        
        // Swap Bench/Pitch status
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

function updateStats() {
    let totalXP = 0;
    let totalValue = 0;
    let squadPlayers = [];

    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalValue += p.price;
            squadPlayers.push({ ...p, isBench: s.isBench });
            if (!s.isBench) totalXP += p.xp;
        }
    });
    
    // Update Predicted Points
    if(document.getElementById('v-xp')) document.getElementById('v-xp').textContent = totalXP.toFixed(1);

    // Update Budget
    const budgetVal = (100 - totalValue).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) {
        budgetEl.textContent = `£${budgetVal}m`;
        budgetEl.style.color = budgetVal < 0 ? '#ff005a' : '#05ff80';
    }

    // Update Team Rating (0-100%)
    const ratingScore = Math.min(100, (totalXP / 70) * 100);
    const ratingEl = document.getElementById('team-rating');
    if(ratingEl) {
        ratingEl.textContent = `${ratingScore.toFixed(0)}%`;
        ratingEl.style.color = ratingScore > 80 ? '#00ff87' : (ratingScore > 60 ? '#f39c12' : '#ff005a');
    }

    // Update GW Rating (Grade System)
    const gwRatingEl = document.getElementById('gw-rating');
    if(gwRatingEl) {
        let grade = "E";
        if (ratingScore > 85) grade = "S";
        else if (ratingScore > 75) grade = "A+";
        else if (ratingScore > 65) grade = "B";
        else if (ratingScore > 50) grade = "C";
        gwRatingEl.textContent = grade;
    }

    // Update Formation Label
    const starters = squad.filter(s => !s.isBench);
    const d = starters.filter(s => s.pos === 'DEF').length;
    const m = starters.filter(s => s.pos === 'MID').length;
    const f = starters.filter(s => s.pos === 'FWD').length;
    if(document.getElementById('formation-ticker')) {
        document.getElementById('formation-ticker').textContent = `FORMATION: ${d}-${m}-${f}`;
    }

    renderTransferRecs(squadPlayers);
}

function renderTransferRecs(squadPlayers) {
    const list = document.getElementById('transfer-list');
    if (!list) return;

    if (squadPlayers.length < 11) {
        list.innerHTML = `<p style="font-size:12px; color:#666;">Complete your starting XI to see AI Transfer Logic.</p>`;
        return;
    }

    // Logic: Identify 2 lowest XP players to SELL
    const sellCandidates = [...squadPlayers]
        .sort((a, b) => a.xp - b.xp)
        .slice(0, 2);

    // Logic: Identify 2 highest XP players NOT in squad to BUY
    const currentNames = squadPlayers.map(p => p.name);
    const buyTargets = playerDB
        .filter(p => !currentNames.includes(p.name))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 2);

    list.innerHTML = sellCandidates.map((p, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:10px; background:white; border:1px solid #eee; border-radius:6px;">
            <div style="flex:1">
                <span style="color:#ff005a; font-size:9px; font-weight:900;">SELL</span><br>
                <b style="font-size:12px;">${p.name}</b>
            </div>
            <div style="padding: 0 10px;"><i class="fa-solid fa-arrow-right-long" style="color:#37003c;"></i></div>
            <div style="flex:1; text-align:right;">
                <span style="color:#00ff87; font-size:9px; font-weight:900;">BUY</span><br>
                <b style="font-size:12px;">${buyTargets[i].name}</b>
            </div>
        </div>
    `).join('');
}

// --- 6. NAVIGATION BOOTSTRAP ---
function initNav() {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('backdrop');

    const toggle = () => {
        drawer.classList.toggle('open');
        backdrop.classList.toggle('active');
    };

    if(menuBtn) menuBtn.onclick = toggle;
    if(closeBtn) closeBtn.onclick = toggle;
    if(backdrop) backdrop.onclick = toggle;
}

// Kickoff
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    syncData();
});
