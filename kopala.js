const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 
let globalOwnership = {};

/**
 * Main function to initialize data fetch
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

        // Map Teams
        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);

        // Map Players
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

        // Initial table render
        renderTable(leagueData.standings.results);
        
        // Deep data fetch for Intelligence columns
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

/**
 * Renders the table shell with forced narrow widths
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
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" style="font-size:7px; color:#ff005a; font-weight:bold;"></div>
            </td>

            <td class="total-col">
                <div class="bold-p">${m.total}</div>
            </td>

            <td id="cap-${m.entry}" class="cap-col">—</td>

            <td class="diff-col">
                <div id="diffs-${m.entry}" class="diff-col-scroll"></div>
            </td>

            <td class="trans-col">
                <div id="trans-${m.entry}" class="trans-col-scroll"></div>
            </td>
        </tr>
    `).join('');
}

/**
 * Loads chips, transfers, and ownership in parallel
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
            
            // Cache for the Squad List Modal
            managerSquads[m.entry] = picks;

            // Tally ownership for Differentials
            picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
        } catch (e) { console.warn(`Error loading manager ${m.entry}:`, e); }
    }));

    // Update UI with intelligence data
    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        // Team Value
        const val = (data.picks.entry_history.value / 10).toFixed(1);
        document.getElementById(`val-${m.entry}`).innerText = `£${val}m`;

        // Captain & Chip
        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        document.getElementById(`cap-${m.entry}`).innerHTML = `
            ${playerMap[cap.element].name} 
            ${chip ? `<span class="c-badge" style="font-size:7px; padding:1px 2px;">${chip.toUpperCase()}</span>` : ''}
        `;

        // Differentials (owned by only 1 person)
        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => 
            `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';

        // Transfers (In)
        document.getElementById(`trans-${m.entry}`).innerHTML = data.trans.map(t => 
            `<span class="mini-tag tag-in">${playerMap[t.element_in].name}</span>`).join('') || '<span style="color:#ccc">None</span>';

        // Hits
        const hits = data.picks.entry_history.event_transfer_cost;
        if (hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits}pt`;
    });

    // Remove loading overlay
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.add("hidden");
}

/**
 * Modal logic for the "Team of the Week" style squad view
 */
function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;
    
    // Sort by position GKP -> DEF -> MID -> FWD
    const sortedPicks = [...data.picks].sort((a, b) => playerMap[a.element].pos - playerMap[b.element].pos);
    
    let squadTotal = 0;
    
    list.innerHTML = sortedPicks.map(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        squadTotal += pts;
        const posLabels = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        
        return `
        <div class="squad-row" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:11px;">
            <div style="display:flex; align-items:center;">
                <span class="p-pos bg-pos-${player.pos}" style="font-size:8px; padding:1px 4px; margin-right:8px; border-radius:3px; font-weight:bold;">
                    ${posLabels[player.pos]}
                </span>
                <span style="font-weight:700; color:#37003c;">${player.name}</span>
                <span style="font-size:9px; color:#888; margin-left:6px;">${teamMap[player.team]}</span>
                ${p.is_captain ? '<span style="color:#fbbf24; margin-left:4px;">★</span>' : ''}
            </div>
            <span style="font-weight:900; font-size:13px; color:#249771;">${pts}</span>
        </div>`;
    }).join('') + `
    <div style="padding:15px 0 5px 0; text-align:right; font-weight:900; font-size:18px; color:#37003c; border-top:2px solid #f0f0f0; margin-top:10px;">
        <small style="font-size:10px; color:#999; text-transform:uppercase;">Live Squad Total</small><br>
        ${squadTotal} <small style="font-size:11px;">PTS</small>
    </div>`;
    
    modal.classList.remove("hidden");
    document.body.style.overflow = 'hidden'; // Stop background scroll
}

// Modal Close logic
document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
    document.body.style.overflow = 'auto';
};

// Initialize
document.addEventListener("DOMContentLoaded", fetchProLeague);