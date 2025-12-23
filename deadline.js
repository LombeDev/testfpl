/**
 * KOPALA FPL - Price Changes & Countdown Logic
 */

const API_BASE = "/fpl-api/"; 
let teamMap = {};

async function init() {
    const loader = document.getElementById("loading-overlay");
    
    try {
        // 1. Check Cache for Bootstrap Data (Expires in 10 mins)
        const cacheKey = "fpl_bootstrap_cache";
        const cached = localStorage.getItem(cacheKey);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                data = parsed.content;
            }
        }

        // 2. Fetch if no cache
        if (!data) {
            const response = await fetch(`${API_BASE}bootstrap-static/`);
            data = await response.json();
            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }

        // 3. Build Team Map
        data.teams.forEach(t => teamMap[t.id] = t.short_name);

        // 4. Handle UI Components
        renderDeadline(data.events);
        renderPrices(data.elements);

        if (loader) loader.style.display = 'none';

    } catch (err) {
        console.error("Initialization failed:", err);
        if (loader) loader.textContent = "Error loading data. Check your connection.";
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
    
    // Filter for players who had a price change today
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
                    <span class="team-name">${teamMap[p.team]}</span>
                </div>
                <div class="price-data">
                    <span class="price-val">£${(p.now_cost / 10).toFixed(1)}m</span><br>
                    <span class="${colorClass}" style="font-weight:bold;">${sign}${change.toFixed(1)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Kick off the script
init();
