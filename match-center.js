/**
 * KOPALA FPL - PRO ENGINE
 * Uses Netlify Proxy for 100% Reliability
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// 1. INITIALIZE DATABASE
async function initMatchCenter() {
    try {
        console.log("Syncing with FPL Database...");
        
        // Fetching through your Netlify proxy
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Map data for instant access
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // Identify Current Gameweek
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;

        console.log("Database Synced. GW:", activeGameweek);
        
        // Start live updates
        updateLiveScores();

    } catch (error) {
        console.error("Critical Sync Error:", error);
        const container = document.getElementById('fixtures-container');
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4d4d; font-size:0.8rem;">
                <strong>CONNECTION BLOCKED</strong><br>
                Please ensure the _redirects file is deployed.
            </div>`;
        }
    }
}

// 2. LIVE SCORE ENGINE
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    const refreshIcon = document.getElementById('refresh-icon');
    
    if (!container) return;
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    
    clearTimeout(refreshTimer);

    try {
        // Fetch fixtures for the active gameweek
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        // FILTER: Keep everything that has started (Live + Finished)
        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        if (startedGames.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.5; padding:30px;">No matches started yet for GW ${activeGameweek}.</p>`;
            if (liveTag) liveTag.classList.add('hidden');
            return;
        }

        // Handle Live Indicators & Smart Refresh
        if (isAnyMatchLive) {
            if (liveTag) liveTag.classList.remove('hidden');
            refreshTimer = setTimeout(updateLiveScores, 60000); // Update every minute
        } else {
            if (liveTag) liveTag.classList.add('hidden');
        }

        // Render HTML
        let html = '';
        [...startedGames].reverse().forEach(game => {
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            const bps = game.stats.find(s => s.identifier === 'bps');

            let eventsHtml = '';
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
                `<span style="opacity:0.4; font-size:0.6rem; font-weight:800;">FT</span>` : 
                `<span style="color:#00ff87; font-size:0.6rem; font-weight:900;">LIVE</span>`;

            html += `
                <div class="fixture-row" style="padding:15px 0; border-bottom:1px solid var(--fpl-border);">
                    <div style="text-align:center; margin-bottom:5px;">${status}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
                        <span style="flex:1; text-align:right;">${teamLookup[game.team_h]}</span>
                        <span style="margin:0 15px; background:var(--fpl-on-container); color:white; padding:4px 10px; border-radius:6px; font-family:monospace; min-width:45px; text-align:center;">
                            ${game.team_h_score} - ${game.team_a_score}
                        </span>
                        <span style="flex:1;">${teamLookup[game.team_a]}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-top: 12px; padding:0 10px;">
                        <div class="event-log">${eventsHtml || '<span style="opacity:0.2;">...</span>'}</div>
                        <div style="background:var(--fpl-surface); padding:8px; border-radius:10px; border: 1px dashed var(--fpl-primary);">
                            <p style="font-size:0.55rem; font-weight:900; margin:0 0 5px 0; opacity:0.6; text-transform:uppercase;">Bonus</p>
                            ${bonusHtml || '<span style="opacity:0.2;">...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;

    } catch (err) {
        console.error("Score Update Failed:", err);
    } finally {
        if (refreshIcon) setTimeout(() => refreshIcon.classList.remove('fa-spin'), 800);
    }
}

// Start
document.addEventListener('DOMContentLoaded', initMatchCenter);
