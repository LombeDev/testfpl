/**
 * KOPALA FPL - Professional Core Logic
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18, // Default, will be updated by API
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Components
    initNavigation();
    initPWAInstall();
    
    // 2. Load Real Player Database (Names/IDs)
    await loadPlayerDatabase();

    // 3. Connect HTML Dashboard Elements
    initDashboardLogic();

    // 4. Auto-load if ID is saved
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. REAL DATA ENGINE
 */
async function loadPlayerDatabase() {
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        
        // Map Player ID -> Web Name
        data.elements.forEach(p => {
            state.playerMap[p.id] = p.web_name;
        });

        // Identify current Gameweek
        const activeGW = data.events.find(e => e.is_current);
        if (activeGW) state.currentGW = activeGW.id;
        
    } catch (err) {
        console.error("FPL Data Sync Failed", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    dispName.textContent = "Fetching Live Data...";

    const proxy = "https://corsproxy.io/?";
    const url = `https://fantasy.premierleague.com/api/entry/${state.fplId}/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        if (!response.ok) throw new Error("Invalid ID");
        const data = await response.json();

        // Update Dashboard with REAL FPL Data
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-gw').textContent = data.summary_event_points || 0;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-safety').textContent = "Active";

        fetchLiveBPS();
    } catch (err) {
        dispName.textContent = "Error: Team ID not found";
    }
}

async function fetchLiveBPS() {
    const proxy = "https://corsproxy.io/?";
    const url = `https://fantasy.premierleague.com/api/event/${state.currentGW}/live/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();

        // Get top 3 players currently leading BPS
        const topPerformers = data.elements
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 3);

        const bpsList = document.getElementById('bps-list');
        bpsList.innerHTML = `<p style="font-size:0.7rem; font-weight:800; opacity:0.5; margin-bottom:10px;">TOP BPS IN GW${state.currentGW}</p>` + 
        topPerformers.map(p => `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding:10px; background:var(--fpl-surface); border-radius:10px;">
                <span style="font-weight:700;">${state.playerMap[p.id] || 'Unknown'}</span>
                <span style="color:var(--fpl-primary); font-weight:900;">${p.stats.bps} BPS</span>
            </div>
        `).join('');

    } catch (err) {
        console.error("Live BPS Error", err);
    }
}

/**
 * 2. DASHBOARD & EXIT LOGIC (Fixed)
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

    // FIXED EXIT BUTTON: Handles clicks on the icon inside the grid
    document.addEventListener('click', (e) => {
        if (e.target.closest('.reset-fpl-id')) {
            e.preventDefault();
            confirmModal.style.display = 'flex';
            confirmModal.classList.remove('hidden');
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
 * 3. VIEW NAVIGATION
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
    }
}

function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    const toggle = () => {
        drawer.classList.toggle('open');
        backdrop.classList.toggle('active');
        backdrop.style.display = drawer.classList.contains('open') ? 'block' : 'none';
    };

    [menuBtn, closeBtn, backdrop].forEach(el => el?.addEventListener('click', toggle));
}

function initPWAInstall() {
    const installBtn = document.getElementById('pwa-install-btn');
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'flex';
    });

    installBtn?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
}
