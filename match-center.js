/**
 * KOPALA FPL - PRO MATCH CENTER (FULL ENGINE 2025/26)
 * Fixes: Official Team Badges, Date Grouping, Live BPS, Refresh Logic
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

/**
 * 1. INITIALIZE DATABASE
 * Syncs team names and player names for IDs
 */
async function initMatchCenter() {
    try {
        console.log("Syncing with FPL Database...");
        
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Build Lookup Tables
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Identify Current/Active Gameweek
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        console.log("Database Synced. Active GW:", activeGameweek);
        
        // Load initial scores
        updateLiveScores();

    } catch (error) {
        console.error("Critical Sync Error:", error);
        const container = document.getElementById('fixtures-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#ff4d4d; font-weight:bold;">
                    ⚠️ DATABASE SYNC ERROR<br>
                    <span style="font-size:0.8rem; font-weight:normal; opacity:0.7;">
                        Check your Netlify /fpl-api/ proxy configuration.
                    </span>
                </div>`;
        }
    }
}

/**
 * 2. LIVE SCORE ENGINE
 * Fetches fixtures and builds the Match Center UI
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const refreshIcon = document.getElementById('refresh-icon');
    
    if (!container) return;
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        // Sort: We want the newest/active games at the top
        const startedGames = fixtures.filter(f => f.started);
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        if (sortedGames.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px; opacity:0.5;">
                    <i class="fa-regular fa-calendar-xmark" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>No matches have started yet for Gameweek ${activeGameweek}.</p>
                </div>`;
            return;
        }

        // Auto-refresh logic: If games are live, refresh every 60s
        const isAnyMatchLive = sortedGames.some(f => !f.finished);
        if (isAnyMatchLive) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        let lastDateString = "";

        sortedGames.forEach(game => {
            // A. Handle Date Headers (Friday, Saturday, etc.)
            const matchDate = new Date(game.kickoff_time);
            const currentDateString = matchDate.toLocaleDateString('en-GB', { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });

            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // B. Extract Scorer and Assist Stats
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let eventsHtml = '';
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div>⚽ ${playerLookup[s.element]}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div style="opacity:0.5; font-size:0.65rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // C. Extract Live Bonus Points (BPS)
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const topThree = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                topThree.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; font-size:0.7rem;">
                            <span style="background:${medalColors[i]}; color:#000; width:14px; height:14px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.55rem;">${3-i}</span>
                            <span style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            // D. UI Logic for Status
            const statusText = game.finished ? 'FULL TIME' : (game.finished_provisional ? 'PROVISIONAL' : 'LIVE');
            const statusColor = game.finished ? '#f1f1f1' : '#00ff87';

            // E. Build the Fixture Card
            html += `
                <div class="fixture-card">
                    <div style="background:${statusColor}; color:#000; text-align:center; padding:4px; font-weight:900; font-size:0.65rem; letter-spacing:0.5px;">${statusText}</div>
                    
                    <div class="fixture-content">
                        <div class="events-col">
                            ${eventsHtml || '<span style="opacity:0.2;">---</span>'}
                        </div>

                        <div class="score-col">
                            <div class="score-row">
                                <div class="team-unit">
                                    <span class="team-abbr">${teamLookup[game.team_h].substring(0,3)}</span>
                                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${game.team_h}.png" class="team-logo" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                </div>
                                
                                <div class="score-box">
                                    ${game.team_h_score} - ${game.team_a_score}
                                </div>

                                <div class="team-unit">
                                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${game.team_a}.png" class="team-logo" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                    <span class="team-abbr">${teamLookup[game.team_a].substring(0,3)}</span>
                                </div>
                            </div>
                            <span class="gw-label">GAMEREEEEK ${activeGameweek}</span>
                        </div>

                        <div class="bonus-col">
                            <div class="bonus-header">🏆 Bonus</div>
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.6rem;">Awaiting BPS...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;

    } catch (err) {
        console.error("Match Update Failed:", err);
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove('fa-spin'), 1000);
        }
    }
}

// BOOTSTRAP: Start the engine when page loads
document.addEventListener('DOMContentLoaded', initMatchCenter);
