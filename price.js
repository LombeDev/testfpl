/**
 * KOPALA FPL - Price Predictor & Rate-Limit Guard
 */

const PROXY = "https://corsproxy.io/?url=";
const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const LOCK_KEY = 'fpl_api_blocked_until';
const CACHE_KEY = "fpl_bootstrap_cache";

async function initPredictor() {
    const loader = document.getElementById('loader');
    
    // 1. Check for Active Rate-Limit Lock
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - Date.now()) / 60000);
        console.warn(`API is locked for ${remainingMin}m`);
        loadFromCacheOnly(`⚠️ API Limit: Refresh in ${remainingMin}m`);
        return;
    }

    try {
        // 2. Try fetching new data
        const response = await fetch(PROXY + encodeURIComponent(API_URL));

        // Handle 429 Error (Too Many Requests)
        if (response.status === 429) {
            const coolDownTime = Date.now() + (30 * 60 * 1000); // 30 min ban
            localStorage.setItem(LOCK_KEY, coolDownTime.toString());
            throw new Error("API Limit reached");
        }

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();

        // 3. Save to Cache on Success
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            content: data
        }));

        processAndRender(data);
        if (loader) loader.style.display = 'none';

    } catch (e) {
        console.error("Fetch failed:", e.message);
        loadFromCacheOnly("⚠️ Offline Mode: Using Cached Data");
    }
}

/** * Shared processing logic for both API and Cache
 */
function processAndRender(data) {
    const players = data.elements
        .filter(p => p.transfers_in_event > 3000 || p.transfers_out_event > 3000)
        .map(p => {
            const netTransfers = p.transfers_in_event - p.transfers_out_event;
            const progress = (netTransfers / 45000) * 100; 
            
            return {
                name: p.web_name,
                team: data.teams.find(t => t.id === p.team).short_name, // Changed to short_name for table fit
                price: (p.now_cost / 10).toFixed(1),
                progress: progress.toFixed(2),
                prediction: (progress * 1.05).toFixed(2),
                rate: (Math.random() * 5).toFixed(2),
                pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type]
            };
        })
        .sort((a, b) => Math.abs(b.progress) - Math.abs(a.progress));

    renderTable(players);
}

/** * Fallback to LocalStorage if API is blocked or offline
 */
function loadFromCacheOnly(statusMsg) {
    const loader = document.getElementById('loader');
    const cached = localStorage.getItem(CACHE_KEY);
    
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
        if (loader) {
            loader.style.background = "rgba(255, 165, 0, 0.1)";
            loader.innerHTML = `<span style="color: #37003c; font-weight:bold;">${statusMsg}</span>`;
            // Optional: Auto-hide error message after 5 seconds but keep the table
            setTimeout(() => loader.style.display = 'none', 5000);
        }
    } else {
        if (loader) loader.textContent = "Error: No data available. Connect to internet.";
    }
}

function renderTable(players) {
    const body = document.getElementById('predictor-body');
    if (!body) return;
    
    body.innerHTML = players.map(p => {
        const isRising = p.prediction >= 100;
        const isFalling = p.prediction <= -100;
        const cellClass = isRising ? 'rise-cell' : (isFalling ? 'fall-cell' : '');
        const trendClass = p.progress >= 0 ? 'trend-up' : 'trend-down';
        const arrows = p.progress >= 0 ? '▲▲▲' : '▼▼▼'; // Better looking arrows

        return `
            <tr>
                <td><strong>${p.name}</strong><br><small>${p.pos} £${p.price}</small></td>
                <td>${p.team}</td>
                <td class="${trendClass}">${p.progress}%</td>
                <td class="${cellClass}">
                    ${p.prediction}%
                    ${(isRising || isFalling) ? '<span class="tonight-tag">⚠️ Tonight</span>' : ''}
                </td>
                <td>
                    <span class="${trendClass}">${p.progress >= 0 ? '+' : ''}${p.rate}%</span><br>
                    <span class="${trendClass}">${arrows}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Countdown Logic remains the same
function updateTimer() {
    const now = new Date();
    const target = new Date();
    target.setUTCHours(2, 30, 0, 0); 
    if (now > target) target.setDate(target.getDate() + 1);

    const diff = target - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = `${h.toString().padStart(2, '0')} hr ${m.toString().padStart(2, '0')} min ${s.toString().padStart(2, '0')} sec`;
    }
}

setInterval(updateTimer, 1000);
initPredictor();
