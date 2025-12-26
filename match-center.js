/**
 * KOPALA FPL - LIVE MATCH CENTER ENGINE
 * Handles: Player Mapping, Live Scores, and Real-time BPS
 */

const MATCH_CONFIG = {
    proxy: "https://corsproxy.io/?",
    base: "https://fantasy.premierleague.com/api/"
};

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;

// 1. INITIALIZE DATA (Run once on load)
async function initMatchCenter() {
    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'bootstrap-static/')}`;
        const response = await fetch(url);
        const data = await response.json();

        // Create fast-lookup dictionaries
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Find the current active gameweek
        const current = data.events.find(e => e.is_current);
        activeGameweek = current ? current.id : (data.events.find(e => !e.finished)?.id || 1);

        console.log("Match Center Initialized. GW:", activeGameweek);
        
        // Initial Fetch
        updateLiveScores();
        // Refresh every 60 seconds
        setInterval(updateLiveScores, 60000);

    } catch (error) {
        console.error("Initialization failed:", error);
    }
}

// 2. FETCH & RENDER LIVE SCORES
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    
    if (!container) return;

    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'fixtures/?event=' + activeGameweek)}`;
        const response = await fetch(url);
        const fixtures = await response.json();

        // Filter for games that are currently being played
        const liveGames = fixtures.filter(f => f.started && !f.finished);

        if (liveGames.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding: 20px;">No matches currently live.</p>`;
            if (liveTag) liveTag.classList.add('hidden');
            return;
        }

        if (liveTag) liveTag.classList.remove('hidden');
        container.innerHTML = '';

        liveGames.forEach(game => {
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            const bps = game.stats.find(s => s.identifier === 'bps');

            let eventsHtml = '';
            let bonusHtml = '';

            // Process Goals/Assists
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div class="event-item">⚽ ${playerLookup[s.element]}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div class="event-item" style="opacity:0.6;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Process Live Bonus Points (BPS)
            if (bps) {
                const topPerformers = [...bps.h, ...bps.a]
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3);

                topPerformers.forEach((p, index) => {
                    const pts = [3, 2, 1][index];
                    bonusHtml += `
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:2px;">
                            <span>${playerLookup[p.element]}</span>
                            <span style="color:var(--fpl-primary); font-weight:800;">+${pts}</span>
                        </div>`;
                });
            }

            // Build Fixture Card
            container.innerHTML += `
                <div class="fixture-row" style="padding:15px 0; border-bottom:1px solid var(--fpl-border);">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
                        <span style="flex:1; text-align:right; font-size:0.85rem;">${teamLookup[game.team_h]}</span>
                        <span style="margin:0 15px; background:var(--fpl-on-container); color:white; padding:3px 10px; border-radius:6px; font-family:monospace; min-width:40px; text-align:center;">
                            ${game.team_h_score} - ${game.team_a_score}
                        </span>
                        <span style="flex:1; font-size:0.85rem;">${teamLookup[game.team_a]}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-top: 12px;">
                        <div class="event-log">${eventsHtml || '<span style="opacity:0.3; font-size:0.7rem;">Waiting for events...</span>'}</div>
                        <div style="background:var(--fpl-surface); padding:10px; border-radius:12px; border: 1px dashed var(--fpl-primary);">
                            <p style="font-size:0.55rem; font-weight:900; margin:0 0 5px 0; opacity:0.6; text-transform:uppercase;">Live Bonus</p>
                            ${bonusHtml}
                        </div>
                    </div>
                </div>`;
        });
    } catch (err) {
        console.error("Match Center Update Error:", err);
    }
}

// Start the engine
document.addEventListener('DOMContentLoaded', initMatchCenter);