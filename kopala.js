const API_BASE = "/fpl-api/";
// 1. Define an array of league IDs you want to display
const LEAGUE_IDS = ["101712", "147133", "258"]; 

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 

/**
 * Initialization: Fetch shared static data first, then load each league
 */
async function initDashboard() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        // Fetch static data (players/teams) once only
        const staticRes = await fetch(`${API_BASE}bootstrap-static/`);
        const staticData = await staticRes.json();

        // Map Teams and Players
        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);
        staticData.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                team: p.team, 
                pos: p.element_type 
            };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        // 2. Loop through each League ID and fetch/render it
        for (const id of LEAGUE_IDS) {
            await fetchAndRenderLeague(id, currentEvent);
        }

    } catch (err) { 
        console.error("Error initializing dashboard:", err); 
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

/**
 * Fetches and creates a new table for a specific League
 */
async function fetchAndRenderLeague(leagueId, eventId) {
    try {
        const leagueRes = await fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`);
        const leagueData = await leagueRes.json();
        const leagueName = leagueData.league.name;

        // Create a unique section for this league
        const container = document.getElementById("leagues-container");
        const leagueSection = document.createElement("div");
        leagueSection.className = "league-section";
        leagueSection.innerHTML = `
            <h2 class="league-title">${leagueName}</h2>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Manager</th>
                            <th>GW Pts</th>
                            <th>Total</th>
                            <th>Captain</th>
                            <th>Diffs</th>
                            <th>Transfers</th>
                        </tr>
                    </thead>
                    <tbody id="body-${leagueId}"></tbody>
                </table>
            </div>
        `;
        container.appendChild(leagueSection);

        // Render the rows into the newly created tbody
        renderTableRows(leagueId, leagueData.standings.results);
        
        // Fetch intelligence for managers in this league
        await loadLeagueIntelligence(leagueData.standings.results, eventId);

    } catch (err) {
        console.error(`Error fetching league ${leagueId}:`, err);
    }
}

/**
 * Renders Rows for a specific League ID
 */
function renderTableRows(leagueId, managers) {
    const body = document.getElementById(`body-${leagueId}`);
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}">
            <td class="rank-col">${m.rank}</td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
                <div class="m-info-wrapper">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                    <span id="val-${m.entry}" class="val-text">£--.-m</span>
                </div>
            </td>
            <td class="pts-col">
                <div class="live-pts" style="font-weight:900;">${m.event_total}</div>
                <div id="hits-${m.entry}" style="font-size:7px; color:#ff2882; font-weight:bold;"></div>
            </td>
            <td class="total-col">
                <div class="bold-p" style="font-weight:900;">${m.total}</div>
            </td>
            <td id="cap-${m.entry}" class="cap-col">—</td>
            <td class="diff-col"><div id="diffs-${m.entry}" class="diff-col-scroll"></div></td>
            <td class="trans-col"><div id="trans-${m.entry}" class="trans-col-scroll"></div></td>
        </tr>
    `).join('');
}

// ... Keep your existing handleManagerClick, getTeamClass, and loadLeagueIntelligence functions ...

/**
 * Update the DOMContentLoaded listener
 */
document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    initSwipeHint();
});
