/**
 * KOPALA FPL - PRO MATCH CENTER (ULTIMATE VERSION 2.0)
 * Features: Live Polling, Smart Status, Browser Notifications, 
 * Watchlist Manager, and Proactive Player Search.
 */

const FPL_PROXY = "/fpl-api/"; 

// Central State Management
let state = {
    playerLookup: {},
    teamLookup: {},
    activeGameweek: null,
    refreshTimer: null,
    isInitialLoad: true,
    watchlist: JSON.parse(localStorage.getItem('fpl_watchlist')) || [],
    lastProcessedStats: {} // Tracks goals to trigger notifications
};

/**
 * 1. INITIALIZATION
 */
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error("Bootstrap failed");
        
        const data = await response.json();
        
        // Build fast lookup maps
        state.playerLookup = Object.fromEntries(data.elements.map(p => [p.id, p.web_name]));
        state.teamLookup = Object.fromEntries(data.teams.map(t => [
            t.id, 
            { name: t.name, short: t.short_name, badge: t.code }
        ]));
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        state.activeGameweek = current ? current.id : 1;

        // Initialize UI Components
        renderWatchlistManager();
        updateLiveScores();
    } catch (error) {
        console.error("Sync Error:", error);
        renderErrorMessage("Failed to sync player data. Retrying in 5s...");
        setTimeout(initMatchCenter, 5000);
    }
}

/**
 * 2. LIVE DATA ENGINE
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${state.activeGameweek}`);
        const fixtures = await response.json();
        
        // Sort: Live games first, then by kickoff time (newest first)
        const sortedGames = fixtures.sort((a, b) => {
            if (a.started && !a.finished && (!b.started || b.finished)) return -1;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
        });

        let html = '';
        let lastDateString = "";

        sortedGames.forEach(game => {
            // Grouping by Date
            const kickoff = new Date(game.kickoff_time);
            const dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            if (dateStr !== lastDateString) {
                html += `<div class="date-header" style="color:#37003c; font-size:0.75rem; font-weight:800; margin: 20px 0 10px 5px; opacity:0.6; text-transform:uppercase;">${dateStr}</div>`;
                lastDateString = dateStr;
            }

            // Game Logic
            const status = getMatchStatus(game);
            const homeTeam = state.teamLookup[game.team_h];
            const awayTeam = state.teamLookup[game.team_a];

            // Stats extraction
            const getStat = (id) => game.stats.find(s => s.identifier === id) || { h: [], a: [] };
            const goals = getStat('goals_scored');
            const assists = getStat('assists');
            const bps = getStat('bps');

            // Trigger Notifications for Watchlist players
            checkForWatchlistEvents(game, goals);

            // UI Builders
            const homeEvents = renderEvents(goals.h, assists.h, 'left');
            const awayEvents = renderEvents(goals.a, assists.a, 'right');
            const bonusHtml = renderBonus(bps);

            html += `
                <div class="match-card" style="display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; min-height: 100px;">
                    <div style="flex: 1.3; padding-right: 12px; border-right: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c;">${homeTeam.short}</span>
                            <div style="background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-family: monospace; font-size:0.8rem;">
                                ${game.team_h_score ?? 0} - ${game.team_a_score ?? 0}
                            </div>
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c; text-align: right;">${awayTeam.short}</span>
                        </div>
                        <div style="display: flex; gap: 8px; font-size: 0.6rem; min-height: 30px;">
                            <div style="flex: 1; text-align: left;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right;">${awayEvents}</div>
                        </div>
                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                             <span style="font-size: 0.55rem; opacity: 0.3; font-weight: 800;">GW${state.activeGameweek}</span>
                             <span style="font-size: 0.65rem; font-weight: 900; color:#ff005a;">${status}</span>
                        </div>
                    </div>
                    <div style="flex: 1; padding-left: 12px;">
                        <div style="font-size: 0.55rem; font-weight: 900; margin-bottom: 6px; opacity: 0.5; color:#37003c;">🏆 LIVE BONUS</div>
                        <div style="flex-grow: 1;">${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Awaiting BPS...</span>'}</div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        state.isInitialLoad = false;
        updateWatchlistCount();

        // Dynamic Polling: 30s if live, 5m if not
        const anyLive = fixtures.some(f => f.started && !f.finished);
        clearTimeout(state.refreshTimer);
        state.refreshTimer = setTimeout(updateLiveScores, anyLive ? 30000 : 300000);

    } catch (err) {
        console.error("Update Error:", err);
    }
}

/**
 * 3. HELPER RENDERING FUNCTIONS
 */
