/**
 * KOPALA FPL - INSTANT MATCH CENTER
 * Optimized for reliability and "Keep Results" logic
 */

const MATCH_CONFIG = {
    // We use a high-reliability proxy link
    proxy: "https://api.allorigins.win/raw?url=", 
    base: "https://fantasy.premierleague.com/api/"
};

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// 1. INITIALIZE DATA
async function initMatchCenter() {
    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'bootstrap-static/')}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network Response Fail");
        const data = await response.json();

        // Faster Mapping
        for (const p of data.elements) playerLookup[p.id] = p.web_name;
        for (const t of data.teams) teamLookup[t.id] = t.name;
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        console.log("Engine Ready. GW:", activeGameweek);
        updateLiveScores();

    } catch (error) {
        console.error("Init Error:", error);
        // Retry once after 5 seconds if init fails
        setTimeout(initMatchCenter, 5000);
    }
}

// 2. FETCH & RENDER (Instant Logic)
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    const refreshIcon = document.getElementById('refresh-icon');
    
    if (!container) return;
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    
    clearTimeout(refreshTimer);

    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'fixtures/?event=' + activeGameweek)}`;
        const response = await fetch(url);
        const fixtures = await response.json();

        // THE KEY: Filter by 'started' only. This keeps Finished games in the list.
        const allStartedMatches = fixtures.filter(f => f.started === true);
        
        // Check if we need to keep refreshing
        const liveGamesExist = allStartedMatches.some(f => f.finished === false);

        if (allStartedMatches.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;">
                <i class="fa-solid fa-calendar-days" style="font-size:2rem; margin-bottom:10px;"></i>
                <p>No matches have started yet for GW ${activeGameweek}.</p>
            </div>`;
            if (liveTag) liveTag.classList.add('hidden');
            return;
        }

        // Handle the LIVE badge and Auto-Refresh
        if (liveGamesExist) {
            if (liveTag) liveTag.classList.remove('hidden');
            // Auto-refresh every 60s ONLY if games are actually happening
            refreshTimer = setTimeout(updateLiveScores, 60000);
        } else {
            if (liveTag) liveTag.classList.add('hidden');
        }

        // Render matches (Newest/Live at the top)
        let html = '';
        [...allStartedMatches].reverse().forEach(game => {
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            const bps = game.stats.find(s => s.identifier === 'bps');

            let eventsHtml = '';
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div class="event-item">⚽ ${playerLookup[s.element] || 'Player'}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div class="event-item" style="opacity:0.6;">👟 ${playerLookup[s.element] || 'Player'}</div>`;
                });
            }

            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                top.forEach((p, i) => {
                    bonusHtml += `<div style="display:flex; justify-content:space-between; font-size:0.7rem;">
                        <span>${playerLookup[p.element]}</span>
                        <span style="color:var(--fpl-primary); font-weight:800;">+${3-i}</span>
                    </div>`;
                });
            }

            const status = game.finished ? 
                `<span style="opacity:0.5; font-size:0.6rem; font-weight:800;">FINISHED</span>` : 
                `<span style="color:#00ff87; font-size:0.6rem; font-weight:900;">LIVE</span>`;

            html += `
                <div class="fixture-row" style="padding:15px 0; border-bottom:1px solid var(--fpl-border); animation: fadeIn 0.5s ease;">
                    <div style="text-align:center; margin-bottom:5px;">${status}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
                        <span style="flex:1; text-align:right; font-size:0.85rem;">${teamLookup[game.team_h]}</span>
                        <span style="margin:0 15px; background:var(--fpl-on-container); color:white; padding:4px 12px; border-radius:8px; font-family:monospace; min-width:45px; text-align:center; font-size:1rem;">
                            ${game.team_h_score} - ${game.team_a_score}
                        </span>
                        <span style="flex:1; font-size:0.85rem;">${teamLookup[game.team_a]}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-top: 12px; padding:0 5px;">
                        <div class="event-log">${eventsHtml || '<span style="opacity:0.3; font-size:0.7rem;">No scorers yet</span>'}</div>
                        <div style="background:var(--fpl-surface); padding:10px; border-radius:12px; border: 1px dashed var(--fpl-primary);">
                            <p style="font-size:0.55rem; font-weight:900; margin:0 0 5px 0; opacity:0.6; text-transform:uppercase;">Bonus Points</p>
                            ${bonusHtml || '<span style="opacity:0.3; font-size:0.6rem;">Calculating...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;

    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove('fa-spin'), 800);
        }
    }
}

// Start
document.addEventListener('DOMContentLoaded', initMatchCenter);
