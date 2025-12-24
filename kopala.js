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

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}">
            <td>${m.rank}</td>
            <td class="manager-col" onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
                <div class="m-info-wrapper">
                    <span class="m-name">${m.player_name}</span>
                    <span class="t-name">${m.entry_name}</span>
                    <span id="val-${m.entry}" class="val-text">£--.-m Value</span>
                </div>
            </td>
            <td>
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" class="hits"></div>
            </td>
            <td>
                <div class="bold-p">${m.total}</div>
                <div id="proj-${m.entry}" style="font-size:8px; color:#007bff;"></div>
            </td>
            <td id="cap-${m.entry}">—</td>
            <td><div id="diffs-${m.entry}" class="diff-col-scroll">...</div></td>
            <td><div id="trans-${m.entry}" class="trans-col-scroll">...</div></td>
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

        // Team Value Update
        const value = (data.picks.entry_history.value / 10).toFixed(1);
        document.getElementById(`val-${m.entry}`).innerText = `£${value}m Value`;

        // Captain & Chip
        const cap = data.picks.picks.find(p => p.is_captain);
        const chip = data.picks.active_chip;
        document.getElementById(`cap-${m.entry}`).innerHTML = `
            ${playerMap[cap.element].name} ${chip ? `<span class="c-badge">${chip.toUpperCase()}</span>` : ''}
        `;

        // Diffs
        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => 
            `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';

        // Transfers
        document.getElementById(`trans-${m.entry}`).innerHTML = data.trans.map(t => 
            `<span class="mini-tag tag-in">${playerMap[t.element_in].name}</span>`).join('') || 'None';
            
        // Hits
        const hits = data.picks.entry_history.event_transfer_cost;
        if (hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits}pt`;
    });

    if (document.getElementById("loading-overlay")) document.getElementById("loading-overlay").classList.add("hidden");
}

function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;
    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;
    
    const sortedPicks = [...data.picks].sort((a, b) => playerMap[a.element].pos - playerMap[b.element].pos);
    let totalLive = 0;
    
    list.innerHTML = sortedPicks.map(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        totalLive += pts;
        return `
        <div style="display:flex; justify-content:space-between; padding:6px; border-bottom:1px solid #eee; font-size:11px;">
            <span>${player.name} (${teamMap[player.team]}) ${p.is_captain ? '★' : ''}</span>
            <span style="font-weight:800;">${pts}</span>
        </div>`;
    }).join('') + `<div style="padding:10px; text-align:right; font-weight:900; font-size:16px;">Total: ${totalLive}</div>`;
    
    modal.classList.remove("hidden");
}

document.getElementById("close-modal").onclick = () => document.getElementById("team-modal").classList.add("hidden");
document.addEventListener("DOMContentLoaded", fetchProLeague);




// Helper to map team ID to CSS class
function getTeamClass(teamId) {
    const mapping = {
        1: 'arsenal', 2: 'aston_villa', 3: 'bournemouth', 4: 'brentford', 
        5: 'brighton', 6: 'chelsea', 7: 'crystal_p', 8: 'everton', 
        9: 'fulham', 10: 'ipswich', 11: 'leicester', 12: 'liverpool', 
        13: 'man_city', 14: 'man_utd', 15: 'newcastle', 16: 'nottm_forest', 
        17: 'southampton', 18: 'tottenham', 19: 'west_ham', 20: 'wolves'
    };
    return mapping[teamId] || 'default';
}

function handleManagerClick(id, name) {
    const data = managerSquads[id];
    if (!data) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;

    // Separate players by position
    const positions = { 1: [], 2: [], 3: [], 4: [] };
    let squadTotal = 0;

    data.picks.forEach(p => {
        const player = playerMap[p.element];
        const pts = player.points * p.multiplier;
        squadTotal += pts;
        
        const isGkp = player.pos === 1;
        const kitClass = isGkp ? 'gkp_color' : getTeamClass(player.team);

        const playerHTML = `
            <div class="slot" style="width: 70px;">
                <div class="jersey ${kitClass}"></div>
                <div class="modal-player-tag">
                    <span class="m-p-name">${p.is_captain ? 'Ⓒ ' : ''}${player.name}</span>
                    <span class="m-p-pts">${pts}</span>
                </div>
            </div>`;
        
        positions[player.pos].push(playerHTML);
    });

    // Build the visual pitch
    list.innerHTML = `
        <div class="modal-pitch">
            <div class="modal-row">${positions[1].join('')}</div>
            <div class="modal-row">${positions[2].join('')}</div>
            <div class="modal-row">${positions[3].join('')}</div>
            <div class="modal-row">${positions[4].join('')}</div>
        </div>
        <div style="padding:15px 0 5px 0; text-align:right; font-weight:900; font-size:18px; color:#37003c; border-top:2px solid #f0f0f0; margin-top:10px;">
            <small style="font-size:10px; color:#999; text-transform:uppercase;">Live Squad Total</small><br>
            ${squadTotal} <small style="font-size:11px;">PTS</small>
        </div>
    `;

    modal.classList.remove("hidden");
    document.body.style.overflow = 'hidden';
}
