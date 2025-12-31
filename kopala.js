const API_BASE = "/fpl-api/";

const LEAGUES_LIST = [
    { name: "Kopala FPL", id: "101712" },
    { name: "Bayporteers", id: "147133" },
    { name: "Zedian Premier League", id: "1745660" },
    { name: "Zambia", id: "258" },
    { name: "Second Chance", id: "333" }
];

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 

/**
 * Caching Logic: Determines if we need to fetch new data
 * Data is valid until the next 2:00 AM occurs.
 */
function isCacheValid(timestamp) {
    if (!timestamp) return false;
    
    const now = new Date();
    const lastFetch = new Date(timestamp);
    
    // Create a date object for 2 AM today
    const today2AM = new Date();
    today2AM.setHours(2, 0, 0, 0);
    
    // If it's currently before 2AM, the "cutoff" was 2AM yesterday
    if (now < today2AM) {
        today2AM.setDate(today2AM.getDate() - 1);
    }
    
    // Cache is valid if it was fetched AFTER the most recent 2 AM
    return lastFetch > today2AM;
}

/**
 * Main function with Caching
 */
async function fetchProLeague(leagueId) {
    const cacheKey = `fpl_cache_${leagueId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (isCacheValid(parsed.timestamp)) {
            console.log("Loading from cache (valid until next 2AM)");
            applyDataToUI(parsed.staticData, parsed.leagueData);
            return;
        }
    }

    // If no cache or cache expired, fetch fresh data
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();

        // Save to cache with timestamp
        const cacheObject = {
            timestamp: new Date().getTime(),
            staticData,
            leagueData
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheObject));

        applyDataToUI(staticData, leagueData);

    } catch (err) { 
        console.error("Error fetching FPL data:", err); 
        if (loader) loader.classList.add("hidden");
    }
}

/**
 * Helper to process and show data
 */
function applyDataToUI(staticData, leagueData) {
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
    const gwLabel = document.getElementById("active-gw-label");
    if (gwLabel) gwLabel.textContent = `GW ${currentEvent}`;

    renderTable(leagueData.standings.results);
    loadLeagueIntelligence(leagueData.standings.results, currentEvent);
}

// --- KEEP ALL OTHER FUNCTIONS (renderLeagueSelector, renderTable, loadLeagueIntelligence, etc.) EXACTLY AS THEY WERE ---

function renderLeagueSelector() {
    const body = document.getElementById("league-body");
    const tableHeader = document.querySelector("#league-table thead");
    if (tableHeader) tableHeader.style.display = "none";

    body.innerHTML = LEAGUES_LIST.map(league => `
        <tr style="border-bottom: 8px solid var(--fpl-surface);">
            <td colspan="7" style="padding: 15px; background: var(--fpl-container);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 800; font-size: 1.1rem; color: var(--fpl-on-container);">${league.name}</span>
                    <button onclick="fetchProLeague('${league.id}')" 
                            style="background: var(--fpl-blue); color: #333; border: none; padding: 8px 15px; 
                            border-radius: 6px; font-weight: 800; font-size: 10px; cursor: pointer; text-transform: uppercase;">
                        View League
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getTeamClass(teamId) {
    const mapping = {
        1: 'arsenal', 2: 'aston_villa', 3: 'bournemouth', 4: 'brentford', 5: 'brighton', 
        6: 'chelsea', 7: 'crystal_p', 8: 'everton', 9: 'fulham', 10: 'ipswich', 
        11: 'leicester', 12: 'liverpool', 13: 'man_city', 14: 'man_utd', 15: 'newcastle', 
        16: 'nottm_forest', 17: 'southampton', 18: 'tottenham', 19: 'west_ham', 20: 'wolves'
    };
    return mapping[teamId] || 'default';
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    const tableHeader = document.querySelector("#league-table thead");
    if (tableHeader) tableHeader.style.display = "table-header-group";

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
            
            picks.picks.forEach(p => {
                ownership[p.element] = (ownership[p.element] || 0) + 1;
            });
        } catch (e) { console.warn(`Failed to fetch manager ${m.entry}:`, e); }
    }));

    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        const valSpan = document.getElementById(`val-${m.entry}`);
        if(valSpan) valSpan.innerText = `£${(data.picks.entry_history.value / 10).toFixed(1)}m`;

        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        const capCell = document.getElementById(`cap-${m.entry}`);
        if(capCell) {
            capCell.innerHTML = `
                ${playerMap[cap.element].name} 
                ${chip ? `<span class="chip-badge chip-wildcard">${chip.toUpperCase()}</span>` : ''}
            `;
        }

        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        const diffDiv = document.getElementById(`diffs-${m.entry}`);
        if(diffDiv) {
            diffDiv.innerHTML = diffs.map(p => 
                `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';
        }

        const transDiv = document.getElementById(`trans-${m.entry}`);
        if(transDiv) {
            transDiv.innerHTML = data.trans.map(t => 
                `<span class="mini-tag tag-in">${playerMap[t.element_in].name}</span>`).join('') || 'None';
        }

        const hitsDiv = document.getElementById(`hits-${m.entry}`);
        const hits = data.picks.entry_history.event_transfer_cost;
        if(hitsDiv && hits > 0) hitsDiv.innerText = `-${hits}`;
    });

    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.add("hidden");
}

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
    document.body.style.overflow = 'hidden'; 
}

document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
    document.body.style.overflow = ''; 
};

document.addEventListener("DOMContentLoaded", () => {
    renderLeagueSelector();
});
