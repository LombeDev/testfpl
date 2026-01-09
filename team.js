/**
 * KOPALA FPL - MASTER ENGINE (v5.0.0)
 * FULL PRODUCTION SOURCE - SMART OPTIMIZER & FDR INTEGRATION
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;
const STORAGE_KEY = 'kopala_v5_pro';

// Squad state
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

// --- 1. FDR & FIXTURE LOGIC ---

/**
 * Assigns a difficulty color based on opponent strength
 * Green = Easy, Orange = Tough, Pink = Elite
 */
function getFDRColor(teamId) {
    const elite = [1, 13, 14, 18]; // MCI, LIV, ARS, CHE (Example IDs)
    const tough = [17, 19, 6, 2, 15]; // TOT, MUN, NEW, AVL, MUN
    
    if (elite.includes(teamId)) return '#ff005a'; // Hard
    if (tough.includes(teamId)) return '#ff9f43'; // Moderate
    return '#00ff87'; // Easy
}

function getNextFixture(teamId) {
    if (!fixturesDB || fixturesDB.length === 0) return { text: "TBC", color: "#666" };
    
    const next = fixturesDB.find(f => 
        !f.finished && (f.team_h === teamId || f.team_a === teamId)
    );
    
    if (!next) return { text: "DONE", color: "#666" };

    const isHome = next.team_h === teamId;
    const opponentId = isHome ? next.team_a : next.team_h;
    const opponentName = teamsDB[opponentId] || "???";
    
    const shortName = opponentName.substring(0, 3).toUpperCase();
    const venue = isHome ? 'H' : 'A';
    
    return {
        text: `${shortName} (${venue})`,
        color: getFDRColor(opponentId)
    };
}

// --- 2. CORE ANALYTICS (FFH STYLE) ---

function calculateStats() {
    let squadValue = 0, starterXP = 0, maxXP = 0, captainName = "";
    let formation = { 'DEF': 0, 'MID': 0, 'FWD': 0 };

    squad.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p) {
            const price = parseFloat(p.price);
            squadValue += price;

            if (!slot.isBench) {
                const xp = parseFloat(p.xp) || 0;
                starterXP += xp;
                
                // Smart Captaincy: Identify highest predicted points
                if (xp > maxXP) {
                    maxXP = xp;
                    captainName = p.name;
                }
                if (formation.hasOwnProperty(slot.pos)) formation[slot.pos]++;
            }
        }
    });

    window.currentCaptain = captainName;

    // UI: Predicted Points
    const totalXPValue = (starterXP + maxXP).toFixed(1);
    const xpEl = document.getElementById('v-xp');
    if (xpEl) {
        xpEl.textContent = totalXPValue;
        xpEl.style.color = '#ff005a';
    }

    // UI: AI Rating (Based on 70pt Elite Benchark)
    const ratingEl = document.getElementById('team-rating');
    if (ratingEl) {
        const score = parseFloat(totalXPValue);
        const rating = score > 0 ? Math.min(100, Math.round((score / 70) * 100)) : 0;
        ratingEl.textContent = `${rating}%`;
        ratingEl.style.color = rating > 85 ? '#00ff87' : (rating > 60 ? '#f1c40f' : '#ff005a');
    }

    // UI: Team Value & Bank
    const itb = (100.0 - squadValue).toFixed(1);
    const budgetEl = document.getElementById('budget-val');
    const tvEl = document.getElementById('team-value');

    if (budgetEl) {
        budgetEl.textContent = `£${itb}m`;
        budgetEl.style.color = (itb < 0) ? '#ff005a' : '#2d3436';
    }
    if (tvEl) tvEl.textContent = `£${squadValue.toFixed(1)}m`;

    // UI: Formation
    const formEl = document.getElementById('formation-label');
    if (formEl) formEl.textContent = `${formation.DEF}-${formation.MID}-${formation.FWD}`;

    // Trigger AI Transfer Optimization
    suggestTransfer();
}

// --- 3. SMART TRANSFER OPTIMIZER ---

function suggestTransfer() {
    const suggestionEl = document.getElementById('ai-suggestion');
    if (!suggestionEl) return;

    const starters = squad.filter(s => !s.isBench && s.name !== '');
    if (starters.length === 0) {
        suggestionEl.innerHTML = "<small style='color:#999'>Add players to see AI tips</small>";
        return;
    }

    // Find the starter with the lowest XP contribution
    let weakest = null;
    let minXP = Infinity;
    starters.forEach(slot => {
        const p = playerDB.find(x => x.name === slot.name);
        if (p && p.xp < minXP) {
            minXP = p.xp;
            weakest = p;
        }
    });

    const itb = 100.0 - squad.reduce((acc, s) => {
        const p = playerDB.find(x => x.name === s.name);
        return acc + (p ? parseFloat(p.price) : 0);
    }, 0);

    const maxBudget = parseFloat(weakest.price) + itb;
    const currentSquadNames = squad.map(s => s.name);

    // Find affordable upgrade
    const upgrade = playerDB.filter(p => 
        p.pos === weakest.pos && 
        parseFloat(p.price) <= maxBudget &&
        !currentSquadNames.includes(p.name) &&
        p.xp > weakest.xp
    ).sort((a,b) => b.xp - a.xp)[0];

    if (upgrade) {
        suggestionEl.innerHTML = `
            <div style="background: #fff; border: 1px solid #eee; border-left: 4px solid #ff005a; padding: 12px; border-radius: 8px; font-family: sans-serif;">
                <span style="font-size: 11px; font-weight: 800; color: #888;">AI OPTIMIZER</span>
                <div style="margin-top: 5px; font-size: 13px; color: #37003c;">
                    Swap <b>${weakest.name}</b> for <b>${upgrade.name}</b> 
                    <span style="color: #00ff87; font-weight: bold;">(+${(upgrade.xp - weakest.xp).toFixed(1)} pts)</span>
                </div>
            </div>`;
    } else {
        suggestionEl.innerHTML = "<small style='color:#999'>Squad is currently point-optimized.</small>";
    }
}

