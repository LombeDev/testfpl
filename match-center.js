/**
 * KOPALA FPL - PREMIUM MATCH CENTER (FINAL ENGINE)
 * Features: Live Clock, Text-Only Badges, Live BPS, Date Grouping
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// 1. INITIALIZE DATABASE
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Map Player Names and Team Names
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Find Active Gameweek
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        updateLiveScores();
    } catch (error) {
        console.error("Sync Error:", error);
    }
}

// 2. LIVE SCORE ENGINE
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        // Filter for started games
        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        // Auto-refresh every 60 seconds if a match is live
        if (isAnyMatchLive) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        let lastDateString = "";

        // Sort by Kickoff (Newest First)
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const currentDateString = kickoff.toLocaleDateString('en-GB', { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });

            // Add Date Header
            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header" style="font-size: 0.65rem; padding: 5px; margin-top: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // --- LIVE MINUTE CALCULATION ---
            let statusDisplay = game.finished ? 'FULL TIME' : 'LIVE';
            let isBlinking = false;

            if (!game.finished && game.started) {
                const now = new Date();
                const diffMs = now - kickoff;
                const diffMins = Math.floor(diffMs / 60000);
                isBlinking = true;

                if (diffMins <= 45) {
                    statusDisplay = `${diffMins}'`;
                } else if (diffMins > 45 && diffMins < 60) {
                    statusDisplay = `HT`;
                } else if (diffMins >= 60 && diffMins < 105) {
                    statusDisplay = `${diffMins - 15}'`;
                } else {
                    statusDisplay = `90+'`;
                }
            }

            // Scorer & Assist Logic
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let eventsHtml = '';
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div style="margin-bottom:1px;">⚽ ${playerLookup[s.element]}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div style="opacity:0.5; font-size:0.55rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Bonus Point Rank Logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:4px; margin-bottom:2px; font-size:0.6rem;">
                            <span style="background:${colors[i]}; color:#000; width:12px; height:12px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.45rem;">${3-i}</span>
                            <span style="font-weight:700;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            const statusColor = game.finished ? '#f8f8f8' : '#00ff87';

            html += `
                <div class="fixture-card" style="margin-bottom:8px; border: 1px solid #eee; background: #fff; border-radius: 8px; overflow: hidden;">
                    <div style="background:${statusColor}; color:#000; text-align:center; padding:3px; font-weight:900; font-size:0.55rem; letter-spacing:0.5px; border-bottom: 1px solid #eee; display: flex; justify-content: center; align-items: center; gap: 5px;">
                        ${statusDisplay}
                        ${isBlinking ? '<span style="width: 6px; height: 6px; background: #ff005a; border-radius: 50%; display: inline-block; animation: blink 1s infinite;"></span>' : ''}
                    </div>
                    
                    <div class="fixture-content" style="padding: 8px; display: flex; align-items: center; min-height: 60px;">
                        <div class="events-col" style="flex: 1; font-size: 0.6rem; border-right: 1px solid #f5f5f5; padding-right: 5px;">
                            ${eventsHtml || '<span style="opacity:0.2;">---</span>'}
                        </div>

                        <div class="score-col" style="flex: 1.5; text-align: center; padding: 0 10px;">
                            <div style="display: flex; justify-content: center; align-items: center; gap: 6px;">
                                <span style="font-weight: 800; font-size: 0.75rem; text-transform: uppercase; flex: 1; text-align: right; color: #37003c;">
                                    ${teamLookup[game.team_h].substring(0,3)}
                                </span>
                                
                                <div style="font-size: 1rem; font-weight: 900; background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-family: monospace; min-width: 45px;">
                                    ${game.team_h_score}-${game.team_a_score}
                                </div>

                                <span style="font-weight: 800; font-size: 0.75rem; text-transform: uppercase; flex: 1; text-align: left; color: #37003c;">
                                    ${teamLookup[game.team_a].substring(0,3)}
                                </span>
                            </div>
                            <div style="font-size: 0.45rem; font-weight: 800; opacity: 0.3; margin-top: 3px; letter-spacing: 1px;">GW ${activeGameweek}</div>
                        </div>

                        <div class="bonus-col" style="flex: 1; background: #fafafa; border-radius: 4px; padding: 5px; border-left: 1px solid #eee;">
                            <div style="font-size: 0.5rem; font-weight: 900; opacity: 0.4; margin-bottom: 3px; text-transform: uppercase;">🏆 Bonus</div>
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Awaiting...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error("Update Failed:", err);
    }
}

// Start the engine
document.addEventListener('DOMContentLoaded', initMatchCenter);