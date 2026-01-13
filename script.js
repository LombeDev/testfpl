const PROXY = "https://cors-anywhere.herokuapp.com/";
const BASE_URL = "https://fantasy.premierleague.com/api/";

let allPlayers = [];
let livePointsMap = {};
let currentGW = 1;
let currentTeamId = null;

// Initialization
async function init() {
    try {
        const res = await fetch(`${PROXY}${BASE_URL}bootstrap-static/`);
        const data = await res.json();
        allPlayers = data.elements;
        const activeEvent = data.events.find(e => e.is_current);
        if (activeEvent) currentGW = activeEvent.id;
        
        // Load Dark Mode preference
        if(localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('dark-mode-toggle').checked = true;
        }
    } catch (e) { console.error("Initialization failed."); }
}

async function handleLogin() {
    const idInput = document.getElementById('team-id-input').value;
    if (!idInput) return alert("Please enter a Team ID");
    currentTeamId = idInput;

    const res = await fetch(`${PROXY}${BASE_URL}entry/${currentTeamId}/`);
    const data = await res.json();
    
    populateLeagues(data.leagues.classic);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Default load first league
    changeLeague(data.leagues.classic[0].id);
}

function populateLeagues(leagues) {
    const select = document.getElementById('league-select');
    select.innerHTML = leagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function changeLeague(leagueId) {
    const res = await fetch(`${PROXY}${BASE_URL}leagues-classic/${leagueId}/standings/`);
    const data = await res.json();
    renderTable(data.standings.results);
}

function renderTable(rows) {
    const body = document.getElementById('league-body');
    body.innerHTML = rows.map(r => `
        <tr onclick="loadPitchView(${r.entry})">
            <td>${r.rank}</td>
            <td><strong>${r.entry_name}</strong><br><small>${r.player_name}</small></td>
            <td class="score-text">${r.event_total}</td>
            <td>${r.total}</td>
        </tr>
    `).join('');
}

async function loadPitchView(managerId) {
    showView('pitch');
    const res = await fetch(`${PROXY}${BASE_URL}entry/${managerId}/event/${currentGW}/picks/`);
    const data = await res.json();
    
    await fetchLivePoints(); // Get latest scores

    ['row-gkp', 'row-def', 'row-mid', 'row-fwd'].forEach(id => document.getElementById(id).innerHTML = '');

    data.picks.slice(0, 11).forEach(pick => {
        const p = allPlayers.find(ap => ap.id === pick.element);
        const points = (livePointsMap[p.id] || 0) * pick.multiplier;
        
        const html = `
            <div class="player-card">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" class="player-img">
                <div class="player-name-tag">${p.web_name}</div>
                <div class="player-points-tag">${points}</div>
            </div>
        `;
        document.getElementById(getRowId(p.element_type)).innerHTML += html;
    });
}

async function fetchLivePoints() {
    const res = await fetch(`${PROXY}${BASE_URL}event/${currentGW}/live/`);
    const data = await res.json();
    data.elements.forEach(el => livePointsMap[el.id] = el.stats.total_points);
}

function getRowId(type) {
    return ['','row-gkp','row-def','row-mid','row-fwd'][type];
}

function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'flex' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === view));
}

function toggleSettings() { document.getElementById('settings-drawer').classList.toggle('open'); }

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

init();