// --- 4. SYNC & SYSTEM DATA ---

async function syncData() {
    try {
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        fixturesDB = await fixRes.json();

        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            teamsDB[t.id] = slug;
        });

        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamSlug: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0
        }));

        loadSquad();
        renderPitch();
    } catch (e) { console.error("Sync Error: ", e); }
}

// --- 5. UI RENDERING ---

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(posType => {
        const playersInPos = squad.filter(s => !s.isBench && s.pos === posType);
        if (playersInPos.length > 0) {
            const row = document.createElement('div');
            row.className = 'row';
            playersInPos.forEach(slot => row.appendChild(createSlotUI(slot)));
            pitch.appendChild(row);
        }
    });

    const bRow = document.createElement('div');
    bRow.className = 'row bench-row';
    squad.filter(s => s.isBench).forEach(slot => {
        bRow.appendChild(createSlotUI(slot));
    });
    bench.appendChild(bRow);
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = 'slot';
    div.id = `slot-${slotData.id}`;
    
    const p = playerDB.find(p => p.name === slotData.name);
    const isCaptain = p && p.name === window.currentCaptain && !slotData.isBench;
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_jersey' : p.teamSlug) : 'default';
    
    // Fixture with FDR Color
    let fixtureHTML = "";
    if (p) {
        const fix = getNextFixture(p.teamId);
        fixtureHTML = `<div class="fdr-label" style="background:${fix.color}">${fix.text}</div>`;
    }

    div.innerHTML = `
        <div class="player-card-wrapper ${selectedSlotId === slotData.id ? 'swap-target' : ''}">
            <div class="card-visual-area">
                ${p ? `<div class="price-tag">£${p.price}</div>` : ''}
                <div class="jersey ${jerseyClass}">
                    ${isCaptain ? '<div class="captain-badge">C</div>' : ''}
                </div>
                <button class="sub-btn" onclick="event.stopPropagation(); startSubstitution(${slotData.id})">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
            <div class="p-name-box">
                <div class="p-web-name">${slotData.name || slotData.pos}</div>
                ${fixtureHTML}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Select --</option>
            ${playerDB.filter(x => x.pos === slotData.pos).sort((a,b) => b.ownership - a.ownership).slice(0, 30)
                .map(x => `<option value="${x.name}" ${slotData.name === x.name ? 'selected' : ''}>${x.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// --- 6. USER INTERACTIONS ---

async function startSubstitution(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
        renderPitch(); 
    } else {
        const id1 = selectedSlotId;
        const id2 = id;
        selectedSlotId = null;

        const s1 = squad.find(s => s.id === id1);
        const s2 = squad.find(s => s.id === id2);

        if (id1 === id2) { renderPitch(); return; }
        if ((s1.pos === 'GKP' || s2.pos === 'GKP') && s1.pos !== s2.pos) {
            alert("Goalkeepers only swap with Goalkeepers.");
            renderPitch(); return;
        }

        const tempName = s1.name;
        const tempPos = s1.pos;
        s1.name = s2.name; s1.pos = s2.pos;
        s2.name = tempName; s2.pos = tempPos;

        if (!validateFormation()) {
            alert("Invalid Formation! (Min 3 DEF, 2 MID, 1 FWD)");
            s2.name = s1.name; s2.pos = s1.pos;
            s1.name = tempName; s1.pos = tempPos;
        }

        saveSquad();
        renderPitch();
    }
}

function validateFormation() {
    const starters = squad.filter(s => !s.isBench);
    const counts = { 'GKP': 0, 'DEF': 0, 'MID': 0, 'FWD': 0 };
    starters.forEach(s => counts[s.pos]++);
    return (counts['GKP'] === 1 && counts['DEF'] >= 3 && counts['MID'] >= 2 && counts['FWD'] >= 1);
}

function updatePlayer(id, name) {
    const s = squad.find(slot => slot.id === id);
    if (s) { s.name = name; saveSquad(); renderPitch(); }
}

function saveSquad() { localStorage.setItem(STORAGE_KEY, JSON.stringify(squad)); }
function loadSquad() { 
    const s = localStorage.getItem(STORAGE_KEY); 
    if(s) squad = JSON.parse(s); 
}

function resetTeam() {
    if (confirm("Reset Squad?")) {
        squad.forEach(slot => { slot.name = ''; });
        saveSquad(); renderPitch();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    syncData();
});
