// --- CONFIGURATION & STATE ---
let playerDB = [];
let teamsDB = {}; 
let selectedSlotId = null;

// Initial empty squad structure
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
    const proxy = 'https://api.allorigins.win/raw?url=';
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
        
        ticker.textContent = "✅ Connected to FPL Live Data";
    } catch (e) {
        ticker.textContent = "⚠️ OFFLINE MODE: Using Dec 2025 Mock Data";
        // 20 Players per position (Top picks as of Dec 2025)
        playerDB = [
            // GOALKEEPERS
            { name: "Raya", pos: "GKP", price: 6.0, xp: 5.5, team: "Arsenal" },
            { name: "Roefs", pos: "GKP", price: 4.8, xp: 5.2, team: "Sunderland" },
            { name: "Pickford", pos: "GKP", price: 5.5, xp: 4.8, team: "Everton" },
            { name: "Sánchez", pos: "GKP", price: 4.9, xp: 4.5, team: "Chelsea" },
            { name: "Donnarumma", pos: "GKP", price: 5.7, xp: 4.3, team: "Man City" },
            { name: "Vicario", pos: "GKP", price: 4.9, xp: 4.2, team: "Spurs" },
            { name: "Henderson", pos: "GKP", price: 5.1, xp: 4.1, team: "Crystal Palace" },
            { name: "Martinez", pos: "GKP", price: 5.1, xp: 4.0, team: "Aston Villa" },
            { name: "Pope", pos: "GKP", price: 5.1, xp: 3.9, team: "Newcastle" },
            { name: "Alisson", pos: "GKP", price: 5.4, xp: 3.8, team: "Liverpool" },
            { name: "Onana", pos: "GKP", price: 4.9, xp: 3.7, team: "Man Utd" },
            { name: "Flekken", pos: "GKP", price: 4.5, xp: 3.6, team: "Brentford" },
            { name: "Sels", pos: "GKP", price: 4.7, xp: 3.5, team: "Nott'm Forest" },
            { name: "Verbruggen", pos: "GKP", price: 4.4, xp: 3.4, team: "Brighton" },
            { name: "Leno", pos: "GKP", price: 4.9, xp: 3.3, team: "Fulham" },
            { name: "Areola", pos: "GKP", price: 4.3, xp: 3.2, team: "West Ham" },
            { name: "Kelleher", pos: "GKP", price: 4.5, xp: 3.1, team: "Brentford" },
            { name: "Petrović", pos: "GKP", price: 4.5, xp: 3.0, team: "Bournemouth" },
            { name: "Muric", pos: "GKP", price: 4.4, xp: 2.9, team: "Ipswich" },
            { name: "Hermansen", pos: "GKP", price: 4.3, xp: 2.8, team: "Leicester" },

            // DEFENDERS
            { name: "Timber", pos: "DEF", price: 6.5, xp: 6.2, team: "Arsenal" },
            { name: "Gabriel", pos: "DEF", price: 6.2, xp: 6.0, team: "Arsenal" },
            { name: "Cucurella", pos: "DEF", price: 6.2, xp: 5.9, team: "Chelsea" },
            { name: "Gvardiol", pos: "DEF", price: 6.0, xp: 5.8, team: "Man City" },
            { name: "Muñoz", pos: "DEF", price: 5.9, xp: 5.7, team: "Crystal Palace" },
            { name: "Virgil", pos: "DEF", price: 5.9, xp: 5.6, team: "Liverpool" },
            { name: "Saliba", pos: "DEF", price: 5.9, xp: 5.5, team: "Arsenal" },
            { name: "Calafiori", pos: "DEF", price: 5.7, xp: 5.4, team: "Arsenal" },
            { name: "Rúben Dias", pos: "DEF", price: 5.7, xp: 5.3, team: "Man City" },
            { name: "Tarkowski", pos: "DEF", price: 5.5, xp: 5.2, team: "Everton" },
            { name: "James", pos: "DEF", price: 5.6, xp: 5.1, team: "Chelsea" },
            { name: "Kerkez", pos: "DEF", price: 5.6, xp: 5.0, team: "Liverpool" },
            { name: "Chalobah", pos: "DEF", price: 5.5, xp: 4.9, team: "Chelsea" },
            { name: "Konaté", pos: "DEF", price: 5.4, xp: 4.8, team: "Liverpool" },
            { name: "Porro", pos: "DEF", price: 5.5, xp: 4.7, team: "Spurs" },
            { name: "Milenković", pos: "DEF", price: 5.0, xp: 4.6, team: "Nott'm Forest" },
            { name: "Robinson", pos: "DEF", price: 4.7, xp: 4.5, team: "Fulham" },
            { name: "Hall", pos: "DEF", price: 4.5, xp: 4.4, team: "Newcastle" },
            { name: "Dunk", pos: "DEF", price: 4.6, xp: 4.3, team: "Brighton" },
            { name: "Murillo", pos: "DEF", price: 4.5, xp: 4.2, team: "Nott'm Forest" },

            // MIDFIELDERS
            { name: "Salah", pos: "MID", price: 14.5, xp: 9.8, team: "Liverpool" },
            { name: "Palmer", pos: "MID", price: 11.0, xp: 9.2, team: "Chelsea" },
            { name: "Saka", pos: "MID", price: 10.5, xp: 8.7, team: "Arsenal" },
            { name: "Foden", pos: "MID", price: 9.3, xp: 7.8, team: "Man City" },
            { name: "Mbeumo", pos: "MID", price: 8.5, xp: 7.5, team: "Man Utd" },
            { name: "Wirtz", pos: "MID", price: 8.4, xp: 7.2, team: "Liverpool" },
            { name: "Fernandes", pos: "MID", price: 9.0, xp: 7.0, team: "Man Utd" },
            { name: "Gakpo", pos: "MID", price: 7.7, xp: 6.8, team: "Liverpool" },
            { name: "Semenyo", pos: "MID", price: 7.4, xp: 6.5, team: "Bournemouth" },
            { name: "Rogers", pos: "MID", price: 7.2, xp: 6.3, team: "Aston Villa" },
            { name: "Gordon", pos: "MID", price: 7.4, xp: 6.2, team: "Newcastle" },
            { name: "Kudus", pos: "MID", price: 6.6, xp: 6.1, team: "Spurs" },
            { name: "Luis Diaz", pos: "MID", price: 8.0, xp: 6.0, team: "Liverpool" },
            { name: "Bowen", pos: "MID", price: 7.8, xp: 5.9, team: "West Ham" },
            { name: "Marmoush", pos: "MID", price: 8.5, xp: 5.8, team: "Man City" },
            { name: "Garnacho", pos: "MID", price: 6.8, xp: 5.7, team: "Man Utd" },
            { name: "Mitoma", pos: "MID", price: 6.4, xp: 5.6, team: "Brighton" },
            { name: "Son", pos: "MID", price: 10.0, xp: 5.5, team: "Spurs" },
            { name: "Minteh", pos: "MID", price: 5.9, xp: 5.4, team: "Brighton" },
            { name: "Xavi Simons", pos: "MID", price: 7.0, xp: 5.3, team: "Spurs" },

            // FORWARDS
            { name: "Haaland", pos: "FWD", price: 15.2, xp: 10.5, team: "Man City" },
            { name: "Ekitiké", pos: "FWD", price: 8.8, xp: 8.2, team: "Liverpool" },
            { name: "Isak", pos: "FWD", price: 10.5, xp: 7.8, team: "Newcastle" },
            { name: "Gyokeres", pos: "FWD", price: 9.0, xp: 7.5, team: "Arsenal" },
            { name: "Watkins", pos: "FWD", price: 8.9, xp: 7.2, team: "Aston Villa" },
            { name: "Woltemade", pos: "FWD", price: 7.3, xp: 6.8, team: "Newcastle" },
            { name: "Wood", pos: "FWD", price: 7.5, xp: 6.5, team: "Nott'm Forest" },
            { name: "Mateta", pos: "FWD", price: 8.1, xp: 6.3, team: "Crystal Palace" },
            { name: "Joao Pedro", pos: "FWD", price: 7.7, xp: 6.1, team: "Chelsea" },
            { name: "Jackson", pos: "FWD", price: 7.9, xp: 6.0, team: "Chelsea" },
            { name: "Solanke", pos: "FWD", price: 8.0, xp: 5.9, team: "Spurs" },
            { name: "Cunha", pos: "FWD", price: 8.1, xp: 5.8, team: "Man Utd" },
            { name: "Igor Thiago", pos: "FWD", price: 6.3, xp: 5.7, team: "Brentford" },
            { name: "Sesko", pos: "FWD", price: 8.5, xp: 5.6, team: "Man Utd" },
            { name: "Evanilson", pos: "FWD", price: 7.0, xp: 5.5, team: "Bournemouth" },
            { name: "Wissa", pos: "FWD", price: 6.5, xp: 5.4, team: "Brentford" },
            { name: "Welbeck", pos: "FWD", price: 6.0, xp: 5.3, team: "Brighton" },
            { name: "Delap", pos: "FWD", price: 5.5, xp: 5.2, team: "Ipswich" },
            { name: "Vardy", pos: "FWD", price: 5.5, xp: 5.1, team: "Leicester" },
            { name: "Strand Larsen", pos: "FWD", price: 6.0, xp: 5.0, team: "Wolves" }
        ].sort((a,b) => b.xp - a.xp);
    }
    renderPitch();
    updateStats();
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

// --- UI RENDERING ---
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
    
    playerDB.filter(p => p.pos === slotData.pos).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.selected = slotData.name === p.name;
        opt.textContent = `${p.name} (£${p.price}m)`;
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

// --- SWAPPING & FORMATION VALIDATION ---
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

// --- STATS & ANALYSIS ---
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

syncData();