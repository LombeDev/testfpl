/**
 * KOPALA FPL - Unified App Logic (v12)
 * Fixed: Variable Collision + Vertical Scroll Integration
 */

// Changed name to prevent SyntaxError collision with other scripts
const deadlineState = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    teamMap: {},
    currentGW: 18,
};

async function init() {
    const loader = document.getElementById("loading-overlay");
    try {
        // Fetching through the Service Worker / Netlify proxy
        const response = await fetch("/fpl-api/bootstrap-static/");
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        
        processAndRender(data);
        if (loader) loader.style.display = 'none';
        // Only run dashboard logic if fplId exists
        if (deadlineState.fplId && typeof renderView === 'function') renderView('dashboard');
    } catch (err) { 
        console.error("Init failed:", err); 
        if (loader) loader.style.display = 'none';
    }
}

function processAndRender(data) {
    data.teams.forEach(t => deadlineState.teamMap[t.id] = t.short_name);
    data.elements.forEach(p => deadlineState.playerMap[p.id] = p.web_name);
    
    renderDeadline(data.events);
    
    // Check if functions exist before calling to prevent crashes
    if (typeof renderPrices === 'function') renderPrices(data.elements);
    if (typeof renderLiveKing === 'function') renderLiveKing(data.elements);
    if (typeof renderScout === 'function') renderScout(data.elements);
}

// --- DEADLINE & NOTIFICATIONS ---
function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    const el = document.getElementById("countdown-timer");
    if (!el) return; // Prevent "null" errors

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
    update(); 
    setInterval(update, 60000); // Updated to 60s to save battery/performance
}

// Helper for notifications (v12)
async function subscribePush() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return console.log("Permission denied");

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array('YOUR_PUBLIC_VAPID_KEY')
        });

        await fetch('/.netlify/functions/save-sub', {
            method: 'POST',
            body: JSON.stringify(sub)
        });

        const btn = document.getElementById('notif-btn');
        if (btn) btn.innerText = "✅ Subscribed";
    } catch (err) { console.error("Subscription failed", err); }
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

document.addEventListener('DOMContentLoaded', init);
