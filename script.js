/**
 * KOPALA FPL - Professional Core Logic (v10)
 * Features: Netlify Proxy, SWR Data Sync, PWA Utils, Offline Detection
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18,
    isOffline: !navigator.onLine
};

// 1. BROADCAST CHANNEL: Listen for Service Worker "Fresh Data" signals
const updateChannel = new BroadcastChannel('fpl-updates');
updateChannel.onmessage = (event) => {
    if (event.data.type === 'DATA_UPDATED') {
        showToast("Live scores refreshed!");
        fetchLiveFPLData(); // Silently update the UI with new data
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initPWAInstall();
    initScrollUtilities();
    initConnectivityListeners();
    
    // Load static database first
    await loadPlayerDatabase();

    // Dashboard Logic
    initDashboardLogic();

    // Auto-load if ID exists
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * DATA ENGINE
 */
async function loadPlayerDatabase() {
    // Uses your Netlify Redirect: /fpl-api/* -> fantasy.premierleague.com/api/*
    const url = "/fpl-api/bootstrap-static/";
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = p.web_name;
        });

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) state.currentGW = activeGW.id;
        
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

        // Populate Dashboard UI
        document.getElementById('disp-name').textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
        document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        rankEl.textContent = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
        
        // Dynamic Scaling for long rank numbers
        if (rankEl.textContent.length > 7) rankEl.style.fontSize = "0.9rem";

        // Transfers & Hits
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

        const topPerformers = data.elements
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 3);

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
    } catch (err) {
        console.error("BPS Error", err);
    }
}

/**
 * UI & PWA UTILITIES
 */
function initDashboardLogic() {
    const loginBtn = document.getElementById('change-id-btn');
    const fplInput = document.getElementById('fpl-id');

    loginBtn?.addEventListener('click', () => {
        const id = fplInput.value.trim();
        if (id && !isNaN(id)) {
            state.fplId = id;
            localStorage.setItem('kopala_fpl_id', id);
            renderView('dashboard');
        }
    });

    document.getElementById('confirm-clear')?.addEventListener('click', () => {
        localStorage.removeItem('kopala_fpl_id');
        state.fplId = null;
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

function initConnectivityListeners() {
    window.addEventListener('online', () => {
        state.isOffline = false;
        showToast("You are back online!", "success");
        fetchLiveFPLData();
    });
    window.addEventListener('offline', () => {
        state.isOffline = true;
        showToast("Offline Mode: Showing cached data", "warning");
    });
}

function showToast(message, type = "info") {
    const toast = document.createElement('div');
    toast.className = `kopala-toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    menuBtn?.addEventListener('click', () => {
        drawer.classList.add('open');
        backdrop.style.display = 'block';
    });

    backdrop?.addEventListener('click', () => {
        drawer.classList.remove('open');
        backdrop.style.display = 'none';
    });
}

function initPWAInstall() {
    let deferredPrompt;
    const installBtn = document.getElementById('pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'flex';
    });

    installBtn?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
}

function initScrollUtilities() {
    const backToTopBtn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) backToTopBtn?.classList.add('show');
        else backToTopBtn?.classList.remove('show');
    });
    backToTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}