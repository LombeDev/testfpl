/**
 * KOPALA FPL - Ultimate Home Dashboard (v4.0 + Alerts)
 * Combined Features: Timer, Notification Sync, Vertical Price Scroll, Live King, & Scout
 */

const API_BASE = "/fpl-api/"; 
let teamMap = {};

async function init() {
    const loader = document.getElementById("loading-overlay");
    const CACHE_KEY = "fpl_bootstrap_cache";
    const LOCK_KEY = 'fpl_api_blocked_until';

    // Restore Toggle State (Material Switch)
    const notifyEnabled = localStorage.getItem('kopala_notifications') === 'true';
    const toggle = document.getElementById('notify-toggle');
    if (toggle) toggle.checked = notifyEnabled;

    // 1. Rate Limit Guard
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        loadFromCacheOnly(); 
        return;
    }

    try {
        // 2. Cache Logic (10-minute window)
        const cached = localStorage.getItem(CACHE_KEY);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                data = parsed.content;
            }
        }

        // 3. Fetch Data
        if (!data) {
            const response = await fetch(`${API_BASE}bootstrap-static/`);

            if (response.status === 429) {
                const coolDownTime = Date.now() + (30 * 60 * 1000); 
                localStorage.setItem(LOCK_KEY, coolDownTime.toString());
                throw new Error("429");
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

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

function processAndRender(data) {
    data.teams.forEach(t => teamMap[t.id] = t.short_name);
    renderDeadline(data.events);
    renderPrices(data.elements);
    renderLiveKing(data.elements);
    renderScout(data.elements);
}

function loadFromCacheOnly() {
    const cached = localStorage.getItem("fpl_bootstrap_cache");
    const loader = document.getElementById("loading-overlay");
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
        if (loader) loader.style.display = 'none';
    }
}

/**
 * 1. COUNTDOWN TIMER & NOTIFICATION SYNC
 */
function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    // Sync Background Notification if Enabled
    if (localStorage.getItem('kopala_notifications') === 'true') {
        syncDeadlineWithServiceWorker(nextGW.deadline_time, nextGW.id);
    }

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

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (el) {
            el.innerHTML = `
                <div class="timer-grid">
                    <div>${d}<span class="timer-unit">DAYS</span></div>
                    <div>${h}<span class="timer-unit">HRS</span></div>
                    <div>${m}<span class="timer-unit">MIN</span></div>
                    <div>${s}<span class="timer-unit">SEC</span></div>
                </div>
                <div style="margin-top:10px; font-size:12px; font-weight:800; color: #37003c;">GW ${nextGW.id} DEADLINE</div>
            `;
        }
    };

    update();
    setInterval(update, 1000);
}

/**
 * NOTIFICATION PERMISSION & TOGGLE LOGIC
 */
async function handleNotificationToggle(isEnabled) {
    if (isEnabled) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('kopala_notifications', 'true');
            // Re-run init to trigger the first sync
            init();
        } else {
            alert("Please allow notifications in browser settings.");
            document.getElementById('notify-toggle').checked = false;
            localStorage.setItem('kopala_notifications', 'false');
        }
    } else {
        localStorage.setItem('kopala_notifications', 'false');
    }
}

function syncDeadlineWithServiceWorker(deadlineString, gwId) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            if (registration.active) {
                registration.active.postMessage({
                    type: 'SCHEDULE_DEADLINE',
                    deadline: deadlineString,
                    gw: gwId
                });
            }
        });
    }
}

/**
 * 2. VERTICAL PRICE SCROLL
 */
function renderPrices(players) {
    const risersList = document.getElementById("risers-list");
    const fallersList = document.getElementById("fallers-list");
    const card = document.getElementById("price-card");

    if (!risersList || !fallersList || !card) return;

    const risers = players.filter(p => p.cost_change_event > 0).sort((a,b) => b.cost_change_event - a.cost_change_event);
    const fallers = players.filter(p => p.cost_change_event < 0).sort((a,b) => a.cost_change_event - b.cost_change_event);

    const createRow = (p) => {
        const change = p.cost_change_event / 10;
        const colorClass = change > 0 ? 'change-up' : 'change-down';

        return `
            <div class="price-row-mini">
                <div class="player-info">
                    <span class="mini-name" style="font-weight:700; display:block;">${p.web_name}</span>
                    <span class="mini-team" style="font-size:11px; color:#666;">${teamMap[p.team] || ''}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; font-size:14px;">£${(p.now_cost / 10).toFixed(1)}</div>
                    <div class="${colorClass}" style="font-size:11px; font-weight:bold;">
                        ${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}
                    </div>
                </div>
            </div>
        `;
    };

    risersList.innerHTML = risers.length > 0 ? risers.map(createRow).join('') : '<p style="padding:10px; font-size:11px; color:#999;">No risers today</p>';
    fallersList.innerHTML = fallers.length > 0 ? fallers.map(createRow).join('') : '<p style="padding:10px; font-size:11px; color:#999;">No fallers today</p>';
    card.style.display = 'block';
}

/**
 * 3. LIVE KING
 */
function renderLiveKing(players) {
    const container = document.getElementById("live-king-content");
    const card = document.getElementById("live-king-card");
    if (!container || !card) return;

    const king = players.reduce((prev, current) => (prev.event_points > current.event_points) ? prev : current);
    if (king.event_points <= 0) { card.style.display = 'none'; return; }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div>
                <div style="font-size: 1.1rem; font-weight: 900; color: #0f172a; line-height: 1;">${king.web_name}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">${teamMap[king.team]} | ${king.selected_by_percent}% Owned</div>
            </div>
            <div style="text-align: center; background: white; padding: 5px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div style="font-size: 1.6rem; font-weight: 900; color: #249771; line-height: 1;">${king.event_points}</div>
                <div style="font-size: 0.6rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Points</div>
            </div>
        </div>
    `;
    card.style.display = 'block';
}

/**
 * 4. THE SCOUT
 */
function renderScout(players) {
    const container = document.getElementById("scout-list");
    const card = document.getElementById("scout-card");
    if (!container || !card) return;

    const bestValue = players.filter(p => parseFloat(p.value_form) > 0)
        .sort((a, b) => parseFloat(b.value_form) - parseFloat(a.value_form)).slice(0, 3);

    if (bestValue.length === 0) { card.style.display = 'none'; return; }

    container.innerHTML = bestValue.map(p => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #f0fdf4; border-radius: 8px; margin-bottom: 8px; border: 1px solid #dcfce7;">
            <div>
                <div style="font-weight: 800; color: #166534; font-size: 13px;">${p.web_name}</div>
                <div style="font-size: 11px; color: #15803d;">${teamMap[p.team]} | £${(p.now_cost/10).toFixed(1)}m</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase;">Value Form</div>
                <div style="font-size: 16px; font-weight: 900; color: #166534;">${p.value_form}</div>
            </div>
        </div>
    `).join('');
    card.style.display = 'block';
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registered"));
}

document.addEventListener('DOMContentLoaded', init);
