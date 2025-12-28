/**
 * KOPALA FPL - Professional Core Logic (v12)
 * Fixed: Variable Collision (appState) & Vertical Scroll Integration
 */

const appState = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 18, 
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Utilities
    initNavigation();
    initPWAInstall();
    initScrollUtilities();
    
    // 2. Load Player Database
    await loadPlayerDatabase();

    // 3. Connect UI Logic
    initDashboardLogic();

    // 4. Auto-load Dashboard
    if (appState.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. DATA ENGINE
 */
async function loadPlayerDatabase() {
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        if (!response.ok) throw new Error("API Fetch Failed");
        const data = await response.json();
        
        data.elements.forEach(p => {
            appState.playerMap[p.id] = p.web_name;
        });

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) appState.currentGW = activeGW.id;
        
    } catch (err) {
        console.error("FPL Database Sync Failed", err);
    }
}

async function fetchLiveFPLData() {
    if (!appState.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    if (dispName) dispName.textContent = "Syncing Live Stats...";

    const proxy = "https://corsproxy.io/?";
    const managerUrl = `https://fantasy.premierleague.com/api/entry/${appState.fplId}/`;
    const picksUrl = `https://fantasy.premierleague.com/api/entry/${appState.fplId}/event/${appState.currentGW}/picks/`;

    try {
        const [mResp, pResp] = await Promise.all([
            fetch(proxy + encodeURIComponent(managerUrl)),
            fetch(proxy + encodeURIComponent(picksUrl))
        ]);

        const mData = await mResp.json();
        const pData = await pResp.json();

        // Update UI Elements
        document.getElementById('disp-name').textContent = `${mData.player_first_name} ${mData.player_last_name}`;
        document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
        document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
        
        // Rank Scaling Fix
        const rankEl = document.getElementById('disp-rank');
        const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
        rankEl.textContent = rankText;
        rankEl.style.fontSize = rankText.length > 8 ? "0.85rem" : (rankText.length > 6 ? "1rem" : "1.2rem");

        // Hits and Transfers
        const tx = pData.entry_history.event_transfers || 0;
        const cost = pData.entry_history.event_transfers_cost || 0;
        document.getElementById('disp-transfers').textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;
        document.getElementById('disp-safety').textContent = "Live";

        // Fetch BPS into Scroll Container
        fetchLiveBPS();

    } catch (err) {
        if (dispName) dispName.textContent = "Team ID Not Found";
        console.error("Dashboard Sync Error:", err);
    }
}

async function fetchLiveBPS() {
    const proxy = "https://corsproxy.io/?";
    const url = `https://fantasy.premierleague.com/api/event/${appState.currentGW}/live/`;

    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();

        const topPerformers = data.elements
            .filter(p => p.stats.bps > 0)
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 10);

        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = `
                <p style="font-size:0.65rem; font-weight:800; opacity:0.5; margin-bottom:10px; text-transform:uppercase;">Live Bonus Performance</p>
                <div class="scroll-v" style="max-height: 280px;">
                    ${topPerformers.map(p => `
                        <div class="price-row" style="display:flex; justify-content:space-between; padding:10px; margin-bottom:5px; background:var(--fpl-surface); border-radius:8px;">
                            <span style="font-weight:600;">${appState.playerMap[p.id] || 'Unknown'}</span>
                            <span class="price-up" style="color:#00ff87; font-weight:800;">+${p.stats.bps} BPS</span>
                        </div>
                    `).join('')}
                </div>`;
        }
    } catch (err) {
        console.error("Live BPS Sync Error", err);
    }
}

/**
 * 2. DASHBOARD CONTROLS
 */
function initDashboardLogic() {
    const loginBtn = document.getElementById('change-id-btn');
    const fplInput = document.getElementById('fpl-id');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmClearBtn = document.getElementById('confirm-clear');

    loginBtn?.addEventListener('click', () => {
        const id = fplInput.value.trim();
        if (id && !isNaN(id)) {
            appState.fplId = id;
            localStorage.setItem('kopala_fpl_id', id);
            renderView('dashboard');
        } else {
            alert("Please enter a numeric FPL ID");
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.reset-fpl-id')) {
            confirmModal?.classList.remove('hidden');
            if (confirmModal) confirmModal.style.display = 'flex';
        }
    });

    confirmClearBtn?.addEventListener('click', () => {
        localStorage.removeItem('kopala_fpl_id');
        appState.fplId = null;
        if (confirmModal) confirmModal.style.display = 'none';
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
    }
}

/**
 * 4. UTILITIES
 */
function initNavigation() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');

    const toggle = () => {
        drawer?.classList.toggle('open');
        backdrop?.classList.toggle('active');
        if (backdrop) backdrop.style.display = drawer?.classList.contains('open') ? 'block' : 'none';
    };

    [menuBtn, backdrop].forEach(el => el?.addEventListener('click', toggle));
}

function initScrollUtilities() {
    const btt = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (btt) btt.classList.toggle('show', window.scrollY > 400);
    });
    btt?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initPWAInstall() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'flex';
    });
}
