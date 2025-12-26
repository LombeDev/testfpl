/**
 * KOPALA FPL - Core Logic (Real-Time Version)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, // Stores { 355: "Haaland" }
    currentGW: null,
    updateInterval: null,
    lastRefresh: null
};

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initDashboardLogic();
    initPWAInstall(); 
    checkFirstTimeWelcome();
    
    // Load the player database first so names show up immediately
    await loadPlayerDatabase();
    
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. DATA ENGINE (Real API Calls)
 */

// Loads all names and find the current Gameweek
async function loadPlayerDatabase() {
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        
        // Map Player ID to Web Name
        data.elements.forEach(p => {
            state.playerMap[p.id] = p.web_name;
        });

        // Find which Gameweek is happening now
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        state.currentGW = activeGW ? activeGW.id : 1;
        
        console.log(`✅ FPL Data Sync: GW${state.currentGW} Active`);
    } catch (err) {
        console.error("Database sync failed:", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    if (dispName) dispName.textContent = "Syncing...";

    const proxy = "https://corsproxy.io/?";
    const entryUrl = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(entryUrl));
        if (!response.ok) throw new Error("Manager not found");
        const data = await response.json();

        // Update Dashboard with Real Manager Stats
        updateDashboardUI({
            name: `${data.player_first_name} ${data.player_last_name}`,
            safety: "Live", // FPL doesn't provide a 'safety %' via API
            gwPoints: data.summary_event_points || 0,
            totalPoints: data.summary_overall_points.toLocaleString()
        });

        // Fetch Live Bonus Points (BPS) for current matches
        fetchLiveBPS();

    } catch (err) {
        if (dispName) dispName.textContent = "Invalid ID";
        console.error("Fetch failed", err);
    }
}

async function fetchLiveBPS() {
    const proxy = "https://corsproxy.io/?";
    const liveUrl = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(liveUrl));
        const data = await response.json();

        // Get top 3 performers by BPS
        const topPerformers = data.elements
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 3)
            .map(p => ({
                name: state.playerMap[p.id] || "Unknown",
                bonus: p.stats.bps // Displaying BPS value as "Bonus" indicator
            }));

        renderBPSList(topPerformers);
    } catch (err) {
        console.error("BPS error", err);
    }
}

/**
 * 2. UI UPDATE LOGIC
 */
function updateDashboardUI(data) {
    if (document.getElementById('disp-name')) {
        document.getElementById('disp-name').textContent = data.name;
        document.getElementById('disp-safety').textContent = data.safety;
        document.getElementById('disp-gw').textContent = data.gwPoints;
        document.getElementById('disp-total').textContent = data.totalPoints;
    }
    state.lastRefresh = new Date();
}

function renderBPSList(players) {
    const bpsList = document.getElementById('bps-list');
    if (bpsList) {
        bpsList.innerHTML = players.map(p => `
            <div class="bps-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>${p.name}</span>
                <span style="font-weight: 800; color: #00ff87;">${p.bonus} BPS</span>
            </div>
        `).join('');
    }
}

/**
 * 3. NAVIGATION, MODALS & PWA (Retained from your code)
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

    [menuBtn, closeBtn, backdrop].forEach(el => el && el.addEventListener('click', toggle));
}

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
            alert("Please enter a valid numeric FPL ID.");
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.reset-fpl-id')) {
            e.preventDefault();
            if (confirmModal) confirmModal.style.display = 'flex';
        }
    });

    cancelModalBtn?.addEventListener('click', () => confirmModal.style.display = 'none');
    confirmClearBtn?.addEventListener('click', () => {
        confirmModal.style.display = 'none';
        performLogout();
    });
}

function renderView(view) {
    const entrySection = document.getElementById('id-entry-section');
    const liveDashboard = document.getElementById('live-dashboard');

    if (!entrySection || !liveDashboard) return;

    if (view === 'dashboard') {
        entrySection.classList.add('hidden');
        liveDashboard.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        entrySection.classList.remove('hidden');
        liveDashboard.classList.add('hidden');
        if (document.getElementById('fpl-id')) document.getElementById('fpl-id').value = '';
    }
}

function performLogout() {
    localStorage.removeItem('kopala_fpl_id');
    state.fplId = null;
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    drawer?.classList.remove('open');
    backdrop?.classList.remove('active');
    if (backdrop) backdrop.style.display = 'none';
    renderView('home');
}

function initPWAInstall() {
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

function checkFirstTimeWelcome() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone && !localStorage.getItem('pwa_welcome_shown')) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Welcome to KOPALA FPL!', {
                body: 'Installed successfully. Ready for live FPL tracking.',
                icon: '/android-chrome-192x192.png'
            });
            localStorage.setItem('pwa_welcome_shown', 'true');
        });
    }
}
