/**
 * KOPALA FPL - PRO MATCH CENTER (PROXY + CACHE OPTIMIZED)
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
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
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        let lastDateString = "";
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const matchDate = new Date(game.kickoff_time);
            const currentDateString = matchDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header" style="font-size: 0.7rem; opacity: 0.8; margin: 10px 0 5px;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // Stats Logic
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let eventsHtml = '';
            if (goals) [...goals.h, ...goals.a].forEach(s => eventsHtml += `<div>⚽ ${playerLookup[s.element]}</div>`);
            if (assists) [...assists.h, ...assists.a].forEach(s => eventsHtml += `<div style="opacity:0.5; font-size:0.55rem;">👟 ${playerLookup[s.element]}</div>`);

            // Bonus Rank Logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:4px; margin-bottom:1px; font-size:0.6rem;">
                            <span style="background:${colors[i]}; color:#000; width:12px; height:12px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span>${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            const statusText = game.finished ? 'FULL TIME' : 'LIVE';
            const statusColor = game.finished ? '#222' : '#00ff87';

            html += `
                <div class="fixture-card" style="margin-bottom:8px; border: 1px solid #333;">
                    <div style="background:${statusColor}; color:${game.finished ? '#aaa' : '#000'}; text-align:center; padding:2px; font-weight:900; font-size:0.55rem;">${statusText}</div>
                    
                    <div class="fixture-content" style="padding: 6px; display: flex; align-items: center;">
                        <div class="events-col" style="font-size: 0.6rem; flex: 1;">
                            ${eventsHtml || '---'}
                        </div>

                        <div class="score-col" style="flex: 2; text-align: center;">
                            <div class="score-row" style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <div style="display: flex; flex-direction: column; align-items: center; width: 40px;">
                                    <img src="/fpl-crest/${game.team_h}.png" style="width:18px; height:18px;" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                    <span style="font-size: 0.65rem; font-weight: bold;">${teamLookup[game.team_h].substring(0,3)}</span>
                                </div>
                                
                                <div style="font-size: 0.85rem; font-weight: 900; background: #111; padding: 4px 10px; border-radius: 4px;">
                                    ${game.team_h_score} - ${game.team_a_score}
                                </div>

                                <div style="display: flex; flex-direction: column; align-items: center; width: 40px;">
                                    <img src="/fpl-crest/${game.team_a}.png" style="width:18px; height:18px;" onerror="this.src='https://fantasy.premierleague.com/static/libs/fpl-crest.png'">
                                    <span style="font-size: 0.65rem; font-weight: bold;">${teamLookup[game.team_a].substring(0,3)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="bonus-col" style="flex: 1; border-left: 1px solid #333; padding-left: 8px;">
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.5rem;">Waiting...</span>'}
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
