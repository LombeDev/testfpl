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

    // Handle Login
    loginBtn.addEventListener('click', () => {
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
            confirmModal.style.display = 'flex';
        }
    });

    // Modal Actions
    cancelModalBtn.addEventListener('click', () => confirmModal.style.display = 'none');
    
    confirmClearBtn.addEventListener('click', () => {
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

    if (view === 'dashboard') {
        entrySection.classList.add('hidden');
        liveDashboard.classList.remove('hidden');
        fetchLiveFPLData();
    } else {
        entrySection.classList.remove('hidden');
        liveDashboard.classList.add('hidden');
        document.getElementById('fpl-id').value = '';
    }
}

function performLogout() {
    localStorage.removeItem('kopala_fpl_id');
    state.fplId = null;
    
    // Close sidebar if open
    document.getElementById('side-drawer').classList.remove('open');
    document.getElementById('main-backdrop').classList.remove('active');
    document.getElementById('main-backdrop').style.display = 'none';
    
    renderView('home');
}

/**
 * 4. DATA FETCHING (Re-engineered from Images)
 */
async function fetchLiveFPLData() {
    // Show loading state (Optional)
    document.getElementById('disp-name').textContent = "Loading...";

    try {
        // In a real production environment, you would use:
        // const data = await fetch(`YOUR_PROXY_URL/entry/${state.fplId}/live/`);
        
        // Simulating the exact data from your images for the "re-engineered" feel
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
    document.getElementById('disp-name').textContent = data.name;
    document.getElementById('disp-safety').textContent = data.safety;
    document.getElementById('disp-gw').textContent = data.gwPoints;
    document.getElementById('disp-total').textContent = data.totalPoints;

    const bpsList = document.getElementById('bps-list');
    bpsList.innerHTML = data.bonusPlayers.map(p => `
        <div class="bps-row">
            <span>${p.name}</span>
            <span style="font-weight: 800; color: var(--primary-green);">+${p.bonus} Bonus</span>
        </div>
    `).join('');

    state.lastRefresh = new Date();
}

/**
 * 5. UTILS - Live Auto-Refresh Simulation
 */
setInterval(() => {
    if (state.fplId && document.getElementById('live-dashboard').offsetParent !== null) {
        // This is where you'd trigger a silent background refresh every 60s
        console.log("Kopala Live: Checking for BPS updates...");
    }
}, 60000);



document.addEventListener('DOMContentLoaded', () => {
    const shareBtn = document.getElementById('share-comparison-btn');
    const feedback = document.getElementById('share-feedback-msg');
    const card = document.getElementById('player-comparison-card');

    // 1. Function to highlight the winner
    function updateComparison() {
        const stats = ['points', 'xg', 'xa', 'ict'];
        stats.forEach(stat => {
            const row = document.querySelector(`[data-stat="${stat}"]`);
            const v1 = parseFloat(row.querySelector('.p1-val').innerText);
            const v2 = parseFloat(row.querySelector('.p2-val').innerText);
            
            row.querySelectorAll('.val').forEach(el => el.classList.remove('winner'));
            
            if (v1 > v2) row.querySelector('.p1-val').classList.add('winner');
            else if (v2 > v1) row.querySelector('.p2-val').classList.add('winner');
        });
    }

    // 2. Share Image with Emotional Feedback
    shareBtn.addEventListener('click', async () => {
        shareBtn.style.pointerEvents = 'none';
        feedback.innerText = "Crafting Masterpiece... ✨";
        feedback.classList.add('visible');

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

            feedback.innerText = "Captured! Ready to Share 😎";
            setTimeout(() => feedback.classList.remove('visible'), 2000);
        } catch (e) {
            feedback.innerText = "Oops! Try again 😅";
        } finally {
            shareBtn.style.pointerEvents = 'auto';
        }
    });

    // Run comparison initially
    updateComparison();
});