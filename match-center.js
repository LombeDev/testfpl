/**
 * KOPALA FPL - AI PRO MATCH CENTER
 * Persistence Logic: Shows ended matches until the next GW begins.
 */

const FPL_PROXY = "/fpl-api/"; 

let state = {
    playerLookup: {},
    teamLookup: {},
    activeGameweek: null,
    refreshTimer: null,
    watchlist: JSON.parse(localStorage.getItem('fpl_watchlist')) || [],
    lastProcessedStats: {}
};

/**
 * 1. Initialize System with Persistence
 */
async function initMatchCenter() {
    const container = document.getElementById('fixtures-container');
    
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        const data = await response.json();
        
        state.playerLookup = Object.fromEntries(data.elements.map(p => [p.id, p.web_name]));
        state.teamLookup = Object.fromEntries(data.teams.map(t => [t.id, { name: t.name, short: t.short_name }]));
        
        // PERSISTENCE LOGIC: 
        // 1. Look for the 'current' GW.
        // 2. If the current GW is finished, we keep it as active until the 'next' GW starts.
        const currentEvent = data.events.find(e => e.is_current);
        const nextEvent = data.events.find(e => e.is_next);

        // If current exists, use it. If not (very rare), use the last finished one.
        state.activeGameweek = currentEvent ? currentEvent.id : (data.events.filter(e => e.finished).pop()?.id || 1);

        console.log(`AI Engine: Showing Gameweek ${state.activeGameweek}`);

        updateLiveScores();
        renderWatchlistManager();
        
    } catch (error) {
        console.error("AI Sync Error:", error);
        if (container) container.innerHTML = `<div style="text-align:center; padding:20px; font-size:0.7rem;">Syncing...</div>`;
        setTimeout(initMatchCenter, 5000);
    }
}

/**
 * 2. Main Render Engine
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveIndicator = document.getElementById('live-indicator');
    if (!container) return;

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${state.activeGameweek}`);
        const fixtures = await response.json();
        
        // Sorting: Live > Finished > Upcoming
        const sortedGames = fixtures.sort((a, b) => {
            if (a.started && !a.finished && (!b.started || b.finished)) return -1;
            if (a.finished && !b.finished && !b.started) return -1;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
        });

        const anyLive = fixtures.some(f => f.started && !f.finished);
        if (liveIndicator) {
            anyLive ? liveIndicator.classList.remove('hidden') : liveIndicator.classList.add('hidden');
        }

        let html = '';
        let lastDateString = "";

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const dateStr = kickoff.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            if (dateStr !== lastDateString) {
                html += `<div style="color:#37003c; font-size:0.7rem; font-weight:800; margin: 15px 0 8px 5px; opacity:0.5; text-transform:uppercase;">${dateStr}</div>`;
                lastDateString = dateStr;
            }

            const home = state.teamLookup[game.team_h];
            const away = state.teamLookup[game.team_a];
            
            // Smarter Status Label
            let status = "PRE";
            if (game.finished) status = "FT";
            else if (game.started) status = `${game.minutes}'`;

            const goals = game.stats.find(s => s.identifier === 'goals_scored') || {h:[], a:[]};
            const assists = game.stats.find(s => s.identifier === 'assists') || {h:[], a:[]};
            const bps = game.stats.find(s => s.identifier === 'bps') || {h:[], a:[]};

            const renderEvents = (players, isGoal) => players.map(s => {
                const isWatched = state.watchlist.includes(s.element);
                return `<div style="margin-bottom:2px;">${isWatched ? '★' : '☆'} ${state.playerLookup[s.element]} ${isGoal ? '⚽' : '<small style="color:#ff005a">A</small>'}</div>`;
            }).join('');

            const topBps = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
            const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
            const bonusHtml = topBps.map((p, i) => `
                <div style="margin-bottom:6px; font-size:0.65rem; display:flex; align-items:center; gap:5px;">
                    <span style="background:${colors[i]}; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                    <span style="font-weight:700; color:#37003c;">${state.playerLookup[p.element]}</span>
                    <span style="opacity:0.3;">${p.value}</span>
                </div>`).join('');

            html += `
                <div style="display: flex; padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
                    <div style="flex: 1.4; border-right: 1px solid #eee; padding-right: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 900; font-size: 0.8rem;">${home.short}</span>
                            <div style="background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-family: monospace; font-size:0.75rem;">
                                ${game.team_h_score ?? 0} - ${game.team_a_score ?? 0}
                            </div>
                            <span style="font-weight: 900; font-size: 0.8rem; text-align: right;">${away.short}</span>
                        </div>
                        <div style="display: flex; gap: 8px; font-size: 0.6rem; min-height: 20px;">
                            <div style="flex: 1;">${renderEvents(goals.h, true)}${renderEvents(assists.h, false)}</div>
                            <div style="flex: 1; text-align: right;">${renderEvents(goals.a, true)}${renderEvents(assists.a, false)}</div>
                        </div>
                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                             <span style="font-size: 0.55rem; opacity: 0.3; font-weight: 800;">GAMEDAY</span>
                             <span style="font-size: 0.65rem; font-weight: 900; color:#ff005a;">${status}</span>
                        </div>
                    </div>
                    <div style="flex: 1; padding-left: 12px;">
                        <div style="font-size: 0.55rem; font-weight: 900; color: #37003c; margin-bottom: 6px; opacity: 0.4;">BONUS POINTS</div>
                        ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Awaiting...</span>'}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        
        // Polling: Fast (30s) if live, Slow (10m) if games are finished.
        clearTimeout(state.refreshTimer);
        state.refreshTimer = setTimeout(updateLiveScores, anyLive ? 30000 : 600000);

    } catch (err) { console.error(err); }
}

// Watchlist Logic (Keep your existing toggleWatchlist and renderWatchlistManager functions)

document.addEventListener('DOMContentLoaded', initMatchCenter);
