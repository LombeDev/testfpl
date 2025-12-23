/**
 * KOPALA FPL - Smart Sync Engine
 * Handles: 429 Blocking, 10min Cache, and UI Updates
 */

const API_BASE = "/fpl-api/"; // Ensure your proxy/server is mapped here
let teamMap = {};

async function syncData() {
    const ticker = document.getElementById('ticker');
    const loader = document.getElementById("loading-overlay");
    const LOCK_KEY = 'fpl_api_blocked_until';
    const CACHE_KEY = 'fpl_bootstrap_cache';
    
    // 1. HARD BLOCK CHECK: If we hit a 429 recently, don't even try to fetch
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - Date.now()) / 60000);
        if (ticker) ticker.innerHTML = `⚠️ <span style="color:#ff4d4d">API Locked: Try in ${remainingMin}m</span>`;
        loadFromCacheOnly(); // Silently keep the app running with old data
        return;
    }

    // 2. SOFT CACHE CHECK: Don't fetch if data is less than 10 mins old
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        if (age < 10 * 60 * 1000) {
            console.log("Data is fresh. Using cache.");
            processFPLData(parsed.content);
            if (ticker) ticker.innerHTML = "✅ <span style='color:#00ff87'>Mode: Smart Cache</span>";
            return;
        }
    }

    try {
        if (ticker) ticker.textContent = "Checking for price changes...";
        
        const response = await fetch(`${API_BASE}bootstrap-static/`);

        // 3. HANDLE RATE LIMITS (429)
        if (response.status === 429) {
            const coolDownTime = Date.now() + (30 * 60 * 1000); // 30 min ban
            localStorage.setItem(LOCK_KEY, coolDownTime.toString());
            throw new Error("Rate limit reached. App locked for 30m.");
        }

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();

        // 4. SAVE SUCCESSFUL FETCH
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            content: data
        }));

        processFPLData(data);
        if (ticker) ticker.innerHTML = "🔄 <span style='color:#00ff87'>Data Updated</span>";
        if (loader) loader.style.display = 'none';

    } catch (err) {
        console.error("Sync failed:", err.message);
        if (ticker) ticker.innerHTML = `📡 <span style="color:orange">Offline Mode</span>`;
        loadFromCacheOnly(); 
    }
}

/** * Helper: Processes the raw FPL JSON into your app's variables 
 */
function processFPLData(data) {
    // Build the team name map (e.g., 1 -> "ARS")
    data.teams.forEach(t => teamMap[t.id] = t.short_name);
    
    // Call your specific UI renderers
    if (typeof renderDeadline === "function") renderDeadline(data.events);
    if (typeof renderPrices === "function") renderPrices(data.elements);
}

/** * Helper: Fallback to use whatever is in LocalStorage 
 */
function loadFromCacheOnly() {
    const cached = localStorage.getItem('fpl_bootstrap_cache');
    if (cached) {
        const parsed = JSON.parse(cached);
        processFPLData(parsed.content);
        const loader = document.getElementById("loading-overlay");
        if (loader) loader.style.display = 'none';
    }
}

// Initial Kick-off
syncData();
