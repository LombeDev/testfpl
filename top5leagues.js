/**
 * KOPALA FPL - Elite League Tracker v3.0
 * Features: League Leaders, Total Points, and Live Captaincy
 */

const LEAGUES_TO_TRACK = [
    { id: 314, label: "Global Overall" },
    { id: 544212, label: "FPL Focal" },
    { id: 10293, label: "Raptor's Data Lab" },
    { id: 415, label: "FPL Mate" },
    { id: 5812, label: "Above Average" }
];

// We need bootstrap data to map Player IDs to Names (e.g., 302 -> "Haaland")
let playerMap = {};
const PROXY = "https://api.allorigins.win/raw?url=";

async function initLeagues() {
    const container = document.getElementById('league-leader-container');
    const syncBadge = document.getElementById('last-updated');
    
    try {
        // 1. Get Static Data (Player Names)
        const staticRes = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        staticData.elements.forEach(p => playerMap[p.id] = p.web_name);
        const currentGW = staticData.events.find(e => e.is_current).id;

        container.innerHTML = ''; // Clear loaders

        // 2. Fetch each league
        for (const league of LEAGUES_TO_TRACK) {
            const leagueRes = await fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${league.id}/standings/`));
            const leagueData = await leagueRes.json();
            const leader = leagueData.standings.results[0];

            // 3. Fetch Leader's Captain for the current GW
            const picksRes = await fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${leader.entry}/event/${currentGW}/picks/`));
            const picksData = await picksRes.json();
            
            const captainId = picksData.picks.find(p => p.is_captain).element;
            const isTC = picksData.active_chip === '3xc';
            const captainName = playerMap[captainId] || "Unknown";

            renderLeagueCard(container, leagueData.league.name, leader, league.label, captainName, isTC);
        }
        
        if (syncBadge) syncBadge.innerHTML = `<i class="fa-solid fa-check-double"></i> LIVE GW ${currentGW}`;
    } catch (err) {
        console.error("FPL Elite Sync Error:", err);
    }
}

function renderLeagueCard(container, leagueName, leader, label, captain, isTC) {
    const isRising = leader.last_rank > leader.rank;
    
    container.innerHTML += `
        <div class="league-row" style="padding: 15px; margin-bottom: 12px; background: var(--fpl-surface); border-radius: 12px; border-left: 4px solid var(--fpl-secondary);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="width: 60%;">
                    <span style="font-size: 0.55rem; font-weight: 900; color: var(--fpl-primary); text-transform: uppercase;">${label}</span>
                    <h3 style="margin: 2px 0; font-size: 0.95rem; color: white;">${leader.entry_name}</h3>
                    <div style="display: flex; align-items: center; gap: 5px; margin-top: 4px;">
                        <span style="font-size: 0.65rem; background: rgba(0, 255, 135, 0.1); color: #00ff87; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
                            © ${captain}${isTC ? ' (TC)' : ''}
                        </span>
                        <span style="font-size: 0.65rem; opacity: 0.6;">by ${leader.player_name}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--fpl-secondary); line-height: 1;">${leader.total}</div>
                    <div style="font-size: 0.55rem; font-weight: 800; opacity: 0.5;">TOTAL PTS</div>
                    <div style="font-size: 0.65rem; margin-top: 5px; font-weight: 700; color: ${isRising ? '#00ff87' : '#ff005a'}">
                        ${isRising ? '▲' : '▼'} #${leader.rank.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', initLeagues);
