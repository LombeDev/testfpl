const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 

/**
 * Initialization & Data Fetching
 */
async function fetchProLeague() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${LEAGUE_ID}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

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

        renderTable(leagueData.standings.results);
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { 
        console.error("Error fetching FPL data:", err); 
    }
}

/**
 * Maps Team IDs to CSS Classes for Jersey Kits
 */
function getTeamClass(teamId) {
    const mapping = {
        1: 'arsenal', 2: 'aston_villa', 3: 'bournemouth', 4: 'brentford', 5: 'brighton', 
        6: 'chelsea', 7: 'crystal_p', 8: 'everton', 9: 'fulham', 10: 'ipswich', 
        11: 'leicester', 12: 'liverpool', 13: 'man_city', 14: 'man_utd', 15: 'newcastle', 
        16: 'nottm_forest', 17: 'southampton', 18: 'tottenham', 19: 'west_ham', 20: 'wolves'
    };
    return mapping[teamId] || 'default';
}

/**
 * Renders the Main League Table
 */
function renderTable(managers) {
    const body = document.getElementById("league-body");
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

/**
 * Fetches individual manager details (Picks & Transfers)
 */
async function loadLeagueIntelligence(managers, eventId) {
    const ownership = {};
    const managerDetails = {};

    await Promise.all(managers.map(async (m) => {
        try {
            const [picksRes, transRes] = await Promise.all([
                fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
                fetch(`${API_BASE}entry/${m.entry}/transfers/`)
            ]);
            const picks = await picksRes.json();
            const trans = await transRes.json();
            
            managerDetails[m.entry] = { 
                picks, 
                trans: trans.filter(t => t.event === eventId) 
            };
            managerSquads[m.entry] = picks;
            
            // Track ownership for Differential logic
            picks.picks.forEach(p => {
                ownership[p.element] = (ownership[p.element] || 0) + 1;
            });
        } catch (e) { console.warn(`Failed to fetch manager ${m.entry}:`, e); }
    }));

    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        // Update Value
        const valSpan = document.getElementById(`val-${m.entry}`);
        if(valSpan) valSpan.innerText = `£${(data.picks.entry_history.value / 10).toFixed(1)}m`;

        // Update Captain & Active Chips
        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        const capCell = document.getElementById(`cap-${m.entry}`);
        if(capCell) {
            capCell.innerHTML = `
                ${playerMap[cap.element].name} 
                ${chip ? `<span class="chip-badge chip-wildcard">${chip.toUpperCase()}</span>` : ''}
            `;
        }

        // Update Differentials (Owned by only 1 person in the viewable table)
        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        const diffDiv = document.getElementById(`diffs-${m.entry}`);
        if(diffDiv) {
            diffDiv.innerHTML = diffs.map(p => 
                `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';
        }

        // Update Transfers In
        const transDiv = document.getElementById(`trans-${m.entry}`);
        if(transDiv) {
            transDiv.innerHTML = data.trans.map(t => 
                `<span class="mini-tag tag-in">${playerMap[t.element_in].name}</span>`).join('') || 'None';
        }

        // Update Transfer Hits (Cost)
        const hitsDiv = document.getElementById(`hits-${m.entry}`);
        const hits = data.picks.entry_history.event_transfer_cost;
        if(hitsDiv && hits > 0) hitsDiv.innerText = `-${hits}`;
    });

    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.add("hidden");
}

/**
 * Handles Click on Manager Name to show the Jersey Pitch Modal
 */
function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;

    const starters = { 1: [], 2: [], 3: [], 4: [] };
    const bench = [];
    let squadTotal = 0;

    data.picks.forEach(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        if (p.multiplier > 0) squadTotal += pts;
        
        const kitClass = player.pos === 1 ? 'gkp_color' : getTeamClass(player.team);

        const playerHTML = `
            <div class="slot" style="width: 65px; display:flex; flex-direction:column; align-items:center; position:relative;">
                ${p.is_captain ? '<div class="cap-star-pitch">★</div>' : ''}
                <div class="jersey ${kitClass}"></div>
                <div class="modal-player-tag">
                    <span class="m-p-name">${player.name}</span>
                    <span class="m-p-pts">${player.points}${p.multiplier > 1 ? ' (x'+p.multiplier+')' : ''}</span>
                </div>
            </div>`;
        
        if (p.position > 11) bench.push(playerHTML);
        else starters[player.pos].push(playerHTML);
    });

    list.innerHTML = `
        <div class="modal-pitch">
            <div class="modal-row">${starters[1].join('')}</div>
            <div class="modal-row">${starters[2].join('')}</div>
            <div class="modal-row">${starters[3].join('')}</div>
            <div class="modal-row">${starters[4].join('')}</div>
            <div class="bench-wrap">
                <div class="bench-label">Substitutes</div>
                <div class="modal-row">${bench.join('')}</div>
            </div>
        </div>
        <div class="modal-footer">
            <span class="total-label">Live Score</span>
            <span class="total-value">${squadTotal} PTS</span>
        </div>
    `;
    modal.classList.remove("hidden");
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

/**
 * UI Utility: Swipe Hint handling
 */
function initSwipeHint() {
    const hint = document.getElementById('scroll-hint');
    const tableWrapper = document.querySelector('.table-wrapper');

    if (!hint || !tableWrapper) return;

    // Hide hint if user scrolls the table
    tableWrapper.addEventListener('scroll', () => {
        hint.classList.add('hidden-hint');
    }, { once: true });

    // Auto-hide after 5 seconds
    setTimeout(() => {
        hint.classList.add('hidden-hint');
    }, 5000);
}

/**
 * Event Listeners
 */
document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
    document.body.style.overflow = ''; // Restore background scroll
};

document.addEventListener("DOMContentLoaded", () => {
    fetchProLeague();
    initSwipeHint();
});
