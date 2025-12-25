/**
 * KOPALA FPL - Transfers & Market Logic
 * Features: CORS Proxy, 6-Hour Smart Cache, 429 Protection
 */

// We use a CORS proxy because the FPL API blocks direct browser requests
const API_BASE = "https://corsproxy.io/?https://fantasy.premierleague.com/api/bootstrap-static/";
const CACHE_KEY = "kopala_transfer_cache";
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 Hours

async function initTransfers() {
    const loader = document.getElementById('most-transferred-list');
    const cachedData = localStorage.getItem(CACHE_KEY);
    let apiData = null;

    console.log("Kopala Engine: Initializing...");

    // 1. LOAD FROM CACHE FIRST
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            apiData = parsed.data;
            console.log("Kopala Engine: Data found in cache.");
            renderAll(apiData);

            // Check if cache is still fresh
            const isFresh = (Date.now() - parsed.timestamp) < REFRESH_INTERVAL;
            if (isFresh) {
                console.log("Kopala Engine: Cache is fresh. Skipping network call.");
                return; 
            }
        } catch (e) {
            console.error("Kopala Engine: Cache corruption detected.");
        }
    }

    // 2. FETCH LIVE DATA
    try {
        console.log("Kopala Engine: Fetching live market data via Proxy...");
        const response = await fetch(API_BASE);
        
        if (response.status === 429) throw new Error("Rate limit hit");
        if (!response.ok) throw new Error("API Connection Issue");

        const freshData = await response.json();
        console.log("Kopala Engine: Live data received successfully.");

        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: freshData
        }));

        renderAll(freshData);
    } catch (err) {
        console.warn("Kopala Engine: Sync failed.", err.message);
        // Fallback: If no cache and API fails, show error
        if (!apiData && loader) {
            loader.innerHTML = `<div style="padding:20px; text-align:center; color:#ff005a;">⚠️ Market data unavailable. Check connection.</div>`;
        }
    }
}

// --- RENDERING CORE ---

function renderAll(data) {
    if (!data || !data.elements) {
        console.error("Kopala Engine: Data format invalid.");
        return;
    }

    // Create team lookup (ID -> Short Name)
    const teams = {};
    data.teams.forEach(t => teams[t.id] = t.short_name);

    console.log("Kopala Engine: Rendering UI Components...");
    renderMostCaptained(data.elements, teams);
    renderTransfersIn(data.elements, teams);
    renderTransfersOut(data.elements, teams);
}

function renderMostCaptained(players, teams) {
    const container = document.getElementById('most-captained-list');
    if (!container) return;

    // Use Ownership as a proxy for Popularity/Captaincy
    const top = [...players].sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))[0];

    container.innerHTML = `
        <div class="market-card-inner">
            <h3><i class="fa-solid fa-crown" style="color:#ffd700"></i> Popular Pick</h3>
            <div class="price-row">
                <div class="player-info">
                    <span class="player-name">${top.web_name}</span>
                    <span class="team-name">${teams[top.team]}</span>
                </div>
                <div class="change-up">${top.selected_by_percent}% Owned</div>
            </div>
        </div>
    `;
}

function renderTransfersIn(players, teams) {
    const container = document.getElementById('most-transferred-list');
    if (!container) return;

    const sorted = [...players]
        .filter(p => p.transfers_in_event > 0)
        .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
        .slice(0, 5);

    container.innerHTML = `<h3><i class="fa-solid fa-trending-up" style="color:#00ff87"></i> Market Risers</h3>` + 
    sorted.map(p => `
        <div class="price-row">
            <div class="player-info">
                <span class="player-name">${p.web_name}</span>
                <span class="team-name">${teams[p.team]}</span>
            </div>
            <div class="change-up">+${(p.transfers_in_event / 1000).toFixed(1)}k</div>
        </div>
    `).join('');
}

function renderTransfersOut(players, teams) {
    const container = document.getElementById('most-transferred-out-list');
    if (!container) return;

    const sorted = [...players]
        .filter(p => p.transfers_out_event > 0)
        .sort((a, b) => b.transfers_out_event - a.transfers_out_event)
        .slice(0, 5);

    container.innerHTML = `<h3><i class="fa-solid fa-trending-down" style="color:#ff005a"></i> Market Fallers</h3>` + 
    sorted.map(p => `
        <div class="price-row">
            <div class="player-info">
                <span class="player-name">${p.web_name}</span>
                <span class="team-name">${teams[p.team]}</span>
            </div>
            <div class="change-down">-${(p.transfers_out_event / 1000).toFixed(1)}k</div>
        </div>
    `).join('');
}

// --- UI / DRAWER LOGIC ---

function initDrawer() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    const closeBtn = document.getElementById('close-btn');

    if (!menuBtn || !drawer) return;

    const toggle = () => {
        drawer.classList.toggle('active');
        if(backdrop) backdrop.classList.toggle('active');
    };

    menuBtn.addEventListener('click', toggle);
    if(closeBtn) closeBtn.addEventListener('click', toggle);
    if(backdrop) backdrop.addEventListener('click', toggle);
}

// Start Engine
document.addEventListener('DOMContentLoaded', () => {
    initTransfers();
    initDrawer();
});
