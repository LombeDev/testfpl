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
 * KOPALA FPL - Ultimate Football Dashboard
 * Integrated Version for Live EPL Fixtures & Navigation
 */

// 1. CONFIGURATION & DICTIONARIES
const LEAGUE_MAP = {
    'PL': 'English Premier League', 'PD': 'La Liga', 'SA': 'Serie A',
    'BL1': 'Bundesliga', 'FL1': 'Ligue 1', 'CL': 'Champions League'
};

const TEAM_SHORT_CODES = {
    "Manchester City FC": "MCI", "Manchester United FC": "MUN", "Arsenal FC": "ARS",
    "Liverpool FC": "LIV", "Chelsea FC": "CHE", "Tottenham Hotspur FC": "TOT",
    "Aston Villa FC": "AVL", "Newcastle United FC": "NEW", "Everton FC": "EVE",
    "Brighton & Hove Albion FC": "BHA", "West Ham United FC": "WHU", 
    "Crystal Palace FC": "CRY", "Wolverhampton Wanderers FC": "WOL",
    "Brentford FC": "BRE", "Fulham FC": "FUL", "Nottingham Forest FC": "NFO",
    "Leicester City FC": "LEI", "Southampton FC": "SOU", "Ipswich Town FC": "IPS"
};

// Global States
let activeLeague = 'PL';
let allMatches = [];
let currentViewGW = 21; // Starting Gameweek (adjust based on current date)
let rawStandingsData = [];

// 2. CORE INITIALIZATION
async function init() {
    const loader = document.getElementById('upcoming-list-container');
    if (loader) loader.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

    // Proxy URL (Ensure this matches your backend/CORS setup)
    const PROXY_URL = `/api/competitions/${activeLeague}/`;
    
    try {
        const [standingsRes, scorersRes, fixturesRes] = await Promise.all([
            fetch(`${PROXY_URL}standings`),
            fetch(`${PROXY_URL}scorers`),
            getFixtures(PROXY_URL)
        ]);

        const data = {
            standings: await standingsRes.json(),
            scorers: await scorersRes.json(),
            fixtures: await fixturesRes.json()
        };

        // Cache matches globally for navigation
        allMatches = data.fixtures.matches || [];
        
        // Auto-detect current matchday if available
        if (allMatches.length > 0) {
            const currentMatch = allMatches.find(m => m.status === 'TIMED' || m.status === 'SCHEDULED');
            if (currentMatch) currentViewGW = currentMatch.matchday;
        }

        renderAll(data);
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
        document.getElementById('upcoming-list-container').innerHTML = 
            `<p style="text-align:center; padding:15px; font-size:0.7rem; color:red;">API Connection Error</p>`;
    }
}

async function getFixtures(url) {
    const start = new Date();
    start.setDate(start.getDate() - 3);
    const end = new Date();
    end.setDate(end.getDate() + 100); // 100-day window to capture many Gameweeks
    return fetch(`${url}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
}

// 3. NAVIGATION LOGIC
function changeGW(direction) {
    const newGW = currentViewGW + direction;
    if (newGW >= 1 && newGW <= 38) {
        currentViewGW = newGW;
        
        // Trigger Lady Loading Effect
        const container = document.getElementById('upcoming-list-container');
        container.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
        
        // Short delay to simulate loading, then render from cached allMatches
        setTimeout(() => {
            renderFixtures(allMatches);
        }, 400);
    }
}

// 4. RENDERING FUNCTIONS
function renderAll(data) {
    if (data.standings.standings) {
        rawStandingsData = data.standings.standings[0].table;
        // Other rendering functions would go here (renderStandings, etc.)
    }
    if (data.fixtures.matches) renderFixtures(allMatches);
}

function renderFixtures(matches) {
    const container = document.getElementById('upcoming-list-container');
    const badge = document.getElementById('next-gw-badge');
    if (!container) return;

    // Update the UI Badge
    if (badge) badge.innerText = `GW ${currentViewGW}`;

    // Filter matches for the currently viewed Gameweek
    const gwMatches = allMatches.filter(m => m.matchday === currentViewGW);

    if (gwMatches.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; font-size:0.8rem; opacity:0.5;">No fixtures found for GW ${currentViewGW}</p>`;
        return;
    }

    container.innerHTML = gwMatches.map(m => {
        const date = new Date(m.utcDate);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dayStr = date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
        const isLive = m.status === 'IN_PLAY' || m.status === 'LIVE';

        return `
            <div class="fixture-mini-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--fpl-border);">
                <div style="width:35%; text-align:right; font-weight:800; font-size:0.85rem;">
                    ${getShortName(m.homeTeam)} <img src="${m.homeTeam.crest}" style="width:18px; margin-left:5px; vertical-align:middle;">
                </div>
                
                <div style="width:30%; text-align:center; display:flex; flex-direction:column; gap:2px;">
                    ${isLive ? 
                        `<span style="color:#ff0000; font-weight:900; font-size:0.6rem; animation: pulse 1.5s infinite;">● LIVE</span>
                         <span style="font-weight:900; font-size:0.9rem;">${m.score.fullTime.home}-${m.score.fullTime.away}</span>` :
                        `<span style="font-size:0.6rem; font-weight:900; background:var(--fpl-primary); color:white; padding:2px 6px; border-radius:4px; margin: 0 auto;">VS</span>
                         <span style="font-size:0.55rem; opacity:0.7; font-weight:700; margin-top:2px;">${dayStr} ${timeStr}</span>`
                    }
                </div>

                <div style="width:35%; text-align:left; font-weight:800; font-size:0.85rem;">
                    <img src="${m.awayTeam.crest}" style="width:18px; margin-right:5px; vertical-align:middle;"> ${getShortName(m.awayTeam)}
                </div>
            </div>
        `;
    }).join('');
}

// 5. HELPERS
function getShortName(team) {
    if (!team) return "???";
    return TEAM_SHORT_CODES[team.name] || team.shortName || team.name.substring(0, 3).toUpperCase();
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);
