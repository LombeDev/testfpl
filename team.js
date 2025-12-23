/**
 * KOPALA FPL - Team Picker & AI Logic
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
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

async function syncData() {
    const ticker = document.getElementById('ticker');
    const cacheKey = "fpl_bootstrap_cache";
    
    try {
        // 1. Try to get data from LocalStorage first (Efficiency!)
        const cached = localStorage.getItem(cacheKey);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 15 * 60 * 1000) { // 15 min cache
                data = parsed.content;
            }
        }

        // 2. If no cache, fetch via Netlify Proxy
        if (!data) {
            const res = await fetch(`${API_BASE}bootstrap-static/`);
            data = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }
        
        // 3. Process Data
        data.teams.forEach(t => teamsDB[t.id] = t.name);
        
        playerDB = data.elements.map(p => ({
            name: p.web_name,
            team: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: p.now_cost / 10,
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);
        
        if (ticker) ticker.innerHTML = "✅ <span style='color:#05ff80'>Connected to FPL Live Data</span>";

    } catch (e) {
        console.warn("FPL Sync Failed, using fallback data.");
        if (ticker) ticker.textContent = "⚠️ OFFLINE MODE: Using Mock Data";
        loadMockData(); // Your existing mock data array here
    }
    
    renderPitch();
    updateStats();
}

// --- CORE UI RENDERING ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    pitch.innerHTML = ''; 
    bench.innerHTML = '';

    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const starters = squad.filter(s => !s.isBench);
    
    positions.forEach(pos => {
        const rowPlayers = starters.filter(p => p.pos === pos);
        if (rowPlayers.length > 0) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'pitch-row'; // Changed to pitch-row for CSS clarity
            rowPlayers.forEach(p => rowDiv.appendChild(createSlotUI(p)));
            pitch.appendChild(rowDiv);
        }
    });

    const benchRow = document.createElement('div');
    benchRow.className = 'pitch-row bench';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);

    updateFormationUI();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${slotData.isBench ? 'is-bench' : ''} ${selectedSlotId === slotData.id ? 'selected-slot' : ''}`;
    
    // Improved Swap Logic
    div.onclick = (e) => {
        if (e.target.tagName === 'SELECT') return;
        handleSwap(slotData.id);
    };

    const player = playerDB.find(p => p.name === slotData.name);
    const teamClass = player ? player.team.toLowerCase().replace(/\s+/g, '-') : 'default';

    div.innerHTML = `
        <div class="jersey ${teamClass}"></div>
        <div class="player-name-tag">${slotData.name || slotData.pos}</div>
        <select class="player-select" onchange="handlePlayerChange(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `
                <option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>
                    ${p.name} (£${p.price}m)
                </option>
            `).join('')}
        </select>
    `;

    return div;
}

// --- LOGIC FUNCTIONS ---

function handlePlayerChange(slotId, newName) {
    const slot = squad.find(s => s.id === slotId);
    if (newName === "" || canAddPlayer(newName) || newName === slot.name) {
        slot.name = newName;
        renderPitch();
        updateStats();
    } else {
        const p = playerDB.find(x => x.name === newName);
        alert(`⚠️ Rules Violation: 3 players max from ${p.team}!`);
        renderPitch(); // Reset UI
    }
}

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        
        if (p1.id !== p2.id && p1.isBench !== p2.isBench) {
            if (validateFormation(p1, p2)) {
                const tempStatus = p1.isBench;
                p1.isBench = p2.isBench;
                p2.isBench = tempStatus;
            } else {
                alert("Invalid Swap! FPL rules: 1 GKP, 3-5 DEF, 2-5 MID, 1-3 FWD.");
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function validateFormation(p1, p2) {
    const starters = squad.filter(s => !s.isBench);
    // Create a simulation of the new team
    const testStarters = starters.map(s => s.id === p1.id ? p2 : (s.id === p2.id ? p1 : s));
    
    const d = testStarters.filter(s => s.pos === 'DEF').length;
    const m = testStarters.filter(s => s.pos === 'MID').length;
    const f = testStarters.filter(s => s.pos === 'FWD').length;
    const g = testStarters.filter(s => s.pos === 'GKP').length;
    
    return (g === 1 && d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3);
}

function updateStats() {
    let totalValue = 0;
    let totalXP = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalValue += p.price;
            if (!s.isBench) totalXP += p.xp;
        }
    });

    const bank = (100 - totalValue).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    if (budgetEl) {
        budgetEl.textContent = `£${bank}m`;
        budgetEl.style.color = bank < 0 ? '#ff005a' : '#05ff80';
    }

    const scoreDisp = document.getElementById('score-display');
    if (scoreDisp) scoreDisp.textContent = totalXP.toFixed(0);
}

// Initialize
syncData();
