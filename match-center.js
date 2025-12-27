/**
 * KOPALA FPL - PRO MATCH CENTER (FINAL STABLE VERSION)
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

        // Build mapping for Players and Teams
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Find current gameweek
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        updateLiveScores();
    } catch (error) {
        console.error("Critical Sync Error:", error);
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

        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        // Auto-refresh every 60s if live
        if (isAnyMatchLive) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        let lastDateString = "";

        // Sort: Latest matches at the top
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const currentDateString = kickoff.toLocaleDateString('en-GB', { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });

            // Date Grouping Header
            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // Live Minute Logic
            let statusDisplay = game.finished ? 'FINAL RESULT' : 'LIVE';
            let isBlinking = false;
            if (!game.finished && game.started) {
                isBlinking = true;
                const diffMins = Math.floor((new Date() - kickoff) / 60000);
                if (diffMins <= 45) statusDisplay = `${diffMins}'`;
                else if (diffMins > 45 && diffMins < 60) statusDisplay = `HT`;
                else if (diffMins >= 60 && diffMins < 105) statusDisplay = `${diffMins - 15}'`;
                else statusDisplay = `90+'`;
            }

            // Scorer and Assist Events
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
                    eventsHtml += `<div style="opacity:0.5; font-size:0.6rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Bonus Points Logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:4px; margin-bottom:2px; font-size:0.65rem;">
                            <span style="background:${colors[i]}; color:#000; width:14px; height:14px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.55rem;">${3-i}</span>
                            <span style="font-weight:700;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            // Final Card Template using your CSS Classes
            html += `
                <div class="fixture-card">
                    <div style="background:#f1f1f1; color:#000; text-align:center; padding:4px; font-weight:900; font-size:0.6rem; letter-spacing:1px; text-transform:uppercase; border-bottom: 1px solid #eee;">
                        ${statusDisplay} ${isBlinking ? '<span style="width:5px; height:5px; background:red; border-radius:50%; display:inline-block; animation:blink 1s infinite;"></span>' : ''}
                    </div>
                    
                    <div class="fixture-content">
                        <div class="events-col">
                            ${eventsHtml || '<span style="opacity:0.2;">---</span>'}
                        </div>

                        <div class="score-col">
                            <div class="score-row">
                                <span class="team-abbr">${teamLookup[game.team_h].substring(0,3)}</span>
                                <div class="score-box">${game.team_h_score} - ${game.team_a_score}</div>
                                <span class="team-abbr">${teamLookup[game.team_a].substring(0,3)}</span>
                            </div>
                            <span class="gw-label">GAMEREEEEK ${activeGameweek}</span>
                        </div>

                        <div class="bonus-col">
                            <div class="bonus-header">🏆 Bonus</div>
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Waiting...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error("Match Center Update Failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);