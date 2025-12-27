/**
 * KOPALA FPL - PRO MATCH CENTER (FULL ENGINE)
 * Features: Netlify Proxy, Team Logos, Date Grouping, Live BPS
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// 1. INITIALIZE DATABASE
async function initMatchCenter() {
    try {
        console.log("Syncing with FPL Database...");
        
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Build Lookup Tables
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Identify Current Gameweek
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        console.log("Database Synced. GW:", activeGameweek);
        
        // Load initial scores
        updateLiveScores();

    } catch (error) {
        console.error("Critical Sync Error:", error);
        const container = document.getElementById('fixtures-container');
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4d4d;">
                <strong>CONNECTION ERROR</strong><br>Check _redirects and Netlify deployment.
            </div>`;
        }
    }
}

// 2. LIVE SCORE ENGINE
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    const refreshIcon = document.getElementById('refresh-icon');
    
    if (!container) return;
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        // Filter: Started matches only
        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        if (startedGames.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.5; padding:30px;">No matches started yet for GW ${activeGameweek}.</p>`;
            return;
        }

        // Smart Refresh: Every 60 seconds if live matches exist
        if (isAnyMatchLive) {
            if (liveTag) liveTag.classList.remove('hidden');
            refreshTimer = setTimeout(updateLiveScores, 60000);
        } else {
            if (liveTag) liveTag.classList.add('hidden');
        }

        // 3. GROUP BY DATE & RENDER
        let html = '';
        let lastDateString = "";

        // Sort: Newest matches first
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            // Check for Date Header
            const matchDate = new Date(game.kickoff_time);
            const currentDateString = matchDate.toLocaleDateString('en-GB', { 
                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' 
            });

            if (currentDateString !== lastDateString) {
                html += `<div style="background:linear-gradient(90deg, #00ff87, #00ebff); color:#000; text-align:center; padding:8px; font-weight:900; font-size:0.85rem; border-radius:8px; margin: 15px 0 10px 0; letter-spacing:1px;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // Scorer & Assist Logic
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let eventsHtml = '';
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div style="margin-bottom:2px;">⚽ ${playerLookup[s.element]}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div style="opacity:0.6; font-size:0.7rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Bonus Points logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.7rem;">
                            <span style="background:${colors[i]}; color:#000; width:15px; height:15px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-weight:900; font-size:0.6rem;">${3-i}</span>
                            <span style="font-weight:700; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            const statusText = game.finished ? 'FINAL RESULT' : 'LIVE MATCH';
            const statusColor = game.finished ? '#f1f1f1' : '#00ff87';

            // Build the card HTML
            html += `
                <div class="fixture-card" style="margin-bottom:12px; background:#fff; border-radius:12px; overflow:hidden; border: 1px solid #eee; box-shadow: 0 4px 10px rgba(0,0,0,0.04);">
                    <div style="background:${statusColor}; color:#000; text-align:center; padding:4px; font-weight:900; font-size:0.65rem; letter-spacing:0.5px;">${statusText}</div>
                    
                    <div class="fixture-content" style="display:flex; padding:10px; min-height:90px; align-items:stretch;">
                        <div class="events-col" style="flex:1; border-right:1px solid #f5f5f5; padding-right:8px; font-size:0.75rem; display:flex; flex-direction:column; justify-content:center;">
                            ${eventsHtml || '<span style="opacity:0.2;">---</span>'}
                        </div>

                        <div class="score-col" style="flex:2.2; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:150px;">
                            <div style="display:flex; align-items:center; gap:5px; width:100%; justify-content:center;">
                                <div style="display:flex; align-items:center; gap:4px; flex:1; justify-content:flex-end;">
                                    <span style="font-weight:900; font-size:0.75rem;">${teamLookup[game.team_h].substring(0,3)}</span>
                                    <img src="https://resources.premierleague.com/premierleague/badges/t${game.team_h}.png" style="width:22px; height:22px;" alt="">
                                </div>
                                <div style="background:#37003c; color:#fff; padding:6px 10px; border-radius:6px; font-family:monospace; font-weight:900; font-size:1.1rem; white-space:nowrap; min-width:55px; text-align:center;">
                                    ${game.team_h_score} - ${game.team_a_score}
                                </div>
                                <div style="display:flex; align-items:center; gap:4px; flex:1; justify-content:flex-start;">
                                    <img src="https://resources.premierleague.com/premierleague/badges/t${game.team_a}.png" style="width:22px; height:22px;" alt="">
                                    <span style="font-weight:900; font-size:0.75rem;">${teamLookup[game.team_a].substring(0,3)}</span>
                                </div>
                            </div>
                            <span style="font-size:0.55rem; font-weight:800; opacity:0.3; margin-top:4px; letter-spacing:1px;">GAMEREWEEEEK ${activeGameweek}</span>
                        </div>

                        <div class="bonus-col" style="flex:1.2; background:#f9f9f9; border-radius:8px; padding:8px; margin-left:8px; display:flex; flex-direction:column; justify-content:center;">
                            <div style="font-size:0.55rem; font-weight:900; opacity:0.4; margin-bottom:5px; text-transform:uppercase;">🏆 Bonus</div>
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.6rem;">Awaiting BPS...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;

    } catch (err) {
        console.error("Match Update Failed:", err);
    } finally {
        if (refreshIcon) setTimeout(() => refreshIcon.classList.remove('fa-spin'), 800);
    }
}

// Start
document.addEventListener('DOMContentLoaded', initMatchCenter);
