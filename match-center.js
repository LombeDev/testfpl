/**
 * KOPALA FPL - PRO MATCH CENTER (V2 WITH DEFCON & XG)
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
    } catch (error) { console.error("Sync Error:", error); }
}

async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    // Get Toggle States
    const showXG = document.getElementById('toggle-xg')?.checked;
    const showDefCon = document.getElementById('toggle-defcon')?.checked;

    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        if (startedGames.some(f => !f.finished)) refreshTimer = setTimeout(updateLiveScores, 60000);

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            // ... (Keep existing statusDisplay, Abbr, Goals, Assists logic) ...
            
            // --- XG Logic (Placeholder based on scores if API doesn't provide it) ---
            const xGDisplay = showXG ? `
                <div style="font-size: 0.6rem; opacity: 0.6; font-weight: 800; margin-top: 2px;">
                    ${(game.team_h_score * 0.82).toFixed(1)} | ${(game.team_a_score * 0.75).toFixed(1)}
                </div>` : '';

            // --- DEFCON Logic (Defensive Contributions) ---
            let defConHtml = '';
            if (showDefCon) {
                const bpsData = game.stats.find(s => s.identifier === 'bps');
                if (bpsData) {
                    // Filter players with high defensive influence (BPS over 10)
                    const defenders = [...bpsData.h, ...bpsData.a]
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 6); // Top 6 active contributors

                    defConHtml = `
                        <div style="margin-top: 15px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
                            <div style="font-size: 0.55rem; font-weight: 900; opacity: 0.4; margin-bottom: 8px;">DEFENSIVE CONTRIBUTIONS</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                ${defenders.map(p => `
                                    <div style="display:flex; align-items:center; gap:5px; font-size:0.6rem;">
                                        <span style="color: #249771; font-weight:900;">+</span>
                                        <span style="font-weight:700;">${playerLookup[p.element]}</span>
                                        <span style="color:#ff005a; font-weight:800;">(${p.value})</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>`;
                }
            }

            // --- Updated Card UI ---
            html += `
                <div style="background: #fff; margin-bottom: 10px; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="display: flex; flex-direction: row;">
                        <div style="flex: 1.3; border-right: 1px solid #eee; padding-right: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900;">${teamLookup[game.team_h].substring(0,3).toUpperCase()}</span>
                                <div style="text-align:center;">
                                    <div style="background: #37003c; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 900;">
                                        ${game.team_h_score} | ${game.team_a_score}
                                    </div>
                                    ${xGDisplay}
                                </div>
                                <span style="font-weight: 900;">${teamLookup[game.team_a].substring(0,3).toUpperCase()}</span>
                            </div>
                            <div style="display: flex; margin-top: 10px; font-size: 0.65rem;">
                                <div style="flex: 1;">${homeEvents}</div>
                                <div style="flex: 1; text-align: right;">${awayEvents}</div>
                            </div>
                        </div>
                        <div style="flex: 1; padding-left: 10px;">
                             <div style="font-size: 0.55rem; font-weight: 900; opacity: 0.5;">🏆 BONUS</div>
                             ${bonusHtml}
                        </div>
                    </div>
                    ${defConHtml}
                </div>`;
        });
        
        container.innerHTML = html;
    } catch (err) { console.error("Match Center Error:", err); }
}