/**
 * KOPALA FPL - PREMIUM MATCH CENTER
 * Style: FFH Inspired / Netlify Proxy
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// 1. INITIALIZE DATABASE
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;
        
        updateLiveScores();
    } catch (error) {
        console.error("Critical Sync Error:", error);
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
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}`);
        const fixtures = await response.json();

        // Filter: Started matches only (Live + FT)
        const startedGames = fixtures.filter(f => f.started);
        const isAnyMatchLive = startedGames.some(f => !f.finished);

        if (startedGames.length === 0) {
            container.innerHTML = `<p style="text-align:center; opacity:0.5; padding:30px;">No matches started yet.</p>`;
            return;
        }

        // Smart Refresh
        if (isAnyMatchLive) {
            if (liveTag) liveTag.classList.remove('hidden');
            refreshTimer = setTimeout(updateLiveScores, 60000);
        } else {
            if (liveTag) liveTag.classList.add('hidden');
        }

        let html = '';
        // Sort: Live games at top, then Finished games
        [...startedGames].sort((a,b) => (a.finished === b.finished) ? 0 : a.finished ? 1 : -1).forEach(game => {
            
            // Scorer & Assist Logic
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let eventsHtml = '';
            if (goals) {
                [...goals.h, ...goals.a].forEach(s => {
                    eventsHtml += `<div style="margin-bottom:2px;">⚽ ${playerLookup[s.element]}</div>`;
                });
            }
            if (assists) {
                [...assists.h, ...assists.a].forEach(s => {
                    eventsHtml += `<div style="opacity:0.6; font-size:0.7rem;">👟 ${playerLookup[s.element]}</div>`;
                });
            }

            // Bonus Rank Logic (3, 2, 1)
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.75rem;">
                            <span style="background:${rankColors[i]}; color:#000; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-weight:900; font-size:0.6rem;">${3-i}</span>
                            <span style="font-weight:600; flex:1;">${playerLookup[p.element]}</span>
                        </div>`;
                });
            }

            const status = game.finished ? 'FINAL RESULT' : 'LIVE MATCH';
            const headerColor = game.finished ? '#f1f1f1' : '#00ff87';

            html += `
                <div class="fixture-card" style="margin-bottom:15px; background:#fff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #eee;">
                    <div style="background:${headerColor}; color:#000; text-align:center; padding:5px; font-weight:900; font-size:0.7rem; letter-spacing:1px;">
                        ${status}
                    </div>

                    <div style="display:flex; padding:12px; min-height:100px; align-items:stretch;">
                        <div style="flex:1.2; border-right:1px solid #f0f0f0; padding-right:10px; font-size:0.8rem; display:flex; flex-direction:column; justify-content:center;">
                            ${eventsHtml || '<span style="opacity:0.2; font-style:italic;">No events</span>'}
                        </div>

                        <div style="flex:1.5; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 10px;">
                            <div style="display:flex; align-items:center; gap:8px; width:100%; justify-content:center; margin-bottom:5px;">
                                <span style="font-weight:800; font-size:0.8rem; text-align:right; flex:1; text-transform:uppercase;">${teamLookup[game.team_h].substring(0,3)}</span>
                                <div style="background:#37003c; color:#fff; padding:5px 12px; border-radius:6px; font-family:monospace; font-size:1.1rem; font-weight:900; min-width:60px; text-align:center;">
                                    ${game.team_h_score} - ${game.team_a_score}
                                </div>
                                <span style="font-weight:800; font-size:0.8rem; text-align:left; flex:1; text-transform:uppercase;">${teamLookup[game.team_a].substring(0,3)}</span>
                            </div>
                            <span style="font-size:0.6rem; font-weight:800; color:#37003c; opacity:0.6;">GAMEREEEEK ${activeGameweek}</span>
                        </div>

                        <div style="flex:1; background:#f9f9f9; border-radius:8px; padding:10px; display:flex; flex-direction:column; justify-content:center;">
                            <div style="font-size:0.55rem; font-weight:900; opacity:0.4; margin-bottom:5px; text-transform:uppercase; display:flex; align-items:center; gap:3px;">
                                <i class="fa-solid fa-trophy"></i> Bonus
                            </div>
                            ${bonusHtml || '<span style="opacity:0.3; font-size:0.6rem;">Awaiting BPS...</span>'}
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;

    } catch (err) {
        console.error("Update Error:", err);
    } finally {
        if (refreshIcon) setTimeout(() => refreshIcon.classList.remove('fa-spin'), 800);
    }
}

document.addEventListener('DOMContentLoaded', initMatchCenter);
