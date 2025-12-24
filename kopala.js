const API_BASE = "/fpl-api/";
const LEAGUE_ID = "101712";

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 

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

        staticData.teams.forEach(t => teamMap[t.id] = t.short_name);
        staticData.elements.forEach(p => {
            playerMap[p.id] = { name: p.web_name, points: p.event_points, team: p.team, pos: p.element_type };
        });

        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        renderTable(leagueData.standings.results);
        loadLeagueIntelligence(leagueData.standings.results, currentEvent);

    } catch (err) { console.error(err); }
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
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}">
            <td>${m.rank}</td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
                <div class="m-info-wrapper">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                    <span id="val-${m.entry}" class="val-text">£--.-m</span>
                </div>
            </td>
            <td class="pts-col"><div class="live-pts">${m.event_total}</div><div id="hits-${m.entry}" style="font-size:7px; color:red;"></div></td>
            <td class="total-col"><div class="bold-p">${m.total}</div></td>
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
            managerDetails[m.entry] = { picks, trans: trans.filter(t => t.event === eventId) };
            managerSquads[m.entry] = picks;
            picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
        } catch (e) { console.warn(e); }
    }));

    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        document.getElementById(`val-${m.entry}`).innerText = `£${(data.picks.entry_history.value / 10).toFixed(1)}m`;
        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        document.getElementById(`cap-${m.entry}`).innerHTML = `
            ${playerMap[cap.element].name} ${chip ? `<span class="chip-badge chip-wildcard">${chip.toUpperCase()}</span>` : ''}
        `;

        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => 
            `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';

        document.getElementById(`trans-${m.entry}`).innerHTML = data.trans.map(t => 
            `<span class="mini-tag tag-in">${playerMap[t.element_in].name}</span>`).join('') || 'None';
    });
    document.getElementById("loading-overlay").classList.add("hidden");
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
                <div class="bench-label">Bench</div>
                <div class="modal-row">${bench.join('')}</div>
            </div>
        </div>
        <div class="modal-footer">
            <span class="total-label">GW Total</span>
            <span class="total-value">${squadTotal}</span>
        </div>
    `;
    modal.classList.remove("hidden");
}

document.getElementById("close-modal").onclick = () => document.getElementById("team-modal").classList.add("hidden");
document.addEventListener("DOMContentLoaded", fetchProLeague);
