/**
 * KOPALA FPL - Professional Core Logic
 * Integrated: Real Data, BPS, Hits Tracking, Overflow Fixes & Scroll Utilities
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18, 
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Navigation, PWA, and Scroll Utilities
    initNavigation();
    initPWAInstall();
    initScrollUtilities(); // Added for Back to Top
    
    // 2. Load Player Names & Current Gameweek
    await loadPlayerDatabase();

    // 3. Connect Dashboard Button Logic
    initDashboardLogic();

    // 4. Auto-load Dashboard if ID is already saved
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. DATA ENGINE (FPL API FETCHING)
 */
async function loadPlayerDatabase() {
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = p.web_name;
        });

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) state.currentGW = activeGW.id;
        
    } catch (err) {
        console.error("FPL Database Sync Failed", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    dispName.textContent = "Syncing Live Stats...";

    const proxy = "https://corsproxy.io/?";
    const managerUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;
    const picksUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        const mResp = await fetch(proxy + encodeURIComponent(managerUrl));
        const mData = await mResp.json();

        const pResp = await fetch(proxy + encodeURIComponent(picksUrl));
        const pData = await pResp.json();

        // --- Populate UI & Apply Overflow Fixes ---
        
        document.getElementById('disp-name').textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
        document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
        
        // 2. Live Rank with Dynamic Scaling to prevent "beyond the box"
        const rankEl = document.getElementById('disp-rank');
        const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
        rankEl.textContent = rankText;
        
        if (rankText.length > 8) {
            rankEl.style.fontSize = "0.85rem";
        } else if (rankText.length > 6) {
            rankEl.style.fontSize = "1rem";
        } else {
            rankEl.style.fontSize = "1.2rem";
        }

        // 3. Weekly Transfers & Hits
        const tx = pData.entry_history.event_transfers || 0;
        const cost = pData.entry_history.event_transfers_cost || 0;
        document.getElementById('disp-transfers').textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;

        document.getElementById('disp-safety').textContent = "Live";

        fetchLiveBPS();

    } catch (err) {
        dispName.textContent = "Team ID Not Found";
        console.error("Dashboard Sync Error:", err);
    }
}

async function fetchLiveBPS() {
    const proxy = "https://corsproxy.io/?";
    const url = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();

        const topPerformers = data.elements
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 3);

        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = `<p style="font-size:0.65rem; font-weight:800; opacity:0.5; margin-bottom:10px; text-transform:uppercase;">Top Bonus (GW${state.currentGW})</p>` + 
            topPerformers.map(p => `
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding:12px; background:var(--fpl-surface); border-radius:12px; border: 1px solid var(--fpl-border);">
                    <span style="font-weight:700;">${state.playerMap[p.id] || 'Unknown'}</span>
                    <span style="color:var(--fpl-primary); font-weight:900;">+${p.stats.bps} BPS</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Live BPS Sync Error", err);
    }
}

/**
 * 2. DASHBOARD LOGIC (INPUTS & MODAL)
 */
function initDashboardLogic() {
    const loginBtn = document.getElementById('change-id-btn');
    const fplInput = document.getElementById('fpl-id');
    const confirmModal = document.getElementById('confirm-modal');
    const cancelModalBtn = document.getElementById('cancel-clear');
    const confirmClearBtn = document.getElementById('confirm-clear');

    loginBtn?.addEventListener('click', () => {
        const id = fplInput.value.trim();
        if (id && !isNaN(id)) {
            state.fplId = id;
            localStorage.setItem('kopala_fpl_id', id);
            renderView('dashboard');
        } else {
            alert("Please enter a numeric FPL ID");
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.reset-fpl-id')) {
            e.preventDefault();
            if (confirmModal) {
                confirmModal.style.display = 'flex';
                confirmModal.classList.remove('hidden');
            }
        }
    });

    cancelModalBtn?.addEventListener('click', () => {
        confirmModal.style.display = 'none';
        confirmModal.classList.add('hidden');
    });

    confirmClearBtn?.addEventListener('click', () => {
        localStorage.removeItem('kopala_fpl_id');
        state.fplId = null;
        confirmModal.style.display = 'none';
        confirmModal.classList.add('hidden');
        renderView('login');
    });
}

/**
 * 3. VIEW CONTROLLER
 */
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
        const fplInput = document.getElementById('fpl-id');
        if (fplInput) fplInput.value = '';
    }
}

/**
 * 4. NAVIGATION & UTILITIES
 */
function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    const toggle = () => {
        if (!drawer || !backdrop) return;
        drawer.classList.toggle('open');
        backdrop.classList.toggle('active');
        backdrop.style.display = drawer.classList.contains('open') ? 'block' : 'none';
    };

    [menuBtn, closeBtn, backdrop].forEach(el => el?.addEventListener('click', toggle));
}

function initScrollUtilities() {
    const backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initPWAInstall() {
    const installBtn = document.getElementById('pwa-install-btn');
    let deferredPrompt;

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









