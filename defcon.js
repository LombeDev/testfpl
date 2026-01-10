/**
 * KOPALA FPL - DEFENSIVE CONTRIBUTIONS CENTER
 * Integrated with same logic as Match Center
 */

async function updateDefCon() {
    const container = document.getElementById('defcon-list-container');
    if (!container) return;

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);

        let html = '';

        startedGames.forEach(game => {
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();

            // Extract relevant defensive stats from the 'stats' array
            const getStat = (id) => game.stats.find(s => s.identifier === id) || { h: [], a: [] };
            
            const clr = getStat('clearances'), blk = getStat('blocks'), 
                  int = getStat('interceptions'), tkl = getStat('tackles'),
                  rec = getStat('recoveries'), sav = getStat('saves');

            // Helper to aggregate CBIT/CBIRT per player
            const playerStats = {};

            const process = (statObj, weight = 1) => {
                [...statObj.h, ...statObj.a].forEach(item => {
                    if (!playerStats[item.element]) {
                        playerStats[item.element] = { id: item.element, total: 0, saves: 0 };
                    }
                    playerStats[item.element].total += (item.value * weight);
                });
            };

            // Process all defensive metrics
            [clr, blk, int, tkl, rec].forEach(s => process(s));
            [sav].forEach(s => {
                [...s.h, ...s.a].forEach(item => {
                    if (!playerStats[item.element]) playerStats[item.element] = { id: item.element, total: 0, saves: 0 };
                    playerStats[item.element].saves = item.value;
                });
            });

            // Filter players who are making an impact
            const topDefenders = Object.values(playerStats)
                .filter(p => p.total >= 5 || p.saves >= 1)
                .sort((a, b) => b.total - a.total);

            let matchDefHtml = '';
            topDefenders.forEach(p => {
                // Official FPL 25/26 Rule: Defenders threshold = 10, Mid/Fwd = 12
                // Since pos isn't in fixture stats, we use a general indicator
                const hasBonus = p.total >= 10; 
                const savePts = Math.floor(p.saves / 3);

                matchDefHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.7rem;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="width:6px; height:6px; border-radius:50%; background:${hasBonus ? '#00ff87' : '#37003c'}; opacity:${hasBonus ? '1' : '0.2'}"></span>
                            <span style="font-weight:700;">${playerLookup[p.id]}</span>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <span style="opacity:0.5;">${p.total} ${hasBonus ? '✔' : ''}</span>
                            ${savePts > 0 ? `<span style="color:#e9fc04; font-weight:900;">+${savePts}S</span>` : ''}
                        </div>
                    </div>`;
            });

            html += `
                <div class="defcon-match-row" style="margin-bottom:20px; border:1px solid #eee; border-radius:8px; overflow:hidden;">
                    <div style="background:#37003c; color:white; padding:6px 12px; display:flex; justify-content:space-between; font-size:0.65rem; font-weight:800;">
                        <span>${homeAbbr}</span>
                        <span>${game.team_h_score} - ${game.team_a_score}</span>
                        <span>${awayAbbr}</span>
                    </div>
                    <div style="padding:10px;">
                        <div style="font-size:0.5rem; font-weight:900; opacity:0.3; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Defensive Contributions & Saves</div>
                        ${matchDefHtml || '<span style="font-size:0.6rem; opacity:0.2;">No defensive actions recorded...</span>'}
                    </div>
                </div>`;
        });

        container.innerHTML = html || '<div style="text-align:center; opacity:0.3; padding:20px;">No matches live...</div>';
    } catch (err) {
        console.error("DefCon Engine Error:", err);
    }
}