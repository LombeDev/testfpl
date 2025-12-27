/**
 * KOPALA FPL - PRO MATCH CENTER (ORGANIZED SPLIT-VIEW)
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
        if (startedGames.some(f => !f.finished)) refreshTimer = setTimeout(updateLiveScores, 60000);

        let html = '';
        let lastDateString = "";
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const kickoff = new Date(game.kickoff_time);
            const currentDateString = kickoff.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

            if (currentDateString !== lastDateString) {
                html += `<div class="date-group-header" style="background:none; color:#37003c; border:none; box-shadow:none; text-align:left; padding-left:15px; font-size:0.75rem;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // Live Minute Logic
            let statusDisplay = game.finished ? 'FULL TIME' : 'LIVE';
            if (!game.finished && game.started) {
                const diffMins = Math.floor((new Date() - kickoff) / 60000);
                statusDisplay = diffMins < 45 ? `${diffMins}'` : (diffMins < 60 ? 'HT' : `${diffMins - 15}'`);
            }

            // Stats Parsing (Goals & Assists)
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let homeEvents = '', awayEvents = '';
            
            if (goals) {
                goals.h.forEach(s => homeEvents += `<div>${playerLookup[s.element]} ⚽</div>`);
                goals.a.forEach(s => awayEvents += `<div>⚽ ${playerLookup[s.element]}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => homeEvents += `<div style="opacity:0.5; font-size:0.55rem;">${playerLookup[s.element]} <span style="color:#ff005a">A</span></div>`);
                assists.a.forEach(s => awayEvents += `<div style="opacity:0.5; font-size:0.55rem;"><span style="color:#ff005a">A</span> ${playerLookup[s.element]}</div>`);
            }

            // Bonus Parsing
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px; font-size:0.65rem;">
                            <span style="background:${colors[i]}; color:#000; width:14px; height:14px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span style="font-weight:700;">${playerLookup[p.element]} <span style="opacity:0.4; font-weight:400;">${p.value}</span></span>
                        </div>`;
                });
            }

            html += `
                <div class="fixture-card" style="display: flex; flex-direction: row; padding: 0; min-height: 160px; margin-bottom: 15px;">
                    <div style="flex: 1.5; padding: 12px; display: flex; flex-direction: column; position: relative; border-right: 1px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="font-weight: 800; font-size: 0.7rem; max-width: 60px;">${teamLookup[game.team_h]}</div>
                            <div style="background: #37003c; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 0.7rem;">${game.team_h_score} | ${game.team_a_score}</div>
                            <div style="font-weight: 800; font-size: 0.7rem; text-align: right; max-width: 60px;">${teamLookup[game.team_a]}</div>
                        </div>

                        <div style="display: flex; gap: 10px; font-size: 0.65rem; margin-top: 5px; flex-grow: 1;">
                            <div style="flex: 1; text-align: left; font-weight: 700;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right; font-weight: 700;">${awayEvents}</div>
                        </div>

                        <div style="margin-top: auto; border-top: 1px solid #f9f9f9; padding-top: 8px; text-align: left;">
                             <div style="display: inline-block; background: #37003c; color: white; padding: 5px 15px; border-radius: 6px; font-weight: 900; font-size: 1.1rem; letter-spacing: 2px;">
                                ${game.team_h_score} | ${game.team_a_score}
                             </div>
                             <div style="font-size: 0.5rem; font-weight: 800; opacity: 0.3; margin-top: 4px; text-transform: uppercase;">GW ${activeGameweek}</div>
                             <div style="font-size: 0.65rem; font-weight: 800; color: #37003c; margin-top: 5px;">${statusDisplay}</div>
                        </div>
                    </div>

                    <div style="flex: 1; padding: 12px; background: #fafafa; display: flex; flex-direction: column;">
                        <div style="font-size: 0.6rem; font-weight: 900; color: #37003c; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                            🏆 BONUS <span style="width: 5px; height: 5px; background: ${game.finished ? '#ccc' : 'red'}; border-radius: 50%;"></span>
                        </div>
                        <div style="flex-grow: 1;">
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Calculating...</span>'}
                        </div>
                        <div style="margin-top: auto; font-size: 0.55rem; color: #999; font-weight: 700; text-align: right;">More ▾</div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error("Layout Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);