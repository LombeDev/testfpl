/**
 * KOPALA FPL - Price Changes & Countdown Logic (v2.7)
 * Protection: Anti-Rate-Limit + Cache Fallback
 */

const API_BASE = "/fpl-api/"; 
let teamMap = {};

async function init() {
    const loader = document.getElementById("loading-overlay");
    const ticker = document.getElementById('ticker'); // Optional: if you have a status bar
    const LOCK_KEY = 'fpl_api_blocked_until';
    const CACHE_KEY = "fpl_bootstrap_cache";

    // 1. Rate Limit Guard: Check if we are currently "banned" by the server
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - Date.now()) / 60000);
        console.warn(`API is locked. Remaining: ${remainingMin}m`);
        if (ticker) ticker.innerHTML = `⚠️ <span style="color:orange">API Limit: Waiting ${remainingMin}m</span>`;
        loadFromCacheOnly(); 
        return;
    }

    try {
        // 2. Cache Logic: Check if we have fresh data (under 10 mins old)
        const cached = localStorage.getItem(CACHE_KEY);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                data = parsed.content;
                console.log("Using fresh cache.");
            }
        }

        // 3. Fetch Logic with 429 Error Handling
        if (!data) {
            const response = await fetch(`${API_BASE}bootstrap-static/`);

            if (response.status === 429) {
                const coolDownTime = Date.now() + (30 * 60 * 1000); // 30 min lock
                localStorage.setItem(LOCK_KEY, coolDownTime.toString());
                throw new Error("API Limit reached. App locked for 30m.");
            }

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            data = await response.json();
            
            // Save to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }

        // 4. Successful Execution
        processAndRender(data);
        if (loader) loader.style.display = 'none';

    } catch (err) {
        console.error("Initialization failed:", err.message);
        if (ticker) ticker.innerHTML = "📡 <span style='color:orange'>Offline Mode</span>";
        loadFromCacheOnly(); 
    }
}

/**
 * Shared Processing Logic
 */
function processAndRender(data) {
    // Build Team Map
    data.teams.forEach(t => teamMap[t.id] = t.short_name);

    // Handle UI Components
    renderDeadline(data.events);
    renderPrices(data.elements);
}

/**
 * Fallback Logic for Offline/Blocked states
 */
function loadFromCacheOnly() {
    const cached = localStorage.getItem("fpl_bootstrap_cache");
    const loader = document.getElementById("loading-overlay");
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
        if (loader) loader.style.display = 'none';
    } else {
        if (loader) loader.textContent = "Error loading data. No cache available.";
    }
}

function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    const el = document.getElementById("countdown-timer");
    const card = document.getElementById("deadline-card");
    if (card) card.style.display = 'block';

    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const now = new Date().getTime();
        const diff = deadline - now;

        if (diff <= 0) {
            if (el) el.innerHTML = "Deadline Passed";
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (el) {
            el.innerHTML = `
                <div class="timer-grid">
                    <div>${d}<span class="timer-unit">DAYS</span></div>
                    <div>${h}<span class="timer-unit">HRS</span></div>
                    <div>${m}<span class="timer-unit">MIN</span></div>
                    <div>${s}<span class="timer-unit">SEC</span></div>
                </div>
                <div style="margin-top:10px; font-size:12px; font-weight:600; color: #37003c;">Gameweek ${nextGW.id}</div>
            `;
        }
    };

    update();
    setInterval(update, 1000);
}

function renderPrices(players) {
    const list = document.getElementById("price-changes-list");
    const card = document.getElementById("price-card");
    if (!list || !card) return;
    
    const risersFallers = players
        .filter(p => p.cost_change_event !== 0)
        .sort((a, b) => b.cost_change_event - a.cost_change_event);

    if (risersFallers.length === 0) {
        list.innerHTML = `<p style="text-align:center; padding: 20px; color: #666;">No price changes in the last 24 hours.</p>`;
        card.style.display = 'block';
        return;
    }

    card.style.display = 'block';

    list.innerHTML = risersFallers.map(p => {
        const change = p.cost_change_event / 10;
        const colorClass = change > 0 ? 'change-up' : 'change-down';
        const sign = change > 0 ? '+' : '';

        return `
            <div class="price-row">
                <div class="player-info">
                    <span class="player-name">${p.web_name}</span>
                    <span class="team-name">${teamMap[p.team] || '---'}</span>
                </div>
                <div class="price-data">
                    <span class="price-val">£${(p.now_cost / 10).toFixed(1)}m</span><br>
                    <span class="${colorClass}" style="font-weight:bold;">${sign}${change.toFixed(1)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Start
init();
