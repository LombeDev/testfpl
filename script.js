/**
 * KOPALA FPL - Core Logic (v9)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18, 
};

// Background Update Listener
const updateChannel = new BroadcastChannel('fpl-updates');
updateChannel.onmessage = (event) => {
    if (event.data.type === 'DATA_UPDATED') {
        showToast("Live scores updated!");
        fetchLiveFPLData(); // Silently refresh the UI
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initPWAInstall();
    initScrollUtilities();
    
    await loadPlayerDatabase(); // Critical for names
    initDashboardLogic();

    if (state.fplId) renderView('dashboard');
});

/** DATA ENGINE **/
async function loadPlayerDatabase() {
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        data.elements.forEach(p => state.playerMap[p.id] = p.web_name);
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (err) { console.error("Sync Failed", err); }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    const proxy = "https://corsproxy.io/?";
    const managerUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;
    const picksUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        const [mResp, pResp] = await Promise.all([
            fetch(proxy + encodeURIComponent(managerUrl)),
            fetch(proxy + encodeURIComponent(picksUrl))
        ]);
        const mData = await mResp.json();
        const pData = await pResp.json();

        // Update UI
        document.getElementById('disp-name').textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
        document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        rankEl.textContent = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
        
        const tx = pData.entry_history.event_transfers || 0;
        const cost = pData.entry_history.event_transfers_cost || 0;
        document.getElementById('disp-transfers').textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;

        fetchLiveBPS();
    } catch (err) { console.error("Fetch Error:", err); }
}

async function fetchLiveBPS() {
    const proxy = "https://corsproxy.io/?";
    const url = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        const topPerformers = data.elements.sort((a, b) => b.stats.bps - a.stats.bps).slice(0, 3);
        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = `<p class="accent-title" style="font-size:0.7rem;">Top Bonus GW${state.currentGW}</p>` + 
            topPerformers.map(p => `
                <div class="timer-unit" style="display:flex; justify-content:space-between; width:100%; max-width:none; margin-bottom:5px;">
                    <span style="font-weight:700;">${state.playerMap[p.id] || 'Unknown'}</span>
                    <span style="color:var(--fpl-primary); font-weight:900;">${p.stats.bps} BPS</span>
                </div>
            `).join('');
        }
    } catch (err) { console.error("BPS Error", err); }
}

/** UI CONTROLS **/
function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'kopala-toast';
    t.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function initDashboardLogic() {
    document.getElementById('change-id-btn')?.addEventListener('click', () => {
        const id = document.getElementById('fpl-id').value.trim();
        if (id) {
            state.fplId = id;
            localStorage.setItem('kopala_fpl_id', id);
            renderView('dashboard');
        }
    });

    document.getElementById('confirm-clear')?.addEventListener('click', () => {
        localStorage.removeItem('kopala_fpl_id');
        state.fplId = null;
        location.reload();
    });
}

function renderView(view) {
    const entry = document.getElementById('id-entry-section');
    const dash = document.getElementById('live-dashboard');
    if (view === 'dashboard') {
        entry.classList.add('hidden');
        dash.classList.remove('hidden');
        fetchLiveFPLData();
    }
}

function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    menuBtn?.addEventListener('click', () => {
        drawer.classList.toggle('open');
        backdrop.style.display = 'block';
    });
    backdrop?.addEventListener('click', () => {
        drawer.classList.remove('open');
        backdrop.style.display = 'none';
    });
}

function initScrollUtilities() {
    // Back to top logic here if needed
}

function initPWAInstall() {
    let deferredPrompt;
    const btn = document.getElementById('pwa-install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btn) btn.style.display = 'flex';
    });
    btn?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
            btn.style.display = 'none';
        }
    });
}