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





async function loadUpcomingFixtures() {
    const container = document.getElementById('upcoming-list-container');
    if (!container) return;

    // Switch to AllOrigins - more reliable for FPL data
    const proxy = "https://api.allorigins.win/raw?url=";
    const baseUrl = "https://fantasy.premierleague.com/api";

    try {
        // 1. Fetch Main Data (Bootstrap)
        const bootRes = await fetch(`${proxy}${encodeURIComponent(baseUrl + '/bootstrap-static/')}`);
        if (!bootRes.ok) throw new Error("Bootstrap failed");
        const bootData = await bootRes.json();

        // 2. Identify GW (Logic: find the first event where 'is_next' is true)
        const nextGW = bootData.events.find(e => e.is_next) || bootData.events.find(e => e.is_current);
        const gwId = nextGW ? nextGW.id : 1;
        
        document.getElementById('next-gw-badge').innerText = `GW ${gwId}`;

        // 3. Fetch Specific Fixtures
        const fixRes = await fetch(`${proxy}${encodeURIComponent(baseUrl + '/fixtures/?event=' + gwId)}`);
        const fixtures = await fixRes.json();

        // 4. Map Teams
        const teamNames = {};
        bootData.teams.forEach(t => teamNames[t.id] = t.short_name);

        // 5. Render to UI
        if (!fixtures || fixtures.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:15px; font-size:0.8rem;">Fixtures TBC</p>`;
            return;
        }

        container.innerHTML = fixtures.map(f => {
            const date = new Date(f.kickoff_time);
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="upcoming-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--fpl-border);">
                    <div style="width:35%; text-align:right; font-weight:800; font-size:0.85rem;">${teamNames[f.team_h]}</div>
                    <div style="width:25%; text-align:center; display:flex; flex-direction:column;">
                        <span style="font-size:0.6rem; font-weight:900; background:var(--fpl-surface); padding:2px 4px; border-radius:4px; border:1px solid var(--fpl-border); margin: 0 auto;">VS</span>
                        <span style="font-size:0.55rem; opacity:0.6; font-weight:700; margin-top:4px;">${time}</span>
                    </div>
                    <div style="width:35%; text-align:left; font-weight:800; font-size:0.85rem;">${teamNames[f.team_a]}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Critical Load Error:", error);
        container.innerHTML = `
            <div style="text-align:center; padding:15px;">
                <p style="font-size:0.7rem; color:red; margin-bottom:8px;">Network Blocked</p>
                <button onclick="window.location.reload()" style="background:var(--fpl-primary); color:white; border:none; padding:8px 16px; border-radius:12px; font-weight:800; cursor:pointer; font-size:0.7rem;">REFRESH PAGE</button>
            </div>
        `;
    }
}

// Ensure execution
loadUpcomingFixtures();
