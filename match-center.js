/**
 * KOPALA FPL - LIVE MATCH CENTER (FIXED)
 */

const MATCH_CONFIG = {
    // We'll use a more reliable proxy
    proxy: "https://api.allorigins.win/raw?url=",
    base: "https://fantasy.premierleague.com/api/"
};

let playerLookup = {};
let teamLookup = {};
let activeGameweek = 18; // Current GW for Dec 26, 2025

async function initMatchCenter() {
    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'bootstrap-static/')}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();

        // 1. Build Lookups
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        // 2. Set Current GW
        const current = data.events.find(e => e.is_current);
        if (current) activeGameweek = current.id;

        updateLiveScores();
        setInterval(updateLiveScores, 60000);

    } catch (error) {
        console.error("Match Center Init Error:", error);
        document.getElementById('fixtures-container').innerHTML = 
            `<p style="text-align:center; color:red; font-size:0.7rem;">Failed to load data. Please refresh.</p>`;
    }
}

async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    const liveTag = document.getElementById('live-indicator');
    
    try {
        const url = `${MATCH_CONFIG.proxy}${encodeURIComponent(MATCH_CONFIG.base + 'fixtures/?event=' + activeGameweek)}`;
        const response = await fetch(url);
        const fixtures = await response.json();

        // FILTER: Matches that have started but aren't finished
        const liveGames = fixtures.filter(f => f.started && !f.finished);

        if (liveGames.length === 0) {
            // Show the next upcoming match instead of just a blank screen
            const nextMatch = fixtures.find(f => !f.started);
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <p style="opacity:0.5; font-size:0.7rem; margin-bottom:5px;">NEXT MATCH</p>
                    <p style="font-weight:800; font-size:0.9rem;">
                        ${teamLookup[nextMatch.team_h]} vs ${teamLookup[nextMatch.team_a]}
                    </p>
                    <p style="font-size:0.6rem; opacity:0.6; margin-top:5px;">Kickoff: ${new Date(nextMatch.kickoff_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>`;
            if (liveTag) liveTag.classList.add('hidden');
            return;
        }

        // --- RENDER LIVE GAMES ---
        if (liveTag) liveTag.classList.remove('hidden');
        container.innerHTML = '';

        liveGames.forEach(game => {
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
                const top3 = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                top3.forEach((p, i) => {
                    bonusHtml += `<div style="display:flex; justify-content:space-between; font-size:0.7rem;">
                        <span>${playerLookup[p.element]}</span><span style="color:var(--fpl-primary); font-weight:800;">+${3-i}</span>
                    </div>`;
                });
            }

            container.innerHTML += `
                <div class="fixture-row" style="padding:15px 0; border-bottom:1px solid var(--fpl-border);">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900;">
                        <span style="flex:1; text-align:right;">${teamLookup[game.team_h]}</span>
                        <span style="margin:0 15px; background:var(--fpl-on-container); color:white; padding:3px 10px; border-radius:6px; font-family:monospace;">
                            ${game.team_h_score} - ${game.team_a_score}
                        </span>
                        <span style="flex:1;">${teamLookup[game.team_a]}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-top: 12px;">
                        <div>${eventsHtml || '<span style="opacity:0.3; font-size:0.7rem;">Live Match Data...</span>'}</div>
                        <div style="background:var(--fpl-surface); padding:10px; border-radius:12px; border: 1px dashed var(--fpl-primary);">
                            <p style="font-size:0.55rem; font-weight:900; margin:0 0 5px 0; opacity:0.6;">PROVISIONAL BONUS</p>
                            ${bonusHtml}
                        </div>
                    </div>
                </div>`;
        });
    } catch (err) {
        console.error("Score Update Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);
