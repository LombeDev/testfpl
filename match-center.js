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
let refreshTimer = null; // To manage the smart refresh

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

    } catch (error) {
        console.error("Initialization failed:", error);
    }
}

// 2. FETCH & RENDER LIVE SCORES
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    const refreshIcon = document.getElementById('refresh-icon');
    
    if (!container) return;

    // UI Feedback: Start spinning icon if it exists
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    
    // Safety: Clear any existing timer
    clearTimeout(refreshTimer);

    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'fixtures/?event=' + activeGameweek)}`;
        const response = await fetch(url);
        const fixtures = await response.json();

        // CHANGE: Filter for any game that has started (Live OR Finished)
        // This keeps the results on screen until the next GW
        const startedGames = fixtures.filter(f => f.started);

        // Logic to check if we should refresh again
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        if (startedGames.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding: 20px;">No matches started yet.</p>`;
            if (liveTag) liveTag.classList.add('hidden');
            return;
        }

        // --- SMART REFRESH CONTROL ---
        if (isAnyMatchLive) {
            if (liveTag) liveTag.classList.remove('hidden');
            // Schedule next refresh in 60s because a game is live
            refreshTimer = setTimeout(updateLiveScores, 60000);
        } else {
            // No games are live, hide the live tag and DON'T set a timer
            if (liveTag) liveTag.classList.add('hidden');
        }

        container.innerHTML = '';

        // Render from newest to oldest
        [...startedGames].reverse().forEach(game => {
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            const bps = game.stats.find(s => s.identifier === 'bps');

            let eventsHtml = '';
            let bonusHtml = '';

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

            // Status Badge (FT or LIVE)
            const statusLabel = game.finished ? 
                '<span style="font-size:0.6rem; opacity:0.5; font-weight:bold;">FT</span>' : 
                '<span style="font-size:0.6rem; color:#00ff87; font-weight:900;">LIVE</span>';

            container.innerHTML += `
                <div class="fixture-row" style="padding:15px 0; border-bottom:1px solid var(--fpl-border);">
                    <div style="text-align:center; margin-bottom:4px;">${statusLabel}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
                        <span style="flex:1; text-align:right; font-size:0.85rem;">${teamLookup[game.team_h]}</span>
                        <span style="margin:0 15px; background:var(--fpl-on-container); color:white; padding:3px 10px; border-radius:6px; font-family:monospace; min-width:40px; text-align:center;">
                            ${game.team_h_score} - ${game.team_a_score}
                        </span>
                        <span style="flex:1; font-size:0.85rem;">${teamLookup[game.team_a]}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-top: 12px;">
                        <div class="event-log">${eventsHtml || '<span style="opacity:0.3; font-size:0.7rem;">No scorers</span>'}</div>
                        <div style="background:var(--fpl-surface); padding:10px; border-radius:12px; border: 1px dashed var(--fpl-primary);">
                            <p style="font-size:0.55rem; font-weight:900; margin:0 0 5px 0; opacity:0.6; text-transform:uppercase;">
                                ${game.finished ? 'Final Bonus' : 'Live Bonus'}
                            </p>
                            ${bonusHtml || '<span style="font-size:0.6rem; opacity:0.3;">...</span>'}
                        </div>
                    </div>
                </div>`;
        });
    } catch (err) {
        console.error("Match Center Update Error:", err);
    } finally {
        // UI Feedback: Stop spinning icon
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove('fa-spin'), 600);
        }
    }
}

// Start the engine
document.addEventListener('DOMContentLoaded', initMatchCenter);
