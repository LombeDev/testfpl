let currentGW = 1;
let staticData = null;

// Initialization
async function init() {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    staticData = await res.json();
    currentGW = staticData.events.find(e => e.is_current).id;
    document.getElementById('active-gw-label').textContent = `GW ${currentGW}`;
}
init();

async function loadUserLeagues() {
    const teamId = document.getElementById('user-team-id').value;
    const response = await fetch(`/.netlify/functions/fpl-api?path=user&teamId=${teamId}`);
    const data = await response.json();
    
    const dropdown = document.getElementById('league-dropdown');
    data.leagues.classic.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.name;
        dropdown.appendChild(opt);
    });

    document.getElementById('id-entry-card').classList.add('hidden');
    document.getElementById('league-selector-container').classList.remove('hidden');
}

async function fetchLeagueData(leagueId) {
    if(!leagueId) return;
    const response = await fetch(`/.netlify/functions/fpl-api?path=league&leagueId=${leagueId}`);
    const data = await response.json();
    
    const tbody = document.getElementById('league-body');
    tbody.innerHTML = '';

    for (const m of data.standings.results) {
        // Calculate Live Points
        const liveRes = await fetch(`/.netlify/functions/fpl-api?path=live&gw=${currentGW}`);
        const liveData = await liveRes.json();
        const picksRes = await fetch(`/.netlify/functions/fpl-api?path=picks&teamId=${m.entry}&gw=${currentGW}`);
        const picksData = await picksRes.json();

        let liveGW = 0;
        picksData.picks.forEach(p => {
            const playerLive = liveData.elements.find(el => el.id === p.element);
            if(p.position <= 11) liveGW += (playerLive.stats.total_points * p.multiplier);
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${m.rank}</td>
            <td class="m-name" onclick="toggleTeamDropdown(${m.entry}, this)">${m.entry_name}</td>
            <td>${liveGW} <span class="live-tag">LIVE</span></td>
            <td><b>${m.total + (liveGW - m.event_total)}</b></td>
            <td><i class="fa-solid fa-chevron-down"></i></td>
        `;
        tbody.appendChild(row);
    }
    document.getElementById('table-container').classList.remove('hidden');
}

async function toggleTeamDropdown(managerId, cell) {
    const row = cell.parentElement;
    if (row.nextElementSibling?.classList.contains('squad-dropdown')) {
        row.nextElementSibling.remove();
        return;
    }

    const response = await fetch(`/.netlify/functions/fpl-api?path=picks&teamId=${managerId}&gw=${currentGW}`);
    const data = await response.json();

    const dropdownRow = document.createElement('tr');
    dropdownRow.className = 'squad-dropdown';
    
    let html = `<td colspan="5"><div class="pitch-container">`;
    data.picks.forEach(p => {
        const det = staticData.elements.find(el => el.id === p.element);
        html += `
            <div class="player-card">
                <div class="player-img-wrap">
                    <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${det.code}.png">
                </div>
                <div class="player-label">${det.web_name}</div>
            </div>`;
    });
    html += `</div></td>`;
    dropdownRow.innerHTML = html;
    row.after(dropdownRow);
}
