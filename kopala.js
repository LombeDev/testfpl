const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; // Store full pick data for popups

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

        // 1. Map Teams (e.g., 1 -> "ARS")
        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);

        // 2. Map Players
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
        console.error("Fetch Error:", err);
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => {
        return `
        <tr id="row-${m.entry}">
            <td class="rank-col"><div>${m.rank}</div></td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')" style="cursor:pointer">
                <div class="m-name">${m.player_name}</div>
                <div class="t-name">${m.entry_name}</div>
            </td>
            <td class="pts-col"><div class="live-pts">${m.event_total}</div></td>
            <td class="total-col"><div class="bold-p">${m.total}</div></td>
            <td id="cap-${m.entry}" class="cap-col">—</td>
            <td id="diffs-${m.entry}" class="diff-col">...</td>
            <td id="transfers-${m.entry}" class="trans-col">...</td>
        </tr>`;
    }).join('');
}

async function loadLeagueIntelligence(managers, eventId) {
    const promises = managers.map(async (m) => {
        try {
            const [picksRes, transRes] = await Promise.all([
                fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
                fetch(`${API_BASE}entry/${m.entry}/transfers/`)
            ]);
            const picksData = await picksRes.json();
            const transData = await transRes.json();

            // Store for popup
            managerSquads[m.entry] = picksData;

            // Update Captain Cell
            const cap = picksData.picks.find(p => p.is_captain);
            document.getElementById(`cap-${m.entry}`).innerText = playerMap[cap.element].name;

        } catch (e) { console.warn(e); }
    });
    await Promise.all(promises);
}

function handleManagerClick(managerId, managerName) {
    const data = managerSquads[managerId];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    const title = document.getElementById("modal-manager-name");

    title.textContent = managerName;
    
    // Sort squad by Position
    const sortedPicks = [...data.picks].sort((a, b) => playerMap[a.element].pos - playerMap[b.element].pos);
    
    let squadTotal = 0;

    list.innerHTML = sortedPicks.map(pick => {
        const p = playerMap[pick.element];
        const isCap = pick.is_captain;
        const multiplier = pick.multiplier;
        const livePoints = p.points * multiplier;
        squadTotal += livePoints;

        return `
            <div class="squad-row ${pick.position > 11 ? 'bench-player' : ''}">
                <div style="display: flex; align-items: center;">
                    <span class="p-pos bg-pos-${p.pos}">${getPosLabel(p.pos)}</span>
                    <span class="p-name">${p.name}</span>
                    <span class="p-team-code">${teamMap[p.team]}</span>
                    ${isCap ? `<span class="c-star">★</span>` : ''}
                </div>
                <div style="text-align: right;">
                    <span class="p-pts">${livePoints}</span>
                </div>
            </div>`;
    }).join('') + `
        <div class="modal-footer">
            <span class="total-label">Squad Live Total</span>
            <span class="total-value">${squadTotal} <small style="font-size:10px">PTS</small></span>
        </div>
    `;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Prevent background scroll

    document.getElementById("close-modal").onclick = () => {
        modal.classList.add("hidden");
        document.body.style.overflow = "auto";
    };
}

function getPosLabel(pos) {
    return { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }[pos];
}

document.addEventListener("DOMContentLoaded", fetchProLeague);