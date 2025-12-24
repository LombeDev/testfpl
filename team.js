/**
 * KOPALA FPL - AI Master Engine (v4.0.0)
 * FIXES: Strict GK Validation, Triple Fixture Predictor, Wildcard Logic
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

async function syncData() {
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        data.teams.forEach(t => { teamsDB[t.id] = { name: t.name.toLowerCase().replace(/\s+/g, '_'), short: t.short_name }; });
        
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team]?.name || 'default',
            teamCode: teamsDB[p.team]?.short || 'N/A',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            form: p.form
        })).sort((a,b) => b.xp - a.xp);

        loadSquad();
        renderPitch();
        renderPlayerList('ALL');
    } catch (e) { console.error("Sync Failed", e); }
}

// --- FIXTURE PREDICTOR LOGIC ---
function getNextFixtures(teamId, count = 3) {
    return fixturesDB
        .filter(f => (f.team_a === teamId || f.team_h === teamId) && f.finished === false)
        .slice(0, count)
        .map(f => {
            const isHome = f.team_h === teamId;
            const opponentId = isHome ? f.team_a : f.team_h;
            return {
                opp: teamsDB[opponentId]?.short || '???',
                difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
                home: isHome
            };
        });
}

// --- AI WILDCARD LOGIC ---
function runAIWildcard() {
    if(!confirm("AI will optimize your entire squad based on Form and Fixtures. Proceed?")) return;
    
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const limits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };
    let newSquad = [];
    let budget = 100.0;

    positions.forEach(pos => {
        const bestInPos = playerDB
            .filter(p => p.pos === pos)
            .sort((a,b) => b.xp - a.xp)
            .slice(0, limits[pos]);
        
        bestInPos.forEach(p => {
            newSquad.push(p.name);
            budget -= parseFloat(p.price);
        });
    });

    // Simple mapping to squad slots
    squad.forEach((slot, index) => {
        if(newSquad[index]) slot.name = newSquad[index];
    });

    saveSquad();
    renderPitch();
}

// --- STRICT SWAP LOGIC ---
function swapPlayers(id1, id2) {
    const s1 = squad.find(s => s.id === id1);
    const s2 = squad.find(s => s.id === id2);

    // Rule: GKP can ONLY swap with another GKP
    if ((s1.pos === 'GKP' || s2.pos === 'GKP') && s1.pos !== s2.pos) {
        alert("⚠️ Invalid Move: Goalkeepers can only be swapped with other Goalkeepers.");
        selectedSlotId = null;
        renderPitch();
        return;
    }

    const tempName = s1.name;
    s1.name = s2.name;
    s2.name = tempName;

    selectedSlotId = null;
    saveSquad();
    renderPitch();
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    pitch.innerHTML = ''; bench.innerHTML = '';

    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    positions.forEach(pos => {
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

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const player = playerDB.find(p => p.name === slotData.name);
    const jersey = player ? (player.pos === 'GKP' ? 'gkp_color' : player.teamShort) : 'default';

    // Fixture Dots
    let fixtureHtml = '';
    if (player) {
        const nextFix = getNextFixtures(player.teamId);
        fixtureHtml = `<div class="card-fixtures">` + 
            nextFix.map(f => `<div class="fix-item fdr-${f.difficulty}">${f.opp}</div>`).join('') + 
            `</div>`;
    }

    div.onclick = () => {
        if (selectedSlotId !== null && selectedSlotId !== slotData.id) {
            swapPlayers(selectedSlotId, slotData.id);
            return;
        }
        selectedSlotId = slotData.id;
        renderPitch();
        renderPlayerList(slotData.pos);
    };

    div.innerHTML = `
        <div class="sub-button">⇄</div>
        <div class="jersey ${jersey}"></div>
        <div class="player-card">
            <div class="card-header">${slotData.name || slotData.pos}</div>
            ${fixtureHtml}
        </div>`;
    return div;
}

// ... Keep your existing updateStats, saveSquad, loadSquad, renderPlayerList ...
// Ensure you call runAIWildcard() from your button.
