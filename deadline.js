/**
 * KOPALA FPL - Price Changes & Countdown Logic (v3.0)
 * Optimized for Horizontal Scroll & Mobile Performance
 */

const API_BASE = "/fpl-api/"; 
let teamMap = {};

async function init() {
    const loader = document.getElementById("loading-overlay");
    const LOCK_KEY = 'fpl_api_blocked_until';
    const CACHE_KEY = "fpl_bootstrap_cache";

    // 1. Rate Limit Guard
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - Date.now()) / 60000);
        console.warn(`API locked. Waiting ${remainingMin}m`);
        loadFromCacheOnly(); 
        return;
    }

    try {
        // 2. Cache Logic (10-minute fresh window)
        const cached = localStorage.getItem(CACHE_KEY);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                data = parsed.content;
                console.log("Using fresh cache.");
            }
        }

        // 3. Fetch fresh data if cache is old or missing
        if (!data) {
            const response = await fetch(`${API_BASE}bootstrap-static/`);

            if (response.status === 429) {
                const coolDownTime = Date.now() + (30 * 60 * 1000); 
                localStorage.setItem(LOCK_KEY, coolDownTime.toString());
                throw new Error("API Limit reached.");
            }

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            data = await response.json();
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }

        processAndRender(data);
        if (loader) loader.style.display = 'none';

    } catch (err) {
        console.error("Init failed:", err.message);
        loadFromCacheOnly(); 
    }
}

/**
 * Shared Processing Logic
 */
function processAndRender(data) {
    // Build Team Map for short names (LIV, MCI, etc)
    data.teams.forEach(t => teamMap[t.id] = t.short_name);

    renderDeadline(data.events);
    renderPrices(data.elements);
}

/**
 * Fallback Logic
 */
function loadFromCacheOnly() {
    const cached = localStorage.getItem("fpl_bootstrap_cache");
    const loader = document.getElementById("loading-overlay");
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
        if (loader) loader.style.display = 'none';
    } else {
        if (loader) loader.textContent = "Offline: No cache found.";
    }
}

/**
 * Deadline Countdown Logic
 */
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
                <div style="margin-top:10px; font-size:12px; font-weight:800; color: #37003c;">GAMEWEEK ${nextGW.id}</div>
            `;
        }
    };

    update();
    setInterval(update, 1000);
}

/**
 * PRICE CHANGES - Scrollable Side-by-Side Logic
 */
function renderPrices(players) {
    const risersList = document.getElementById("risers-list");
    const fallersList = document.getElementById("fallers-list");
    const card = document.getElementById("price-card");

    if (!risersList || !fallersList || !card) return;

    // Filter into Risers (pos) and Fallers (neg)
    const risers = players.filter(p => p.cost_change_event > 0)
                          .sort((a, b) => b.cost_change_event - a.cost_change_event);
    
    const fallers = players.filter(p => p.cost_change_event < 0)
                           .sort((a, b) => a.cost_change_event - b.cost_change_event);

    const createMiniRow = (p) => {
        const change = p.cost_change_event / 10;
        const colorClass = change > 0 ? 'change-up' : 'change-down';
        const sign = change > 0 ? '+' : '';

        return `
            <div class="price-row-mini">
                <div class="player-info">
                    <span class="mini-name">${p.web_name}</span>
                    <span class="mini-team">${teamMap[p.team] || '---'}</span>
                </div>
                <div class="price-data" style="text-align:right">
                    <div class="mini-val">£${(p.now_cost / 10).toFixed(1)}</div>
                    <div class="${colorClass}" style="font-size:10px; font-weight:bold;">
                        ${sign}${change.toFixed(1)}
                    </div>
                </div>
            </div>
        `;
    };

    // Render Risers
    risersList.innerHTML = risers.length > 0 
        ? risers.map(createMiniRow).join('') 
        : '<p style="font-size:11px; color:#999; padding:10px;">No risers today</p>';

    // Render Fallers
    fallersList.innerHTML = fallers.length > 0 
        ? fallers.map(createMiniRow).join('') 
        : '<p style="font-size:11px; color:#999; padding:10px;">No fallers today</p>';

    // Show the section
    card.style.display = 'block';
}

// Kick off the app
document.addEventListener('DOMContentLoaded', init);
