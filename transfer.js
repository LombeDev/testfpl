/**
 * KOPALA FPL - AI Master Engine (v2.6)
 * PROTECTION: Anti-Rate-Limit Cache + ETag Validation
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [], teamsDB = {}, fixturesDB = [];
let selectedSlotId = null;

// --- 1. SMART SYNC ENGINE ---
async function syncData() {
    const ticker = document.getElementById('ticker');
    const CACHE_KEY = 'kopala_master_data';
    const ETAG_KEY = 'kopala_fpl_etag';
    const TIMESTAMP_KEY = 'kopala_last_check';
    
    // Rate limit buffer: 10 minutes (600,000 ms)
    const REFRESH_THRESHOLD = 10 * 60 * 1000; 

    // A. Load from LocalStorage immediately (Instant UI)
    const cached = localStorage.getItem(CACHE_KEY);
    const lastCheck = localStorage.getItem(TIMESTAMP_KEY);
    const savedETag = localStorage.getItem(ETAG_KEY);

    if (cached) {
        const parsed = JSON.parse(cached);
        playerDB = parsed.players;
        fixturesDB = parsed.fixtures;
        teamsDB = parsed.teams;
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>Mode: Smart Cache</span>";
    }

    // B. Rate Limit Guard: Don't even hit the server if we checked recently
    const timeSinceLastCheck = Date.now() - (parseInt(lastCheck) || 0);
    if (cached && timeSinceLastCheck < REFRESH_THRESHOLD) {
        console.log(`Rate limit protection: Next check in ${Math.round((REFRESH_THRESHOLD - timeSinceLastCheck)/1000)}s`);
        return; 
    }

    try {
        if (ticker) ticker.textContent = "Checking for price changes...";

        // C. Conditional Fetch: Uses If-None-Match to save bandwidth/hits
        const headers = savedETag ? { 'If-None-Match': savedETag } : {};
        const bootRes = await fetch(`${API_BASE}bootstrap-static/`, { headers });

        // If status is 304, nothing changed. Just update the timestamp.
        if (bootRes.status === 304) {
            localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
            if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>Prices Verified (No Change)</span>";
            return;
        }

        if (bootRes.ok) {
            const data = await bootRes.json();
            const fixRes = await fetch(`${API_BASE}fixtures/`);
            const rawFixtures = await fixRes.json();

            // D. Process and Slugify Teams (Matches your CSS classes)
            const newTeams = {};
            data.teams.forEach(t => {
                let slug = t.name.toLowerCase().replace(/\s+/g, '_');
                if (slug.includes('man_city')) slug = 'man_city';
                if (slug.includes('man_utd')) slug = 'man_utd';
                newTeams[t.id] = slug;
            });

            const newPlayers = data.elements.map(p => ({
                id: p.id,
                name: p.web_name,
                teamId: p.team,
                teamShort: newTeams[p.team] || 'default',
                pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
                price: (p.now_cost / 10).toFixed(1),
                xp: parseFloat(p.ep_next) || 0
            })).sort((a,b) => b.xp - a.xp);

            // E. Update Master Cache
            const masterData = { players: newPlayers, teams: newTeams, fixtures: rawFixtures };
            localStorage.setItem(CACHE_KEY, JSON.stringify(masterData));
            localStorage.setItem(ETAG_KEY, bootRes.headers.get('ETag') || '');
            localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());

            playerDB = newPlayers; teamsDB = newTeams; fixturesDB = rawFixtures;
            renderPitch();
            if (ticker) ticker.innerHTML = "🔄 <span style='color:#00ff87'>Data Updated (New Prices)</span>";
        }
    } catch (e) {
        console.warn("Network error. Using cache.");
        if (ticker) ticker.innerHTML = "📡 <span style='color:orange'>Mode: Offline Cache</span>";
    }
}

// --- 2. UI LOGIC (JERSEY COLORS) ---
function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    
    const player = playerDB.find(p => p.name === slotData.name);
    
    // Jersey logic: Use teamShort slug if player exists, else default
    let jerseyClass = 'default';
    if (player) {
        jerseyClass = (player.pos === 'GKP') ? 'gkp_color' : player.teamShort;
    }

    const fixtures = player ? getNextFixtures(player.teamId) : [];

    div.innerHTML = `
        <div class="jersey ${jerseyClass}" onclick="handleSwap(${slotData.id})"></div>
        <div class="player-card">
            <div class="card-header">
                <span class="p-name">${slotData.name || slotData.pos}</span>
                <span class="p-price">${player ? player.price + 'm' : ''}</span>
            </div>
            <div class="card-fixtures">
                ${fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}<br>${f.loc}</div>`).join('')}
            </div>
        </div>
        <select class="hidden-picker" onchange="updatePlayer(${slotData.id}, this.value)">
            <option value="">-- Pick --</option>
            ${playerDB.filter(p => p.pos === slotData.pos).map(p => `<option value="${p.name}" ${slotData.name === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
    `;
    return div;
}

// ... rest of the helper functions (renderPitch, handleSwap, getNextFixtures) remain the same as the previous version ...