function getMatchStatus(game) {
    if (game.finished_provisional && !game.finished) return "Ending...";
    if (game.finished) return "FT";
    if (!game.started) return new Date(game.kickoff_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (game.minutes > 0) {
        if (game.minutes > 45 && game.minutes <= 60) return "HT";
        return `${game.minutes}'`;
    }
    return "LIVE";
}

function renderEvents(goals, assists, side) {
    let html = '';
    goals.forEach(s => {
        const isWatched = state.watchlist.includes(s.element);
        const star = `<span onclick="toggleWatchlist(${s.element})" style="cursor:pointer;">${isWatched ? '⭐' : '☆'}</span>`;
        html += `<div style="margin-bottom:2px;">${side === 'left' ? star : ''} ${state.playerLookup[s.element]} ⚽ ${side === 'right' ? star : ''}</div>`;
    });
    assists.forEach(s => {
        html += `<div style="opacity:0.5; font-size:0.55rem;">${state.playerLookup[s.element]} <span style="color:#ff005a">A</span></div>`;
    });
    return html;
}

function renderBonus(bps) {
    const allBps = [...bps.h.map(p => ({...p})), ...bps.a.map(p => ({...p}))]
                     .sort((a, b) => b.value - a.value)
                     .slice(0, 3);

    if (allBps.length === 0) return '';
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    
    return allBps.map((p, i) => `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.65rem;">
            <span style="background:${colors[i]}; color:#000; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
            <span style="font-weight:700; color:#37003c;">${state.playerLookup[p.element]} <span style="opacity:0.4;">${p.value}</span></span>
        </div>`).join('');
}

/**
 * 4. WATCHLIST & NOTIFICATION LOGIC
 */
async function requestNotifyPermission() {
    if ("Notification" in window && Notification.permission !== "granted") {
        await Notification.requestPermission();
    }
}

function toggleWatchlist(playerId) {
    const index = state.watchlist.indexOf(playerId);
    if (index > -1) {
        state.watchlist.splice(index, 1);
    } else {
        state.watchlist.push(playerId);
        requestNotifyPermission();
    }
    localStorage.setItem('fpl_watchlist', JSON.stringify(state.watchlist));
    renderWatchlistManager();
    updateLiveScores();
}

function checkForWatchlistEvents(game, goals) {
    [...goals.h, ...goals.a].forEach(stat => {
        const playerId = stat.element;
        if (state.watchlist.includes(playerId)) {
            const key = `p${playerId}_g${game.id}`;
            const lastGoals = state.lastProcessedStats[key] || 0;
            
            if (stat.value > lastGoals) {
                sendGoalNotification(playerId, game);
                state.lastProcessedStats[key] = stat.value;
            }
        }
    });
}

function sendGoalNotification(playerId, game) {
    if (Notification.permission === "granted") {
        const name = state.playerLookup[playerId];
        new Notification("⚽ GOAL ALERT!", {
            body: `${name} scored for ${state.teamLookup[game.team_h].short} vs ${state.teamLookup[game.team_a].short}!`,
            tag: `goal-${playerId}-${game.id}`
        });
    }
}

/**
 * 5. WATCHLIST MANAGER & SEARCH
 */
function toggleModal(show) {
    const modal = document.getElementById('watchlist-modal');
    modal.style.display = show ? 'flex' : 'none';
}

function updateWatchlistCount() {
    const counter = document.getElementById('watchlist-count');
    if (counter) counter.innerText = state.watchlist.length;
}

function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    const matches = Object.entries(state.playerLookup)
        .filter(([id, name]) => name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);

    if (matches.length > 0) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = matches.map(([id, name]) => `
            <div onclick="toggleWatchlist(${parseInt(id)}); clearSearch();" 
                 style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 0.8rem;">
                + ${name}
            </div>
        `).join('');
    } else {
        resultsContainer.innerHTML = `<div style="padding:10px; font-size:0.7rem;">No players found</div>`;
    }
}

function clearSearch() {
    document.getElementById('player-search').value = '';
    document.getElementById('search-results').style.display = 'none';
}

function renderWatchlistManager() {
    const listContainer = document.getElementById('watchlist-items');
    if (!listContainer) return;

    if (state.watchlist.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.4; font-size:0.8rem;">Watchlist is empty</div>`;
        return;
    }

    listContainer.innerHTML = state.watchlist.map(playerId => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f0f0f0;">
            <span style="font-weight:700; font-size:0.85rem; color:#37003c;">${state.playerLookup[playerId]}</span>
            <button onclick="toggleWatchlist(${playerId})" style="background:none; border:1px solid #ff005a; color:#ff005a; border-radius:4px; padding:4px 8px; font-size:0.6rem; cursor:pointer;">Remove</button>
        </div>
    `).join('');
}

function renderErrorMessage(msg) {
    const container = document.getElementById('fixtures-container');
    if (container && state.isInitialLoad) container.innerHTML = `<div style="padding:40px; text-align:center; font-size:0.8rem; color:#666;">${msg}</div>`;
}

// Start the Engine
document.addEventListener('DOMContentLoaded', initMatchCenter);
