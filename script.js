/**
 * KOPALA FPL - Core Logic
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    updateInterval: null,
    lastRefresh: null
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDashboardLogic();
    initPWAInstall(); // Added PWA logic
    
    // Auto-load dashboard if ID exists
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * 1. SIDEBAR & NAVIGATION
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

/**
 * 2. DASHBOARD & MODAL LOGIC
 */
function initDashboardLogic() {
    const loginBtn = document.getElementById('change-id-btn');
    const fplInput = document.getElementById('fpl-id');
    const confirmModal = document.getElementById('confirm-modal');
    const cancelModalBtn = document.getElementById('cancel-clear');
    const confirmClearBtn = document.getElementById('confirm-clear');

    // Handle Login - Added safety check (?)
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

    // Handle Exit/Clear (Opens Modal)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.reset-fpl-id')) {
            e.preventDefault();
            if (confirmModal) confirmModal.style.display = 'flex';
        }
    });

    // Modal Actions with safety checks
    cancelModalBtn?.addEventListener('click', () => confirmModal.style.display = 'none');
    
    confirmClearBtn?.addEventListener('click', () => {
        confirmModal.style.display = 'none';
        performLogout();
    });
}

/**
 * 3. VIEW CONTROLLER
 */
function renderView(view) {
    const entrySection = document.getElementById('id-entry-section');
    const liveDashboard = document.getElementById('live-dashboard');

    if (!entrySection || !liveDashboard) return; // Prevent crashes if elements missing

    if (view === 'dashboard') {
        entrySection.classList.add('hidden');
        liveDashboard.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        entrySection.classList.remove('hidden');
        liveDashboard.classList.add('hidden');
        const fplInput = document.getElementById('fpl-id');
        if (fplInput) fplInput.value = '';
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

/**
 * 4. DATA FETCHING
 */
async function fetchLiveFPLData() {
    const dispName = document.getElementById('disp-name');
    if (dispName) dispName.textContent = "Loading...";

    try {
        setTimeout(() => {
            updateDashboardUI({
                name: "Lombe Simakando",
                safety: "71",
                gwPoints: "54",
                totalPoints: "856",
                bonusPlayers: [
                    { name: "Haaland", bonus: 3 },
                    { name: "Matheus N.", bonus: 2 },
                    { name: "Cherki", bonus: 1 }
                ]
            });
        }, 800);
    } catch (err) {
        console.error("Fetch failed", err);
    }
}

function updateDashboardUI(data) {
    if (document.getElementById('disp-name')) {
        document.getElementById('disp-name').textContent = data.name;
        document.getElementById('disp-safety').textContent = data.safety;
        document.getElementById('disp-gw').textContent = data.gwPoints;
        document.getElementById('disp-total').textContent = data.totalPoints;

        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = data.bonusPlayers.map(p => `
                <div class="bps-row">
                    <span>${p.name}</span>
                    <span style="font-weight: 800; color: #00ff87;">+${p.bonus} Bonus</span>
                </div>
            `).join('');
        }
    }
    state.lastRefresh = new Date();
}

/**
 * 5. PWA INSTALL LOGIC (Fixed)
 */
let deferredPrompt;

function initPWAInstall() {
    const installBtn = document.getElementById('pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Show the button if it exists
        if (installBtn) installBtn.style.display = 'block';
    });

    installBtn?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response: ${outcome}`);
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
}

/**
 * 6. COMPARISON TOOL
 */
function initComparison() {
    const shareBtn = document.getElementById('share-comparison-btn');
    const feedback = document.getElementById('share-feedback-msg');
    const card = document.getElementById('player-comparison-card');

    if (!shareBtn || !card) return;

    shareBtn.addEventListener('click', async () => {
        shareBtn.style.pointerEvents = 'none';
        if (feedback) {
            feedback.innerText = "Crafting Masterpiece... ✨";
            feedback.classList.add('visible');
        }

        try {
            const canvas = await html2canvas(card, {
                backgroundColor: '#f8fafc',
                scale: 2,
                logging: false
            });

            const link = document.createElement('a');
            link.download = 'FPL-Comparison.png';
            link.href = canvas.toDataURL();
            link.click();

            if (feedback) feedback.innerText = "Captured! Ready to Share 😎";
            setTimeout(() => feedback?.classList.remove('visible'), 2000);
        } catch (e) {
            if (feedback) feedback.innerText = "Oops! Try again 😅";
        } finally {
            shareBtn.style.pointerEvents = 'auto';
        }
    });
}
