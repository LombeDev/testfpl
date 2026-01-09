/**
 * KOPALA FPL - AI PRO MATCH CENTER
 * Custom integrated for your HTML structure.
 */

const FPL_PROXY = "/fpl-api/"; 

let state = {
    playerLookup: {},
    teamLookup: {},
    activeGameweek: null,
    refreshTimer: null,
    isInitialLoad: true,
    watchlist: JSON.parse(localStorage.getItem('fpl_watchlist')) || [],
    lastProcessedStats: {},
};

async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        const data = await response.json();
        
        state.playerLookup = Object.fromEntries(data.elements.map(p => [p.id, p.web_name]));
        state.teamLookup = Object.fromEntries(data.teams.map(t => [t.id, { name: t.name, short: t.short_name }]));
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        state.activeGameweek = current ? current.id : 1;

        updateLiveScores();
        renderWatchlistManager();
    } catch (error) {
        console.error("Sync Error:", error);
    }
}

/**
 * AI Logic: Analyzes match momentum to predict bonus points
 */
function getAIInsights(playerBps, game) {
    if (!game.started || game.finished) return "";
    
    // AI Prediction for "Bonus Locking"
    if (game.minutes > 80 && playerBps > 28) {
        return `<div style="color:#00ff87; font-size:0.5rem; font-weight:900; margin-top:2px;">✦ AI: BONUS LOCKED</div>`;
    }
    // AI Prediction for "Bonus Threat" (High BPS early in the game)
    if (game.minutes < 45 && playerBps > 15) {
        return `<div style="color:#37003c; font-size:0.5rem; font-weight:900; opacity:0.5; margin-top:2px;">✦ AI: BONUS THREAT</div>`;
    }
    return "";
}

async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveIndicator = document.getElementById('live-indicator');
    if (!container) return;

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${state.activeGameweek}`);
        const fixtures = await response.json();
        
        const sortedGames = fixtures.sort((a, b) => {
            if (a.started && !a.finished && (!b.started || b.finished)) return -1;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
        });

        // AI Feature: Toggle your "LIVE" pulse indicator automatically
        const isAnythingLive = fixtures.some(f => f.started && !f.finished);
        if (liveIndicator) {
            isAnythingLive ? liveIndicator.classList.remove('hidden') : liveIndicator.classList.add('hidden');
        }

        let html = '';
        let lastDateString = "";

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            if (dateStr !== lastDateString) {
                html += `<div style="color:#37003c; font-size:0.75rem; font-weight:800; margin: 20px 0 10px 5px; opacity:0.6; text-transform:uppercase;">${dateStr}</div>`;
                lastDateString = dateStr;
            }

            const status = getMatchStatus(game);
            const homeAbbr = state.teamLookup[game.team_h].short;
            const awayAbbr = state.teamLookup[game.team_a].short;

            const goals = game.stats.find(s => s.identifier === 'goals_scored') || {h:[], a:[]};
            const assists = game.stats.find(s => s.identifier === 'assists') || {h:[], a:[]};
            const bps = game.stats.find(s => s.identifier === 'bps') || {h:[], a:[]};

            // Watchlist Notification Trigger
            checkForWatchlistEvents(game, goals);

            const renderSet = (players, isGoal) => players.map(s => {
                const isWatched = state.watchlist.includes(s.element);
                const star = `<span onclick="toggleWatchlist(${s.element})" style="cursor:pointer; font-size:0.75rem; margin-right:4px;">${isWatched ? '★' : '☆'}</span>`;
                return `<div style="margin-bottom:2px;">${star}${state.playerLookup[s.element]} ${isGoal ? '⚽' : '<span style="color:#ff005a">A</span>'}</div>`;
            }).join('');

            const homeEvents = renderSet(goals.h, true) + renderSet(assists.h, false);
            const awayEvents = renderSet(goals.a, true) + renderSet(assists.a, false);

            const topBps = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
            const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
            const bonusHtml = topBps.map((p, i) => `
                <div style="margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:6px; font-size:0.65rem;">
                        <span style="background:${colors[i]}; color:#000; width:14px; height:14px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.55rem;">${3-i}</span>
                        <span style="font-weight:800; color:#37003c;">${state.playerLookup[p.element]} <span style="opacity:0.4;">${p.value}</span></span>
                    </div>
                    ${getAIInsights(p.value, game)}
                </div>`).join('');

            html += `
                <div style="display: flex; padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                    <div style="flex: 1.4; padding-right: 12px; border-right: 1px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 900; font-size: 0.85rem; color:#37003c;">${homeAbbr}</span>
                            <div style="background: #37003c; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: 900; font-family: monospace; font-size:0.8rem;">
                                ${game.team_h_score} - ${game.team_a_score}
                            </div>
                            <span style="font-weight: 900; font-size: 0.85rem; color:#37003c; text-align: right;">${awayAbbr}</span>
                        </div>
                        <div style="display: flex; gap: 10px; font-size: 0.65rem; min-height: 25px;">
                            <div style="flex: 1; text-align: left; font-weight:600;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right; font-weight:600;">${awayEvents}</div>
                        </div>
                        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                             <span style="font-size: 0.55rem; opacity: 0.4; font-weight: 800;">GW${state.activeGameweek}</span>
                             <span style="font-size: 0.7rem; font-weight: 900; color:#ff005a;">${status}</span>
                        </div>
                    </div>
                    <div style="flex: 1; padding-left: 15px;">
                        <div style="font-size: 0.55rem; font-weight: 900; color: #37003c; margin-bottom: 8px; opacity: 0.5; letter-spacing: 0.5px;">PROJECTED POINTS</div>
                        ${bonusHtml || '<span style="opacity:0.2; font-size:0.6rem;">Calculating...</span>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
        clearTimeout(state.refreshTimer);
        state.refreshTimer = setTimeout(updateLiveScores, 60000);
    } catch (err) { console.error("Match Engine Error:", err); }
}

