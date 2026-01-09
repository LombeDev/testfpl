/**
 * KOPALA FPL - PRO AI MATCH CENTER (FINAL INTEGRATED VERSION)
 */

const FPL_PROXY = "/fpl-api/"; 

// Central state to keep everything in sync
let state = {
    playerLookup: {},
    teamLookup: {},
    activeGameweek: null,
    refreshTimer: null,
    watchlist: JSON.parse(localStorage.getItem('fpl_watchlist')) || [],
    lastProcessedStats: {}
};

/**
 * 1. Initialize System
 */
async function initMatchCenter() {
    const container = document.getElementById('fixtures-container');
    
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error("API Proxy Offline");
        
        const data = await response.json();
        
        // Fast Map Generation
        state.playerLookup = Object.fromEntries(data.elements.map(p => [p.id, p.web_name]));
        state.teamLookup = Object.fromEntries(data.teams.map(t => [t.id, { name: t.name, short: t.short_name }]));
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        state.activeGameweek = current ? current.id : 1;

        // Start the cycles
        updateLiveScores();
        renderWatchlistManager();
        
    } catch (error) {
        console.error("AI Sync Error:", error);
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:20px; font-size:0.7rem; color:#ff005a;">Connection Lost. Retrying...</div>`;
        }
        setTimeout(initMatchCenter, 5000);
    }
}

/**
 * 2. Main AI Render Engine
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveIndicator = document.getElementById('live-indicator');
    if (!container) return;

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${state.activeGameweek}`);
        const fixtures = await response.json();
        
        // Sort: Live games first, then kickoff time
        const sortedGames = fixtures.sort((a, b) => {
            if (a.started && !a.finished && (!b.started || b.finished)) return -1;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
        });

        // AI Toggle: Control your LIVE indicator badge
        const anyLive = fixtures.some(f => f.started && !f.finished);
        if (liveIndicator) {
            anyLive ? liveIndicator.classList.remove('hidden') : liveIndicator.classList.add('hidden');
        }

        let html = '';
        let lastDateString = "";

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            // Date Header
            if (dateStr !== lastDateString) {
                html += `<div style="color:#37003c; font-size:0.7rem; font-weight:800; margin: 15px 0 8px 5px; opacity:0.5; text-transform:uppercase;">${dateStr}</div>`;
                lastDateString = dateStr;
            }

            const home = state.teamLookup[game.team_h];
            const away = state.teamLookup[game.team_a];
            const status = game.finished ? "FT" : (game.started ? `${game.minutes}'` : "PRE");

            // Extract Stats
            const goals = game.stats.find(s => s.identifier === 'goals_scored') || {h:[], a:[]};
            const assists = game.stats.find(s => s.identifier === 'assists') || {h:[], a:[]};
            const bps = game.stats.find(s => s.identifier === 'bps') || {h:[], a:[]};

            // Notification Engine
            checkForNotifications(game, goals);

            // Render Match Events
            const renderEvents = (players, isGoal) => players.map(s => {
                const isWatched = state.watchlist.includes(s.element);
                const star = `<span onclick="toggleWatchlist(${s.element})" style="cursor:pointer; font-size:0.7rem;">${isWatched ? '★' : '☆'}</span>`;
                return `<div style="margin-bottom:2px;">${star} ${state.playerLookup[s.element]} ${isGoal ? '⚽' : '<span style="color:#ff005a">A</span>'}</div>`;
            }).join('');

            const homeEvents = renderEvents(goals.h, true) + renderEvents(assists.h, false);
            const awayEvents = renderEvents(goals.a, true) + renderEvents(assists.a, false);

            // AI Bonus Prediction
            const topBps = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
            const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
            const bonusHtml = topBps.map((p, i) => `
                <div style="margin-bottom:6px; font-size:0.65rem; display:flex; align-items:center; gap:5px;">
                    <span style="background:${colors[i]}; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                    <span style="font-weight:700; color:#37003c;">${state.playerLookup[p.element]}</span>
                    <span style="opacity:0.3;">${p.value}</span>
                    ${game.minutes > 80 && i === 0 ? '<span style="color:#00ff87; font-size:0.5rem;">✦</span>' : ''}
                </div>`).join('');

            html += `
                <div style="display: flex; padding: 12px 0; border-bottom: 1px solid #f5f5f5; min-height: 90px;">
                    <div style="flex: 1.4; border-right: 1px solid #eee; padding-right: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c;">${home.short}</span>
                            <div style="background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-family: monospace; font-size:0.75rem;">
                                ${game.team_h_score} - ${game.team_a_score}
                            </div>
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c; text-align: right;">${away.short}</span>
                        </div>
                        <div style="display: flex; gap: 8px; font-size: 0.6rem; min-height: 20px;">
                            <div style="flex: 1;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right;">${awayEvents}</div>
                        </div>
                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                             <span style="font-size: 0.55rem; opacity: 0.3; font-weight: 800;">GW${state.activeGameweek}</span>
                             <span style="font-size: 0.65rem; font-weight: 900; color:#ff005a;">${status}</span>
                        </div>
                    </div>
                    <div style="flex: 1; padding-left: 12px;">
                        <div style="font-size: 0.55rem; font-weight: 900; color: #37003c; margin-bottom: 6px; opacity: 0.4;">AI BONUS</div>
                        ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Calculated...</span>'}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        
        // Polling
        clearTimeout(state.refreshTimer);
        state.refreshTimer = setTimeout(updateLiveScores, anyLive ? 30000 : 300000);

    } catch (err) {
        console.error("Render Error:", err);
    }
}

/**
 * 3. Watchlist & Search Logic
 * Using your IDs: player-search, search-results, watchlist-items
 */
