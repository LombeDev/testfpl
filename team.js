/**
 * KOPALA FPL - AI Master Engine (v4.4.0)
 * FIXED: Mobile CORS Bypass & 4-Hour Smart Cache
 */

const PROXY = "https://corsproxy.io/?";
const API_BASE = "https://fantasy.premierleague.com/api/"; 
const CACHE_TIME = 4 * 60 * 60 * 1000; // 4 Hours in milliseconds

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

async function syncData() {
    const ticker = document.getElementById('ticker');
    const cachedData = localStorage.getItem('fpl_data_cache');
    const cacheTimestamp = localStorage.getItem('fpl_cache_time');

    // 1. Check if we have fresh data in the cache (Mobile fix)
    if (cachedData && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TIME)) {
        console.log("🚀 Loading from Cache");
        processData(JSON.parse(cachedData));
        ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Online (Cached)</span>";
        renderPitch();
        return;
    }

    // 2. If no cache or cache expired, fetch from API
    ticker.innerHTML = "⏳ Refreshing Live Data...";
    try {
        const res = await fetch(`${PROXY}${API_BASE}bootstrap-static/`);
        if (!res.ok) throw new Error("Proxy Error");
        const data = await res.json();

        // Save to cache for next time
        localStorage.setItem('fpl_data_cache', JSON.stringify(data));
        localStorage.setItem('fpl_cache_time', Date.now());

        processData(data);
        ticker.innerHTML = "✅ <span style='color:#00ff87'>AI Engine Online</span>";
        renderPitch();
    } catch (e) {
        console.error("Fetch failed:", e);
        if (cachedData) {
            ticker.innerHTML = "⚠️ <span style='color:orange'>Using Old Data (Offline)</span>";
            processData(JSON.parse(cachedData));
            renderPitch();
        } else {
            ticker.innerHTML = "❌ <span style='color:#ff4444'>Connection Error</span>";
        }
    }
}

function processData(data) {
    // Map Teams
    data.teams.forEach(t => { 
        teamsDB[t.id] = { name: t.name.toLowerCase().replace(/\s+/g, '_'), short: t.short_name }; 
    });
    
    // Map Players
    playerDB = data.elements.map(p => ({
        name: p.web_name,
        teamShort: teamsDB[p.team]?.name || 'default',
        teamCode: teamsDB[p.team]?.short || 'N/A',
        pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
        price: (p.now_cost / 10).toFixed(1),
        xp: parseFloat(p.ep_next) || 0
    })).sort((a,b) => b.xp - a.xp);
}

// --- UI Logic ---
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
        const idx = squad.findIndex(s => s.id === slotData.id);
        const search = prompt(`Enter player name for ${slotData.pos}:`, slotData.name);
        if (search) {
            const found = playerDB.find(pl => pl.name.toLowerCase().includes(search.toLowerCase()) && pl.pos === slotData.pos);
            if (found) {
                squad[idx].name = found.name;
                localStorage.setItem('kopala_squad', JSON.stringify(squad));
                renderPitch();
            } else {
                alert("Player not found in that position!");
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
    document.getElementById('budget-val').textContent = `£${(100 - spent).toFixed(1)}m`;
    document.getElementById('v-xp').textContent = xp.toFixed(1);
}

function resetSquad() {
    if(confirm("Reset Team?")) {
        squad.forEach(s => s.name = "");
        localStorage.setItem('kopala_squad', JSON.stringify(squad));
        renderPitch();
    }
}

document.addEventListener('DOMContentLoaded', syncData);
