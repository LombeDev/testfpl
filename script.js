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
    initScrollUtilities(); 
    
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
 * Updated to use AllOrigins proxy to bypass 403 Forbidden errors
 */
async function loadPlayerDatabase() {
    const proxy = "https://api.allorigins.win/get?url=";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(`${proxy}${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Proxy unreachable');
        
        const wrapper = await response.json();
        const data = JSON.parse(wrapper.contents); // AllOrigins returns data inside .contents
        
        if (data && data.elements) {
            data.elements.forEach(p => {
                state.playerMap[p.id] = p.web_name;
            });

            const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
            if (activeGW) {
                state.currentGW = activeGW.id;
                // Update HTML label if it exists
                const gwLabel = document.getElementById('gw-label');
                if (gwLabel) gwLabel.textContent = `GW ${state.currentGW} DEADLINE`;
            }
        }
        
    } catch (err) {
        console.error("FPL Database Sync Failed:", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    if (dispName) dispName.textContent = "Syncing Live Stats...";

    const proxy = "https://api.allorigins.win/get?url=";
    const managerUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;
    const picksUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        // Fetch Manager Summary
        const mResp = await fetch(`${proxy}${encodeURIComponent(managerUrl)}`);
        const mWrapper = await mResp.json();
        const mData = JSON.parse(mWrapper.contents);

        // Fetch Event Picks (for Hits/Transfers)
        const pResp = await fetch(`${proxy}${encodeURIComponent(picksUrl)}`);
        const pWrapper = await pResp.json();
        const pData = JSON.parse(pWrapper.contents);

        // --- Populate UI ---
        if (dispName) {
            dispName.textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        }
        
        const dispGW = document.getElementById('disp-gw');
        if (dispGW) dispGW.textContent = mData.summary_event_points || 0;
        
        const dispTotal = document.getElementById('disp-total');
        if (dispTotal) dispTotal.textContent = mData.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        if (rankEl) {
            const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
            rankEl.textContent = rankText;
            
            // Dynamic scaling for large ranks
            rankEl.style.fontSize = rankText.length > 8 ? "0.85rem" : rankText.length > 6 ? "1rem" : "1.2rem";
        }

        const dispTransfers = document.getElementById('disp-transfers');
        if (dispTransfers && pData.entry_history) {
            const tx = pData.entry_history.event_transfers || 0;
            const cost = pData.entry_history.event_transfers_cost || 0;
            dispTransfers.textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;
        }

        fetchLiveBPS();

    } catch (err) {
        if (dispName) dispName.textContent = "Team ID Not Found";
        console.error("Dashboard Sync Error:", err);
    }
}

async function fetchLiveBPS() {
    const proxy = "https://api.allorigins.win/get?url=";
    const url = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;

    try {
        const response = await fetch(`${proxy}${encodeURIComponent(url)}`);
        const wrapper = await response.json();
        const data = JSON.parse(wrapper.contents);

        if (data && data.elements) {
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
        }
    } catch (err) {
        console.error("Live BPS Sync Error", err);
    }
}

/**
 * 2. DASHBOARD LOGIC
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
                confirmModal.classList.remove('hidden');
                confirmModal.style.display = 'flex';
            }
        }
    });

    cancelModalBtn?.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        confirmModal.style.display = 'none';
    });

    confirmClearBtn?.addEventListener('click', () => {
        localStorage.removeItem('kopala_fpl_id');
        state.fplId = null;
        confirmModal.classList.add('hidden');
        confirmModal.style.display = 'none';
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
        entry?.classList.add('hidden');
        dash?.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        entry?.classList.remove('hidden');
        dash?.classList.add('hidden');
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
