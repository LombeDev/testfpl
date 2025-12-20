// --- CONFIGURATION & STATE ---
let playerDB = [];
let teamsDB = {}; 
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

// --- DATA SYNC ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const proxy = 'https://corsproxy.io/?url=';
    const api = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    
    try {
        const res = await fetch(proxy + encodeURIComponent(api));
        const data = await res.json();
        
        data.teams.forEach(t => teamsDB[t.id] = t.name);
        
        playerDB = data.elements.map(p => ({
            name: p.web_name,
            team: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: p.now_cost / 10,
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);
        
        ticker.textContent = "✅ LIVE DATA SYNCED - BUILD YOUR TEAM";
    } catch (e) {
        ticker.textContent = "⚠️ OFFLINE MODE: Using Mock Data";
        playerDB = [
            { name: "Salah", pos: "MID", price: 12.5, xp: 8.5, team: "Liverpool" },
            { name: "Haaland", pos: "FWD", price: 15.0, xp: 9.2, team: "Man City" },
            { name: "Saka", pos: "MID", price: 10.0, xp: 7.1, team: "Arsenal" },
            { name: "Palmer", pos: "MID", price: 10.5, xp: 8.0, team: "Chelsea" }
        ];
    }
    renderPitch();
}

// --- TEAM LIMIT VALIDATION ---
function canAddPlayer(playerName) {
    const newPlayer = playerDB.find(p => p.name === playerName);
    if (!newPlayer) return true;
    const clubCount = squad.filter(s => {
        const p = playerDB.find(x => x.name === s.name);
        return p && p.team === newPlayer.team;
    }).length;
    return clubCount < 3;
}

// --- UI RENDERING (Re-engineered for Photo 2 Style) ---
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
            rowDiv.className = 'row';
            rowPlayers.forEach(p => rowDiv.appendChild(createSlotUI(p)));
            pitch.appendChild(rowDiv);
        }
    });

    const benchRow = document.createElement('div');
    benchRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);

    updateFormationUI();
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${slotData.isBench ? 'is-bench' : ''} ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    div.onclick = () => handleSwap(slotData.id);

    // Dynamic Jersey Logic
    const player = playerDB.find(p => p.name === slotData.name);
    const teamClass = player ? player.team.toLowerCase().replace(/\s+/g, '-') : 'default';

    const jersey = document.createElement('div');
    jersey.className = `jersey ${teamClass}`;
    div.appendChild(jersey);

    const nameTag = document.createElement('div');
    nameTag.className = 'player-name-tag';
    nameTag.textContent = slotData.name || slotData.pos;
    div.appendChild(nameTag);

    const select = document.createElement('select');
    select.className = 'player-match-tag';
    select.onclick = (e) => e.stopPropagation(); 
    select.innerHTML = `<option value="">-- Pick --</option>`;
    
    playerDB.filter(p => p.pos === slotData.pos).slice(0, 50).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.selected = slotData.name === p.name;
        opt.textContent = `${p.name} £${p.price}`;
        select.appendChild(opt);
    });

    select.onchange = (e) => {
        const selectedName = e.target.value;
        if (selectedName === "" || canAddPlayer(selectedName) || selectedName === slotData.name) {
            slotData.name = selectedName;
            renderPitch();
            updateStats();
        } else {
            const p = playerDB.find(x => x.name === selectedName);
            alert(`⚠️ Rules Violation: 3 players max from ${p.team}!`);
            e.target.value = slotData.name;
        }
    };

    div.appendChild(select);
    return div;
}

// --- CORE LOGIC: SWAPPING & VALIDATION ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        if (p1.isBench !== p2.isBench) {
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
    updateStats();
}

function validateFormation(p1, p2) {
    const starters = squad.filter(s => !s.isBench);
    const testStarters = starters.map(s => s.id === p1.id ? p2 : (s.id === p2.id ? p1 : s));
    const d = testStarters.filter(s => s.pos === 'DEF').length;
    const m = testStarters.filter(s => s.pos === 'MID').length;
    const f = testStarters.filter(s => s.pos === 'FWD').length;
    const g = testStarters.filter(s => s.pos === 'GKP').length;
    return (g === 1 && d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3);
}

// --- UPDATED STATS FOR SUMMARY GRID ---
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

    // Push data to the new FPL Grid at bottom
    const scoreDisp = document.getElementById('score-display');
    const vXp = document.getElementById('v-xp');
    if (scoreDisp) scoreDisp.textContent = totalXP.toFixed(0);
    if (vXp) vXp.textContent = (totalXP * 1.05).toFixed(0);

    return { totalValue, totalXP };
}

function updateFormationUI() {
    const starters = squad.filter(s => !s.isBench);
    const d = starters.filter(s => s.pos === 'DEF').length;
    const m = starters.filter(s => s.pos === 'MID').length;
    const f = starters.filter(s => s.pos === 'FWD').length;
    const el = document.getElementById('formation-ticker');
    if (el) el.textContent = `FORMATION: ${d}-${m}-${f}`;
}

function runAnalysis() {
    const stats = updateStats();
    const resultsArea = document.getElementById('results');
    if (resultsArea) resultsArea.style.display = 'block';

    let starters = [];
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p && !s.isBench) starters.push(p);
    });

    if (starters.length < 11) {
        document.getElementById('ai-msg').innerHTML = "🚨 <b>SQUAD INCOMPLETE:</b> Pick 11 starters.";
        return;
    }

    const sortedByXP = [...starters].sort((a, b) => b.xp - a.xp);
    const captain = sortedByXP[0];
    document.getElementById('ai-msg').innerHTML = `⭐ <b>AI CAPTAIN:</b> Give the armband to <b>${captain.name}</b> for the best chance at maximum points.`;
}

function autoOptimize() {
    squad.forEach(slot => {
        const choice = playerDB.find(p => 
            p.pos === slot.pos && 
            !squad.some(s => s.name === p.name) &&
            canAddPlayer(p.name)
        );
        if (choice) slot.name = choice.name;
    });
    renderPitch();
    updateStats();
}

// --- DRAWER MENU ---
const openBtn = document.getElementById('open-drawer-btn');
const closeBtn = document.getElementById('close-drawer-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

const toggleMenu = (open) => {
    if(!drawer) return;
    drawer.classList.toggle('open', open);
    backdrop.classList.toggle('active', open);
};

if(openBtn) openBtn.onclick = () => toggleMenu(true);
if(closeBtn) closeBtn.onclick = () => toggleMenu(false);
if(backdrop) backdrop.onclick = () => toggleMenu(false);

syncData();
