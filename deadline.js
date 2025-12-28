/**
 * KOPALA FPL - Unified App Logic (v11)
 * Deadline Timer + Price Scroll + Push Subscription
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    teamMap: {},
    currentGW: 18,
};

async function init() {
    const loader = document.getElementById("loading-overlay");
    try {
        const response = await fetch("/fpl-api/bootstrap-static/");
        const data = await response.json();
        
        processAndRender(data);
        if (loader) loader.style.display = 'none';
        if (state.fplId) renderView('dashboard');
    } catch (err) { console.error("Init failed:", err); }
}

function processAndRender(data) {
    data.teams.forEach(t => state.teamMap[t.id] = t.short_name);
    data.elements.forEach(p => state.playerMap[p.id] = p.web_name);
    renderDeadline(data.events);
    renderPrices(data.elements);
    renderLiveKing(data.elements);
    renderScout(data.elements);
}

// --- DEADLINE & NOTIFICATIONS ---
function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    const el = document.getElementById("countdown-timer");
    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const diff = deadline - Date.now();
        if (diff <= 0) { el.innerHTML = "Deadline Passed"; return; }

        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);

        el.innerHTML = `
            <div class="timer-grid">
                <div>${h}<span class="timer-unit">HRS</span></div>
                <div>${m}<span class="timer-unit">MIN</span></div>
            </div>
            <button id="notif-btn" class="notify-btn" onclick="subscribePush()">🔔 Notify Me (2h before)</button>
        `;
    };
    update(); setInterval(update, 1000);
}

async function subscribePush() {
    const btn = document.getElementById('notif-btn');
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return showToast("Permission denied", "warning");

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array('YOUR_PUBLIC_VAPID_KEY')
        });

        // Save to Netlify Blobs via a function
        await fetch('/.netlify/functions/save-sub', {
            method: 'POST',
            body: JSON.stringify(sub)
        });

        btn.innerText = "✅ Subscribed";
        showToast("Deadline alert set!", "success");
    } catch (err) { showToast("Failed to subscribe", "warning"); }
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

// Include your existing renderPrices, renderLiveKing, and renderScout functions here...

document.addEventListener('DOMContentLoaded', init);