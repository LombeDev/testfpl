/**
 * KOPALA FPL - Transfers & Market Logic
 * Features: 6-Hour Smart Cache, 429 Protection, Auto-Fallback
 */

const API_BASE = "/fpl-api/";
const CACHE_KEY = "kopala_transfer_cache";
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 Hours in milliseconds

async function initTransfers() {
    const loader = document.getElementById('most-transferred-list');
    const cachedData = localStorage.getItem(CACHE_KEY);
    let apiData = null;

    // 1. INSTANT UI LOAD (From Cache)
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        apiData = parsed.data;
        renderAll(apiData);

        // Check if cache is still fresh
        const isFresh = (Date.now() - parsed.timestamp) < REFRESH_INTERVAL;
        if (isFresh) {
            console.log("Kopala Engine: Data is fresh. Skipping API call.");
            return; 
        }
    }

    // 2. BACKGROUND SYNC (If Stale or No Cache)
    try {
        console.log("Kopala Engine: Syncing live market data...");
        const response = await fetch(`${API_BASE}bootstrap-static/`);
        
        if (response.status === 429) throw new Error("Rate limit hit");
        if (!response.ok) throw new Error("API Connection Issue");

        const freshData = await response.json();

        // Save to cache with new timestamp
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: freshData
        }));

        renderAll(freshData);
    } catch (err) {
        console.warn("Kopala Engine: Sync failed. Using fallback cache.", err.message);
        // If we hit a rate limit and have no cache at all, show error
        if (!apiData && loader) {
            loader.innerHTML = `<div style="padding:20px; text-align:center;">⚠️ API Limit Reached. Please try in 30 mins.</div>`;
        }
    }
}

// --- RENDERING CORE ---

function renderAll(data) {
    if (!data || !data.elements) return;

    // Create a quick lookup for team short names (e.g., 1 -> "ARS")
    const teams = {};
    data.teams.forEach(t => teams[t.id] = t.short_name);

    renderMostCaptained(data.elements, teams);
    renderTransfersIn(data.elements, teams);
    renderTransfersOut(data.elements, teams);
}

function renderMostCaptained(players, teams) {
    const container = document.getElementById('most-captained-list');
    if (!container) return;

    // Most Owned (Proxy for Captaincy in this API view)
    const top = [...players].sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))[0];

    container.innerHTML = `
        <h3><i class="fa-solid fa-crown" style="color:#ffd700"></i> Popular Pick</h3>
        <div class="price-row">
            <div class="player-info">
                <span class="player-name">${top.web_name}</span>
                <span class="team-name">${teams[top.team]}</span>
            </div>
            <div class="change-up">${top.selected_by_percent}% Owned</div>
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

    container.innerHTML = `<h3><i class="fa-solid fa-trending-up" style="color:var(--primary-green)"></i> Market Risers (In)</h3>` + 
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

    container.innerHTML = `<h3><i class="fa-solid fa-trending-down" style="color:var(--down)"></i> Market Fallers (Out)</h3>` + 
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

// --- DRAWER NAVIGATION LOGIC ---

function initDrawer() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('main-backdrop');
    const closeBtn = document.getElementById('close-btn');

    if (!menuBtn || !drawer) return;

    const toggle = () => {
        drawer.classList.toggle('active');
        backdrop.classList.toggle('active');
    };

    menuBtn.addEventListener('click', toggle);
    closeBtn.addEventListener('click', toggle);
    backdrop.addEventListener('click', toggle);
}

// Kick off
document.addEventListener('DOMContentLoaded', () => {
    initTransfers();
    initDrawer();
});
