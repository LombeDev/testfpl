// --- CONFIGURATION & STATE ---
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = {}; 
let selectedSlotId = null;

// Initial squad structure (15 slots)
let squad = [
    { id: 0, pos: 'GKP', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 1, pos: 'DEF', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 2, pos: 'DEF', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 3, pos: 'DEF', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 4, pos: 'DEF', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 5, pos: 'MID', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 6, pos: 'MID', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 7, pos: 'MID', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 8, pos: 'MID', name: '', isBench: false, isCaptain: false, isVice: false },
    { id: 9, pos: 'FWD', name: '', isBench: false, isCaptain: true, isVice: false },
    { id: 10, pos: 'FWD', name: '', isBench: false, isCaptain: false, isVice: true },
    { id: 11, pos: 'GKP', name: '', isBench: true, isCaptain: false, isVice: false },
    { id: 12, pos: 'DEF', name: '', isBench: true, isCaptain: false, isVice: false },
    { id: 13, pos: 'MID', name: '', isBench: true, isCaptain: false, isVice: false },
    { id: 14, pos: 'FWD', name: '', isBench: true, isCaptain: false, isVice: false }
];

// --- DATA SYNC (Bootstrap & Fixtures) ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const proxy = 'https://corsproxy.io/?url=';
    const api = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const fixturesApi = 'https://fantasy.premierleague.com/api/fixtures/?future=1';
    
    try {
        // 1. Fetch Player and Team Data
        const res = await fetch(proxy + encodeURIComponent(api));
        const data = await res.json();
        
        data.teams.forEach(t => teamsDB[t.id] = t.name);
        
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            team: teamsDB[p.team],
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: p.now_cost / 10,
            xp: parseFloat(p.ep_next) || 0,
            form: parseFloat(p.form) || 0
        })).sort((a,b) => b.xp - a.xp);

        // 2. Fetch Fixtures for FDR
        const fRes = await fetch(proxy + encodeURIComponent(fixturesApi));
        const fData = await fRes.json();
        const nextGW = data.events.find(e => e.is_next).id;

        fData.filter(f => f.event === nextGW).forEach(f => {
            fixturesDB[teamsDB[f.team_a]] = f.team_a_difficulty;
            fixturesDB[teamsDB[f.team_h]] = f.team_h_difficulty;
        });
        
        ticker.textContent = "AI Analysis Active";
        renderPitch();
        updateStats();
    } catch (e) {
        ticker.textContent = "⚠️ Sync Error: Check connection";
        console.error(e);
    }
}

// --- FPL ID IMPORT ---
async function importByTeamID() {
    const teamId = document.getElementById('fpl-id-input').value;
    if (!teamId) return alert("Enter your Team ID first!");

    try {
        const proxy = 'https://corsproxy.io/?url=';
        // Get current picks
        const staticRes = await fetch(proxy + encodeURIComponent('https://fantasy.premierleague.com/api/bootstrap-static/'));
        const staticData = await staticRes.json();
        const currentGW = staticData.events.find(e => e.is_current).id;

        const url = `https://fantasy.premierleague.com/api/entry/${teamId}/event/${currentGW}/picks/`;
        const res = await fetch(proxy + encodeURIComponent(url));
        const teamData = await res.json();

        // Clear and Map
        teamData.picks.forEach((pick, index) => {
            const fplPlayer = staticData.elements.find(p => p.id === pick.element);
            if (squad[index] && fplPlayer) {
                squad[index].name = fplPlayer.web_name;
                squad[index].isCaptain = pick.is_captain;
                squad[index].isVice = pick.is_vice_captain;
            }
        });

        renderPitch();
        updateStats();
    } catch (e) {
        alert("Failed to import team. Verify Team ID.");
    }
}

// --- SCREENSHOT HANDLER (Placeholder) ---
function handleScreenshot(event) {
    const file = event.target.files[0];
    if (file) {
        alert("Screenshot uploaded! In a production environment, this would be sent to an OCR service. For now, try the FPL ID sync!");
    }
}

// --- UI RENDERING ---
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    pitch.innerHTML = ''; 
    bench.innerHTML = '';

    const starters = squad.filter(s => !s.isBench);
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        starters.filter(p => p.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    const benchRow = document.createElement('div');
    benchRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => benchRow.appendChild(createSlotUI(p)));
    bench.appendChild(benchRow);
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    const teamClass = player ? player.team.toLowerCase().replace(/\s+/g, '-') : 'default';
    const fdrColor = player ? getFDRColor(fixturesDB[player.team]) : '#ccc';

    let badges = '';
    if (slotData.isCaptain) badges = '<span class="badge-c">C</span>';
    if (slotData.isVice) badges = '<span class="badge-vc">VC</span>';

    div.innerHTML = `
        <div class="jersey ${teamClass}"></div>
        <div class="player-label">
            <div class="name">${slotData.name || slotData.pos} ${badges}</div>
            <div class="fdr-tag" style="background:${fdrColor}">${player ? player.xp.toFixed(1) : '-'}</div>
        </div>
    `;

    div.onclick = () => handleSwap(slotData.id);
    div.oncontextmenu = (e) => {
        e.preventDefault();
        setCaptain(slotData.id);
    };

    return div;
}

// --- CORE LOGIC ---
function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);
        
        if (p1.id !== p2.id) {
            // If they are different positions and moving from bench to field, validate
            if (p1.isBench !== p2.isBench && p1.pos !== p2.pos) {
                alert("Only same-position swaps allowed for different roles!");
            } else {
                const tempStatus = p1.isBench;
                p1.isBench = p2.isBench;
                p2.isBench = tempStatus;
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
    updateStats();
}

function setCaptain(id) {
    squad.forEach(s => {
        s.isCaptain = (s.id === id);
        if (s.isCaptain) s.isVice = false;
    });
    renderPitch();
    updateStats();
}

function getFDRColor(val) {
    if (val <= 2) return '#05ff80'; // Green
    if (val === 3) return '#e1e1e1'; // Grey
    return '#ff005a'; // Red
}

function updateStats() {
    let totalValue = 0;
    let starterXP = 0;
    let totalFDR = 0;
    let count = 0;

    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            totalValue += p.price;
            if (!s.isBench) {
                const mult = s.isCaptain ? 2 : 1;
                starterXP += (p.xp * mult);
                totalFDR += (fixturesDB[p.team] || 3);
                count++;
            }
        }
    });

    // Update DOM
    const bank = (100 - totalValue).toFixed(1);
    document.getElementById('budget-val').textContent = `£${bank}m`;
    document.getElementById('predicted-points').textContent = starterXP.toFixed(1);
    
    const rating = Math.min(100, (starterXP / 75) * 100).toFixed(0);
    document.getElementById('team-rating').textContent = `${rating}%`;

    const avgFDR = count > 0 ? totalFDR / count : 3;
    const gwRatingEl = document.getElementById('gw-rating');
    if (avgFDR <= 2.5) gwRatingEl.textContent = "A";
    else if (avgFDR <= 3.2) gwRatingEl.textContent = "B";
    else gwRatingEl.textContent = "C";
}

// Initial Run
syncData();