// Watchlist Logic (Handles your IDs: player-search, search-results, watchlist-items)
function toggleWatchlist(playerId) {
    const idx = state.watchlist.indexOf(playerId);
    if (idx > -1) state.watchlist.splice(idx, 1);
    else {
        state.watchlist.push(playerId);
        if (Notification.permission !== "granted") Notification.requestPermission();
    }
    localStorage.setItem('fpl_watchlist', JSON.stringify(state.watchlist));
    renderWatchlistManager();
    updateLiveScores();
}

function handleSearch(query) {
    const results = document.getElementById('search-results');
    if (query.length < 2) { results.style.display = 'none'; return; }
    
    const matches = Object.entries(state.playerLookup)
        .filter(([id, name]) => name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);

    if (matches.length > 0) {
        results.style.display = 'block';
        results.innerHTML = matches.map(([id, name]) => `
            <div onclick="toggleWatchlist(${parseInt(id)}); document.getElementById('player-search').value=''; this.parentElement.style.display='none';" 
                 style="padding: 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 0.8rem; font-weight:600;">+ ${name}</div>
        `).join('');
    }
}

function renderWatchlistManager() {
    const list = document.getElementById('watchlist-items');
    if (!list) return;
    list.innerHTML = state.watchlist.map(id => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f8f8f8;">
            <span style="font-size:0.8rem; font-weight:700; color:#37003c;">${state.playerLookup[id]}</span>
            <button onclick="toggleWatchlist(${id})" style="background:none; border:1px solid #ff005a; color:#ff005a; border-radius:4px; padding:4px 8px; font-size:0.6rem; cursor:pointer; font-weight:800;">REMOVE</button>
        </div>
    `).join('') || '<div style="opacity:0.3; font-size:0.7rem; text-align:center; padding:20px;">Your Watchlist is empty</div>';
}

function getMatchStatus(game) {
    if (game.finished) return "FINISHED";
    if (!game.started) return "UPCOMING";
    return game.minutes > 0 ? `${game.minutes}'` : "LIVE";
}

function checkForWatchlistEvents(game, goals) {
    [...goals.h, ...goals.a].forEach(stat => {
        const pId = stat.element;
        if (state.watchlist.includes(pId)) {
            const key = `p${pId}-g${game.id}`;
            if (stat.value > (state.lastProcessedStats[key] || 0)) {
                new Notification("⚽ GOAL ALERT!", { 
                    body: `${state.playerLookup[pId]} has scored!`,
                    icon: 'https://resources.premierleague.com/premierleague/badges/50/t1.png'
                });
                state.lastProcessedStats[key] = stat.value;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', initMatchCenter);