function toggleWatchlist(playerId) {
    const idx = state.watchlist.indexOf(playerId);
    if (idx > -1) {
        state.watchlist.splice(idx, 1);
    } else {
        state.watchlist.push(playerId);
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }
    localStorage.setItem('fpl_watchlist', JSON.stringify(state.watchlist));
    renderWatchlistManager();
    updateLiveScores();
}

function handleSearch(val) {
    const res = document.getElementById('search-results');
    if (!res) return;
    if (val.length < 2) { res.style.display = 'none'; return; }
    
    const matches = Object.entries(state.playerLookup)
        .filter(([id, name]) => name.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 5);

    if (matches.length > 0) {
        res.style.display = 'block';
        res.innerHTML = matches.map(([id, name]) => `
            <div onclick="toggleWatchlist(${parseInt(id)}); document.getElementById('player-search').value=''; this.parentElement.style.display='none';" 
                 style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.8rem; font-weight: 600;">+ ${name}</div>
        `).join('');
    }
}

function renderWatchlistManager() {
    const list = document.getElementById('watchlist-items');
    if (!list) return;
    list.innerHTML = state.watchlist.map(id => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
            <span style="font-size:0.8rem; font-weight:700;">${state.playerLookup[id]}</span>
            <span onclick="toggleWatchlist(${id})" style="color:#ff005a; font-size:0.6rem; font-weight:800; cursor:pointer;">REMOVE</span>
        </div>`).join('') || '<div style="opacity:0.3; text-align:center; padding:20px; font-size:0.7rem;">Watchlist Empty</div>';
}

function checkForNotifications(game, goals) {
    [...goals.h, ...goals.a].forEach(stat => {
        const pId = stat.element;
        if (state.watchlist.includes(pId)) {
            const key = `${pId}_${game.id}`;
            if (stat.value > (state.lastProcessedStats[key] || 0)) {
                if (Notification.permission === "granted") {
                    new Notification("⚽ WATCHLIST GOAL!", { body: `${state.playerLookup[pId]} scored!` });
                }
                state.lastProcessedStats[key] = stat.value;
            }
        }
    });
}

// Global Start
document.addEventListener('DOMContentLoaded', initMatchCenter);
