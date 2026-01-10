 /**
 * FPL AI Engine - Coding Partner Edition
 * Features: Live Standings, Pitch View, Transfer Suggestions, and FDR
 */

const API_BASE = "/fpl-api/";

// 1. Configuration
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
 * Main function to fetch data and initialize the dashboard
 */
async function fetchProLeague(leagueId) {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        // Fetch Static data, League data, and Fixtures for FDR
        const [staticRes, leagueRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`),
            fetch(`${API_BASE}fixtures/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();
        const fixData = await fixRes.json();

        // Map Teams with Strength for FDR logic
        staticData.teams.forEach(t => {
            teamMap[t.id] = { 
                short_name: t.short_name, 
                strength: t.strength 
            };
        });

        // Map Players with Price and Form for Transfer AI
        staticData.elements.forEach(p => {
            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                team: p.team, 
                pos: p.element_type,
                price: p.now_cost / 10,
                form: parseFloat(p.form),
                // Find next unplayed fixture for this player's team
                next_fixture: fixData.find(f => !f.finished && (f.team_a === p.team || f.team_h === p.team))
            };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        renderTable(leagueData.standings.results);
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { 
        console.error("Error fetching FPL data:", err); 
        if (loader) loader.classList.add("hidden");
    }
}

/**
 * Renders the League Selection List
 */
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

/**
 * Helper: Logic for Fixture Difficulty Color
 */
function getFDRColor(player) {
    if (!player.next_fixture) return "#ccc";
    const isHome = player.next_fixture.team_h === player.team;
    const difficulty = isHome ? player.next_fixture.team_h_difficulty : player.next_fixture.team_a_difficulty;
    
    if (difficulty <= 2) return "#01ef80"; // Easy (Green)
    if (difficulty >= 4) return "#ff2882"; // Hard (Red)
    return "#e1e1e1"; // Neutral
}

/**
 * Transfer AI: Find top 3 replacement options
 */
function getBestReplacements(elementId, maxPrice) {
    const currentPlayer = playerMap[elementId];
    return Object.values(playerMap)
        .filter(p => p.pos === currentPlayer.pos && p.price <= maxPrice && p.id !== elementId)
        .sort((a, b) => b.form - a.form)
        .slice(0, 3);
}

/**
 * Renders the Standings Table
 */
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

/**
 * Intelligence logic (Captain, Chips, Transfers)
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

/**
 * Team Mapping for Jersey CSS
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
 * Modal Handling (Jersey Pitch + Hub Intelligence)
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
    let transferAdvice = [];

    data.picks.forEach(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        if (p.multiplier > 0) squadTotal += pts;
        
        const kitClass = player.pos === 1 ? 'gkp_color' : getTeamClass(player.team);
        const fdrColor = getFDRColor(player);

        // Weak link identification logic
        if (player.form < 2.0 && p.multiplier > 0) {
            const best = getBestReplacements(p.element, player.price + 0.5);
            if (best.length > 0) {
                transferAdvice.push(`<div><strong>Sell ${player.name}:</strong> Buy ${best[0].name} (Form: ${best[0].form})</div>`);
            }
        }

        const playerHTML = `
            <div class="slot" style="width: 65px; display:flex; flex-direction:column; align-items:center; position:relative;">
                <div class="fdr-indicator" style="background:${fdrColor}; width:6px; height:6px; border-radius:50%; position:absolute; top:0; right:10px;"></div>
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
        <div class="hub-intelligence" style="background:#1a1a1a; padding:15px; border-radius:8px; margin-top:15px; color:#fff; font-size:11px;">
            <h4 style="color:var(--fpl-blue); margin-bottom:10px;">Hub Transfer Recommendations</h4>
            ${transferAdvice.length > 0 ? transferAdvice.join('') : 'Squad looks solid! No urgent transfers suggested.'}
        </div>
        <div class="modal-footer">
            <span class="total-label">Live Score</span>
            <span class="total-value">${squadTotal} PTS</span>
        </div>
    `;
    modal.classList.remove("hidden");
    document.body.style.overflow = 'hidden'; 
}

/**
 * Event Listeners & Init
 */
document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
    document.body.style.overflow = ''; 
};

document.addEventListener("DOMContentLoaded", () => {
    renderLeagueSelector();
});
