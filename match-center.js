/**
 * KOPALA FPL - PRO MATCH CENTER (3-LETTER ABBREVIATION ENGINE)
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
        
        // Map Player Names
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        
        // Map Team Names
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

            // Date Group Header
            if (currentDateString !== lastDateString) {
                html += `<div style="color:#37003c; font-size:0.75rem; font-weight:800; margin: 20px 0 10px 5px; opacity:0.6; text-transform:uppercase;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            // Live Minute / Status Calculation
            let statusDisplay = game.finished ? 'FT' : 'LIVE';
            if (!game.finished && game.started) {
                const diffMins = Math.floor((new Date() - kickoff) / 60000);
                statusDisplay = diffMins < 45 ? `${diffMins}'` : (diffMins < 60 ? 'HT' : `${diffMins - 15}'`);
            }

            // Abbreviate Team Names to 3 Letters
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();

            // Match Events (Goals/Assists)
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let homeEvents = '', awayEvents = '';
            
            if (goals) {
                goals.h.forEach(s => homeEvents += `<div>${playerLookup[s.element]} ⚽</div>`);
                goals.a.forEach(s => awayEvents += `<div>⚽ ${playerLookup[s.element]}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => homeEvents += `<div style="opacity:0.4; font-size:0.55rem;">${playerLookup[s.element]} <span style="color:#ff005a">A</span></div>`);
                assists.a.forEach(s => awayEvents += `<div style="opacity:0.4; font-size:0.55rem;"><span style="color:#ff005a">A</span> ${playerLookup[s.element]}</div>`);
            }

            // Bonus Section
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.65rem;">
                            <span style="background:${colors[i]}; color:#000; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span style="font-weight:700;">${playerLookup[p.element]} <span style="opacity:0.3; font-weight:400;">${p.value}</span></span>
                        </div>`;
                });
            }

            // Simplified Split Layout (No Cards, Single Score)
            html += `
                <div style="display: flex; flex-direction: row; padding: 12px 0; margin-bottom: 2px; border-bottom: 1px solid #f8f8f8; min-height: 90px;">
                    <div style="flex: 1.3; padding-right: 12px; display: flex; flex-direction: column; border-right: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c; flex: 1;">${homeAbbr}</span>
                            <div style="background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 0.8rem; font-family: monospace;">
                                ${game.team_h_score} | ${game.team_a_score}
                            </div>
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c; flex: 1; text-align: right;">${awayAbbr}</span>
                        </div>

                        <div style="display: flex; gap: 8px; font-size: 0.65rem; flex-grow: 1;">
                            <div style="flex: 1; text-align: left; font-weight: 600;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right; font-weight: 600;">${awayEvents}</div>
                        </div>

                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                             <span style="font-size: 0.55rem; font-weight: 800; opacity: 0.2;">GW ${activeGameweek}</span>
                             <span style="font-size: 0.65rem; font-weight: 900; color:#37003c;">${statusDisplay}</span>
                        </div>
                    </div>

                    <div style="flex: 1; padding-left: 12px; display: flex; flex-direction: column;">
                        <div style="font-size: 0.55rem; font-weight: 900; color: #37003c; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; opacity: 0.5;">
                            🏆 BONUS <span style="width: 4px; height: 4px; background: ${game.finished ? '#ccc' : '#ff005a'}; border-radius: 50%;"></span>
                        </div>
                        <div style="flex-grow: 1;">
                            ${bonusHtml || '<span style="opacity:0.2; font-size:0.55rem;">Awaiting...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error("Match Center Engine Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);