/**
 * KOPALA FPL - PRO MATCH CENTER
 * Corrected Team Logos & Optimized Font Sizes
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        updateLiveScores();
    } catch (error) {
        console.error("Sync Error:", error);
    }
}

async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        if (isAnyMatchLive) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        let lastDateString = "";

        // Sort by kickoff time
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const matchDate = new Date(game.kickoff_time);
            const currentDateString = matchDate.toLocaleDateString('en-GB', { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });

            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header" style="font-size: 0.75rem; padding: 6px; margin-top: 10px;">${currentDateString}</div>`;
                lastDateString = currentDateString;
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
                    eventsHtml += `<div style="opacity:0.5; font-size:0.6rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Bonus Rank Logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:4px; margin-bottom:2px; font-size:0.65rem;">
                            <span style="background:${colors[i]}; color:#000; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span style="font-weight:700;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            const statusText = game.finished ? 'FULL TIME' : 'LIVE';
            const statusColor = game.finished ? '#f1f1f1' : '#00ff87';

            html += `
                <div class="fixture-card" style="margin-bottom:10px;">
                    <div style="background:${statusColor}; color:#000; text-align:center; padding:3px; font-weight:900; font-size:0.6rem; letter-spacing:0.5px;">${statusText}</div>
                    
                    <div class="fixture-content" style="padding: 8px;">
                        <div class="events-col" style="font-size: 0.65rem;">
                            ${eventsHtml || '<span style="opacity:0.2;">---</span>'}
                        </div>

                        <div class="score-col">
                            <div class="score-row" style="gap: 3px;">
                                <div class="team-unit">
                                    <span class="team-abbr" style="font-size: 0.7rem;">${teamLookup[game.team_h].substring(0,3)}</span>
                                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${game.team_h}.png" class="team-logo" style="width:18px; height:18px;" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                </div>
                                
                                <div class="score-box" style="font-size: 0.9rem; padding: 4px 8px; min-width: 50px;">
                                    ${game.team_h_score} - ${game.team_a_score}
                                </div>

                                <div class="team-unit">
                                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${game.team_a}.png" class="team-logo" style="width:18px; height:18px;" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                    <span class="team-abbr" style="font-size: 0.7rem;">${teamLookup[game.team_a].substring(0,3)}</span>
                                </div>
                            </div>
                            <span class="gw-label" style="font-size: 0.5rem;">GAMEREEEEK ${activeGameweek}</span>
                        </div>

                        <div class="bonus-col" style="padding: 5px; margin-left: 5px;">
                            <div class="bonus-header" style="font-size: 0.5rem; margin-bottom: 3px;">🏆 Bonus</div>
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Awaiting BPS...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error("Update Failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);
