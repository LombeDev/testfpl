/**
 * KOPALA FPL - Professional Core Logic
 * Integrated: Fallback Proxies, PWA Fixes, & Robust Data Parsing
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18, 
};

// We use a list of proxies. If one is blocked (403), the script tries the next.
const PROXIES = [
    "https://api.allorigins.win/get?url=",
    "https://thingproxy.freeboard.io/fetch/"
];

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initPWAInstall();
    initScrollUtilities(); 
    
    // Load Database with proxy rotation
    await loadPlayerDatabase();

    initDashboardLogic();

    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. DATA ENGINE (FPL API FETCHING WITH FALLBACKS)
 */
async function apiFetch(targetUrl) {
    for (let proxy of PROXIES) {
        try {
            const response = await fetch(`${proxy}${encodeURIComponent(targetUrl)}`);
            if (!response.ok) continue;

            let data;
            // AllOrigins wraps data in a .contents string
            if (proxy.includes("allorigins")) {
                const wrapper = await response.json();
                data = JSON.parse(wrapper.contents);
            } else {
                // ThingProxy/CORS-Anywhere return raw JSON
                data = await response.json();
            }
            
            if (data) return data;
        } catch (err) {
            console.warn(`Proxy ${proxy} failed, trying next...`);
        }
    }
    throw new Error("All proxies failed to reach FPL API.");
}

async function loadPlayerDatabase() {
    try {
        const data = await apiFetch("https://fantasy.premierleague.com/api/bootstrap-static/");
        
        if (data && data.elements) {
            data.elements.forEach(p => {
                state.playerMap[p.id] = p.web_name;
            });

            const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
            if (activeGW) {
                state.currentGW = activeGW.id;
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

    const managerUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;
    const picksUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        const mData = await apiFetch(managerUrl);
        const pData = await apiFetch(picksUrl);

        if (dispName) dispName.textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        
        const dispGW = document.getElementById('disp-gw');
        if (dispGW) dispGW.textContent = mData.summary_event_points || 0;
        
        const dispTotal = document.getElementById('disp-total');
        if (dispTotal) dispTotal.textContent = mData.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        if (rankEl) {
            const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
            rankEl.textContent = rankText;
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
    const url = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;

    try {
        const data = await apiFetch(url);

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
        if (entry) entry.classList.add('hidden');
        if (dash) dash.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        if (entry) entry.classList.remove('hidden');
        if (dash) dash.classList.add('hidden');
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

/**
 * 5. PWA INSTALL LOGIC (FIXED)
 */
function initPWAInstall() {
    const installBtn = document.getElementById('pwa-install-btn');
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser banner
        e.preventDefault();
        // Save the event to trigger it later on click
        deferredPrompt = e;
        // Show our custom button
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.classList.remove('hidden');
        }
    });

    installBtn?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Show the native prompt
        deferredPrompt.prompt();
        
        // Check user choice
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User Choice: ${outcome}`);
        
        // Prompt can only be used once
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installBtn) installBtn.style.display = 'none';
    });
}
