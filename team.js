/**
 * KOPALA FPL - AI Master Engine (v4.5.0)
 * FIX: Mobile Connection Error & Proxy Failover
 */

// List of public proxies to try if the primary fails
const PROXY_LIST = [
    "https://corsproxy.io/?",
    "https://api.allorigins.win/raw?url=",
    "https://thingproxy.freeboard.io/fetch/"
];

const API_BASE = "https://fantasy.premierleague.com/api/bootstrap-static/"; 
const CACHE_KEY = 'kopala_fpl_cache';
const CACHE_TIME = 6 * 60 * 60 * 1000; // 6 Hours

let playerDB = [];
let teamsDB = {};
let squad = JSON.parse(localStorage.getItem('kopala_squad')) || [
    { id: 0, pos: 'GKP', name: '', isBench: false }, { id: 1, pos: 'DEF', name: '', isBench: false },
    { id: 2, pos: 'DEF', name: '', isBench: false }, { id: 3, pos: 'DEF', name: '', isBench: false },
    { id: 4, pos: 'DEF', name: '', isBench: false }, { id: 5, pos: 'MID', name: '', isBench: false },
    { id: 6, pos: 'MID', name: '', isBench: false }, { id: 7, pos: 'MID', name: '', isBench: false },
    { id: 8, pos: 'MID', name: '', isBench: false }, { id: 9, pos: 'FWD', name: '', isBench: false },
    { id: 10, pos: 'FWD', name: '', isBench: false }, { id: 11, pos: 'GKP', name: '', isBench: true },
    { id: 12, pos: 'DEF', name: '', isBench: true }, { id: 13, pos: 'MID', name: '', isBench: true },
    { id: 14, pos: 'FWD', name: '', isBench: true }
];

// --- SMART SYNC WITH FAILOVER ---
async function syncData(force = false) {
    const ticker = document.getElementById('ticker');
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));

    // 1. Use Cache if available and fresh (Best for Mobile)
    if (!force && cached && (Date.now() - cached.timestamp < CACHE_TIME)) {
        console.log("📦 Using Cached Data");
        processData(cached.data);
        ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Online (Cached)</span>";
        renderPitch();
        return;
    }

    // 2. Try Proxies one by one
    ticker.innerHTML = "📡 Connecting to FPL...";
    for (let proxy of PROXY_LIST) {
        try {
            const response = await fetch(`${proxy}${encodeURIComponent(API_BASE)}`);
            if (!response.ok) throw new Error("Proxy failed");
            
            const data = await response.json();
            
            // Save to Cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));

            processData(data);
            ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Engine Online</span>";
            renderPitch();
            return; // Success! Exit loop.
        } catch (err) {
            console.warn(`Proxy ${proxy} failed, trying next...`);
        }
    }

    // 3. Last Resort: Use old cache even if expired
    if (cached) {
        processData(cached.data);
        ticker.innerHTML = "⚠️ <span style='color:orange'>Server busy, using last known data</span>";
        renderPitch();
    } else {
        ticker.innerHTML = "❌ <span style='color:#ff4444'>Connection Error. Tap to retry.</span>";
        ticker.onclick = () => syncData(true);
    }
}

function processData(data) {
    data.teams.forEach(t => { 
        teamsDB[t.id] = { name: t.name.toLowerCase().replace(/\s+/g, '_'), short: t.short_name }; 
    });
    
    playerDB = data.elements.map(p => ({
        name: p.web_name,
        teamShort: teamsDB[p.team]?.name || 'default',
        teamCode: teamsDB[p.team]?.short || 'N/A',
        pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
        price: (p.now_cost / 10).toFixed(1),
        xp: parseFloat(p.ep_next) || 0
    })).sort((a,b) => b.xp - a.xp);
}

// --- UI Logic (Pitch & Stats) ---
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

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot`;
    const p = playerDB.find(x => x.name === slotData.name);
    const jerseyClass = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';

    div.innerHTML = `
        <div class="jersey ${jerseyClass}"></div>
        <div class="player-card">
            <div class="card-header">${slotData.name || slotData.pos}</div>
            ${p ? `<div class="xp-badge">${p.xp} XP</div>` : ''}
        </div>`;

    div.onclick = () => {
        const search = prompt(`Search ${slotData.pos} (e.g., Salah):`, slotData.name);
        if (search !== null) {
            const found = playerDB.find(pl => 
                pl.name.toLowerCase().includes(search.toLowerCase()) && 
                pl.pos === slotData.pos
            );
            if (found) {
                const idx = squad.findIndex(s => s.id === slotData.id);
                squad[idx].name = found.name;
                localStorage.setItem('kopala_squad', JSON.stringify(squad));
                renderPitch();
            } else if (search !== "") {
                alert("Player not found in this position!");
            }
        }
    };
    return div;
}

function updateStats() {
    let xp = 0, spent = 0;
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            spent += parseFloat(p.price);
            if (!s.isBench) xp += p.xp;
        }
    });
    const budgetEl = document.getElementById('budget-val');
    const xpEl = document.getElementById('v-xp');
    if(budgetEl) budgetEl.textContent = `£${(100 - spent).toFixed(1)}m`;
    if(xpEl) xpEl.textContent = xp.toFixed(1);
}

// Reset Function
window.resetSquad = function() {
    if(confirm("Are you sure you want to clear your team?")) {
        squad.forEach(s => s.name = "");
        localStorage.setItem('kopala_squad', JSON.stringify(squad));
        renderPitch();
    }
};

document.addEventListener('DOMContentLoaded', () => syncData());
