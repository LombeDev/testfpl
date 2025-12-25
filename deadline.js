const API_BASE = "/fpl-api/"; 
let teamMap = {};

async function init() {
    const loader = document.getElementById("loading-overlay");
    const CACHE_KEY = "fpl_bootstrap_cache";

    // Set toggle switch state
    const notifyEnabled = localStorage.getItem('kopala_notifications') === 'true';
    if (document.getElementById('notify-toggle')) {
        document.getElementById('notify-toggle').checked = notifyEnabled;
    }

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) data = parsed.content;
        }

        if (!data) {
            const response = await fetch(`${API_BASE}bootstrap-static/`);
            data = await response.json();
            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), content: data }));
        }

        processAndRender(data);
        if (loader) loader.style.display = 'none';
    } catch (err) {
        console.error("Init failed:", err);
    }
}

function processAndRender(data) {
    data.teams.forEach(t => teamMap[t.id] = t.short_name);
    renderDeadline(data.events);
    renderPrices(data.elements);
    renderLiveKing(data.elements);
}

function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    // Sync notification if toggle is ON
    if (localStorage.getItem('kopala_notifications') === 'true') {
        syncDeadlineWithServiceWorker(nextGW.deadline_time, nextGW.id);
    }

    const card = document.getElementById("deadline-card");
    if (card) card.style.display = 'block';
    
    const label = document.getElementById("gw-label");
    if (label) label.innerText = `GW ${nextGW.id} DEADLINE`;

    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const now = Date.now();
        const diff = deadline - now;

        if (diff <= 0) {
            document.getElementById("countdown-timer").innerHTML = "Deadline Passed";
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (document.getElementById("days")) document.getElementById("days").innerText = d.toString().padStart(2, '0');
        if (document.getElementById("hours")) document.getElementById("hours").innerText = h.toString().padStart(2, '0');
        if (document.getElementById("mins")) document.getElementById("mins").innerText = m.toString().padStart(2, '0');
        if (document.getElementById("secs")) document.getElementById("secs").innerText = s.toString().padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
}

async function handleNotificationToggle(isEnabled) {
    if (isEnabled) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('kopala_notifications', 'true');
            init(); // Refresh to sync
        } else {
            alert("Permission denied.");
            document.getElementById('notify-toggle').checked = false;
        }
    } else {
        localStorage.setItem('kopala_notifications', 'false');
    }
}

function syncDeadlineWithServiceWorker(deadlineTime, gwId) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            if (reg.active) {
                reg.active.postMessage({ type: 'SCHEDULE_DEADLINE', deadline: deadlineTime, gw: gwId });
            }
        });
    }
}

function testDeadlineNotification() {
    if (localStorage.getItem('kopala_notifications') !== 'true') {
        alert("Enable Alerts first!");
        return;
    }
    const testTime = new Date(Date.now() + (2 * 60 * 60 * 1000) + 10000).toISOString();
    syncDeadlineWithServiceWorker(testTime, "TEST");
    alert("Test set! Lock your screen now. Alert in 10s.");
}

function renderPrices(players) {
    const risersList = document.getElementById("risers-list");
    const card = document.getElementById("price-card");
    if (!risersList || !card) return;
    const risers = players.filter(p => p.cost_change_event > 0);
    risersList.innerHTML = risers.map(p => `<div style="padding:5px; border-bottom:1px solid #eee;">${p.web_name} +£${p.cost_change_event/10}</div>`).join('');
    card.style.display = 'block';
}

function renderLiveKing(players) {
    const container = document.getElementById("live-king-content");
    const card = document.getElementById("live-king-card");
    if (!container || !card) return;
    const king = players.reduce((prev, current) => (prev.event_points > current.event_points) ? prev : current);
    container.innerHTML = `<div style="padding:10px; font-weight:900;">${king.web_name} (${king.event_points} pts)</div>`;
    card.style.display = 'block';
}

// Register SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Active"));
}

document.addEventListener('DOMContentLoaded', init);
