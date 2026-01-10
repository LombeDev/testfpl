/**
 * KOPALA FPL - PRO MATCH CENTER (FINAL STABLE VERSION)
 */

const FPL_PROXY = "/fpl-api/"; 

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;

// Add this style block to your head or CSS file to make the scrollbar look clean
const style = document.createElement('style');
style.innerHTML = `
    #fixtures-container {
        max-height: 600px; /* Adjust this height to fit your page layout */
        overflow-y: auto;
        padding-right: 5px;
        scrollbar-width: thin;
        scrollbar-color: #37003c #f4f4f4;
    }
    #fixtures-container::-webkit-scrollbar {
        width: 6px;
    }
    #fixtures-container::-webkit-scrollbar-track {
        background: #f4f4f4;
    }
    #fixtures-container::-webkit-scrollbar-thumb {
        background-color: #37003c;
        border-radius: 10px;
    }
`;
document.head.appendChild(style);

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
                html += `<div style="color:#37003c; font-size:0.75rem; font-weight:800; margin: 20px 0 10px 5px; opacity:0.6; text-transform:uppercase;">${currentDateString}</div>`;
                lastDateString = currentDateString;
            }

            let statusDisplay = "";
            if (game.finished) {
                statusDisplay = 'FT';
            } else if (game.started) {
                const diffMins = Math.floor((new Date() - kickoff) / 60000);
                if (diffMins < 45) statusDisplay = `${diffMins}'`;
                else if (diffMins < 60) statusDisplay = 'HT';
                else if (diffMins < 105) statusDisplay = `${diffMins - 15}'`;
                else statusDisplay = "90+'";
            }

            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();

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

            html += `
                <div style="display: flex; flex-direction: row; padding: 12px 0; margin-bottom: 2px; border-bottom: 1px solid #f8f8f8; min-height: 100px;">
                    <div style="flex: 1.3; padding-right: 12px; display: flex; flex-direction: column; border-right: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 900; font-size: 0.8rem; color:#37003c; flex: 1;">${homeAbbr}</span>
                            <div style="background: #37003c; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 0.8rem; font-family: monospace; margin: 0 10px;">
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






/**
 * Fetches and renders upcoming EPL fixtures
 */
async function loadUpcomingFixtures() {
    const container = document.getElementById('upcoming-list-container');
    const badge = document.getElementById('next-gw-badge');
    
    // Safety check: exit if elements don't exist
    if (!container) return;

    // Reliable CORS proxy for FPL API
    const PROXY = "https://corsproxy.io/?";
    const API_BOOTSTRAP = `${PROXY}https://fantasy.premierleague.com/api/bootstrap-static/`;
    const API_FIXTURES = `${PROXY}https://fantasy.premierleague.com/api/fixtures/`;

    try {
        console.log("Starting fixture fetch...");

        // 1. Get Team Names and GW info
        const bootRes = await fetch(API_BOOTSTRAP);
        if (!bootRes.ok) throw new Error("Bootstrap data failed");
        const bootData = await bootRes.json();

        // Find next GW
        const nextGW = bootData.events.find(e => e.is_next) || bootData.events.find(e => e.is_current);
        const nextGWId = nextGW ? nextGW.id : 1;
        
        // Update the badge in your HTML
        if (badge) badge.innerText = `GW ${nextGWId}`;

        // Create Team ID to Short Name map (e.g., 1 -> ARS)
        const teamMap = {};
        bootData.teams.forEach(t => teamMap[t.id] = t.short_name);

        // 2. Fetch Fixtures for the specific GW
        const fixRes = await fetch(`${API_FIXTURES}?event=${nextGWId}`);
        if (!fixRes.ok) throw new Error("Fixtures data failed");
        const fixtures = await fixRes.json();

        console.log(`Found ${fixtures.length} fixtures for GW ${nextGWId}`);

        // 3. Build HTML
        if (fixtures.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:10px; font-size:0.8rem; opacity:0.6;">No fixtures scheduled yet.</p>`;
            return;
        }

        const fixturesHTML = fixtures.map(f => {
            const date = new Date(f.kickoff_time);
            const day = date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="upcoming-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--fpl-border);">
                    <div style="width: 35%; text-align: right; font-weight: 800; font-size: 0.85rem;">
                        ${teamMap[f.team_h] || 'TBC'}
                    </div>
                    <div style="width: 25%; text-align: center; display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.6rem; font-weight: 900; background: var(--fpl-surface); border: 1px solid var(--fpl-border); padding: 2px 6px; border-radius: 4px;">VS</span>
                        <span style="font-size: 0.55rem; opacity: 0.6; font-weight: 700;">${day}</span>
                        <span style="font-size: 0.55rem; opacity: 0.6; font-weight: 700;">${time}</span>
                    </div>
                    <div style="width: 35%; text-align: left; font-weight: 800; font-size: 0.85rem;">
                        ${teamMap[f.team_a] || 'TBC'}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = fixturesHTML;

    } catch (err) {
        console.error("Fixture Error:", err);
        container.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <p style="font-size:0.75rem; color:var(--fpl-primary); font-weight:800;">Connection Error</p>
                <button onclick="loadUpcomingFixtures()" style="background:none; border:1px solid var(--fpl-primary); color:var(--fpl-primary); padding:4px 10px; border-radius:8px; font-size:0.6rem; font-weight:800; cursor:pointer; margin-top:5px;">RETRY</button>
            </div>
        `;
    }
}

// Kick off the function
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUpcomingFixtures);
} else {
    loadUpcomingFixtures();
}
