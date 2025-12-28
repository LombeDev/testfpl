/**
 * KOPALA FPL - Professional Core Logic (v11)
 * Integrated: Dashboard, Live Stats, Navigation, PWA, & Push Notifications
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    teamMap: {},
    currentGW: 18,
    isOffline: !navigator.onLine
};

// 1. BROADCAST CHANNEL: Listen for Service Worker background updates
const updateChannel = new BroadcastChannel('fpl-updates');
updateChannel.onmessage = (event) => {
    if (event.data.type === 'DATA_UPDATED') {
        showToast("Live scores refreshed!", "success");
        fetchLiveFPLData(); 
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // UI Initializers
    initNavigation();
    initPWAInstall();
    initScrollUtilities();
    initConnectivityListeners();
    
    // Data Loading
    await loadPlayerDatabase();
    initDashboardLogic();

    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. DATA ENGINE (FPL API)
 */
async function loadPlayerDatabase() {
    const url = "/fpl-api/bootstrap-static/";
    const CACHE_KEY = "fpl_bootstrap_cache";

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Build Maps
        data.elements.forEach(p => state.playerMap[p.id] = p.web_name);
        data.teams.forEach(t => state.teamMap[t.id] = t.short_name);

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) state.currentGW = activeGW.id;

        // Render Homepage Widgets
        renderDeadline(data.events);
        renderPrices(data.elements);
        renderLiveKing(data.elements);
        renderScout(data.elements);
        
    } catch (err) {
        console.error("Database Sync Failed", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const managerUrl = `/fpl-api/entry/${state.fplId}/`;
    const picksUrl = `/fpl-api/entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        const [mResp, pResp] = await Promise.all([
            fetch(managerUrl),
            fetch(picksUrl)
        ]);

        const mData = await mResp.json();
        const pData = await pResp.json();

        // Dashboard UI
        document.getElementById('disp-name').textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
        document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
        rankEl.textContent = rankText;
        
        if (rankText.length > 7) rankEl.style.fontSize = "0.9rem";

        const tx = pData.entry_history.event_transfers || 0;
        const cost = pData.entry_history.event_transfers_cost || 0;
        document.getElementById('disp-transfers').textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;

        fetchLiveBPS();

    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    }
}

async function fetchLiveBPS() {
    const url = `/fpl-api/event/${state.currentGW}/live/`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const topPerformers = data.elements.sort((a, b) => b.stats.bps - a.stats.bps).slice(0, 3);
        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = `<p class="accent-title" style="font-size:0.65rem; margin-bottom:10px;">Top Bonus (GW${state.currentGW})</p>` + 
            topPerformers.map(p => `
                <div class="timer-unit" style="display:flex; justify-content:space-between; width:100%; max-width:none; margin-bottom:8px;">
                    <span style="font-weight:700;">${state.playerMap[p.id] || 'Unknown'}</span>
                    <span style="color:var(--fpl-primary); font-weight:900;">+${p.stats.bps} BPS</span>
                </div>
            `).join('');
        }
    } catch (err) { console.error("BPS Error", err); }
}

/**
 * 2. HOME SCREEN WIDGETS (Deadline, Prices, Scout)
 */
function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;
    const el = document.getElementById("countdown-timer");
    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const diff = deadline - Date.now();
        if (diff <= 0) { el.innerHTML = "Deadline Passed"; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerHTML = `
            <div class="timer-grid">
                <div>${d}<span class="timer-unit">DAYS</span></div>
                <div>${h}<span class="timer-unit">HRS</span></div>
                <div>${m}<span class="timer-unit">MIN</span></div>
                <div>${s}<span class="timer-unit">SEC</span></div>
            </div>
            <button id="notif-btn" class="notify-btn" style="margin-top:15px;" onclick="subscribePush()">🔔 Notify Me (2h Before)</button>
        `;
    };
    update(); setInterval(update, 1000);
}

function renderPrices(players) {
    const risersList = document.getElementById("risers-list");
    const fallersList = document.getElementById("fallers-list");
    if (!risersList || !fallersList) return;

    const risers = players.filter(p => p.cost_change_event > 0).sort((a,b) => b.cost_change_event - a.cost_change_event);
    const fallers = players.filter(p => p.cost_change_event < 0).sort((a,b) => a.cost_change_event - b.cost_change_event);

    const row = (p) => `
        <div class="price-row-mini">
            <div><b>${p.web_name}</b><br><small>${state.teamMap[p.team]}</small></div>
            <div style="text-align:right"><b>£${(p.now_cost/10).toFixed(1)}</b></div>
        </div>`;

    risersList.innerHTML = risers.map(row).join('') || 'No risers';
    fallersList.innerHTML = fallers.map(row).join('') || 'No fallers';
}

function renderLiveKing(players) {
    const container = document.getElementById("live-king-content");
    const king = players.reduce((p, c) => (p.event_points > c.event_points) ? p : c);
    if (container && king.event_points > 0) {
        container.innerHTML = `<b>${king.web_name}</b> - ${king.event_points} Pts`;
    }
}

function renderScout(players) {
    const container = document.getElementById("scout-list");
    const bestValue = players.filter(p => parseFloat(p.value_form) > 0).sort((a, b) => b.value_form - a.value_form).slice(0, 3);
    if (container) {
        container.innerHTML = bestValue.map(p => `<div class="timer-unit">${p.web_name} (${p.value_form})</div>`).join('');
    }
}

/**
 * 3. NAVIGATION & UI (FIXED CLOSE BUTTON)
 */
function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn'); // The X Button
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    const openMenu = () => {
        drawer.classList.add('open');
        backdrop.style.display = 'block';
    };

    const closeMenu = () => {
        drawer.classList.remove('open');
        backdrop.style.display = 'none';
    };

    menuBtn?.addEventListener('click', openMenu);
    closeBtn?.addEventListener('click', closeMenu); // Fixed: Close button listener
    backdrop?.addEventListener('click', closeMenu);
}

function initDashboardLogic() {
    const loginBtn = document.getElementById('change-id-btn');
    loginBtn?.addEventListener('click', () => {
        const id = document.getElementById('fpl-id').value.trim();
        if (id && !isNaN(id)) {
            state.fplId = id;
            localStorage.setItem('kopala_fpl_id', id);
            renderView('dashboard');
        }
    });

    document.getElementById('confirm-clear')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.reload();
    });
}

function renderView(view) {
    const entry = document.getElementById('id-entry-section');
    const dash = document.getElementById('live-dashboard');
    if (view === 'dashboard') {
        entry.classList.add('hidden');
        dash.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        entry.classList.remove('hidden');
        dash.classList.add('hidden');
    }
}

/**
 * 4. PWA & NOTIFICATIONS
 */
async function subscribePush() {
    const btn = document.getElementById('notif-btn');
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return showToast("Permission denied", "warning");

        const reg = await navigator.serviceWorker.ready;
        // REPLACE WITH YOUR KEY FROM PREVIOUS STEP
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array('YOUR_PUBLIC_VAPID_KEY')
        });

        await fetch('/.netlify/functions/save-sub', { method: 'POST', body: JSON.stringify(sub) });
        btn.innerText = "✅ Alert Set";
        showToast("Deadline alert set!", "success");
    } catch (err) { showToast("Notification error", "warning"); }
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

function showToast(message, type = "info") {
    const t = document.createElement('div');
    t.className = `kopala-toast ${type}`;
    t.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function initConnectivityListeners() {
    window.addEventListener('online', () => { showToast("Back online!", "success"); fetchLiveFPLData(); });
    window.addEventListener('offline', () => showToast("Offline mode active", "warning"));
}

function initPWAInstall() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('pwa-install-btn').style.display = 'flex';
    });
}

function initScrollUtilities() {
    const btn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) btn?.classList.add('show');
        else btn?.classList.remove('show');
    });
    btn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}