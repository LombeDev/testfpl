// script.js - Full Integrated Version for Netlify Deployment

// 1. GLOBAL VARIABLES & CONFIG
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
let allPlayers = [];
let livePointsMap = {};
let currentGW = 1;
let currentUserLeagues = [];

// 2. INITIALIZATION (Runs on Page Load)
async function init() {
    console.log("Initializing FPL App...");
    try {
        // Fetch bootstrap-static to get players and current gameweek
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        allPlayers = data.elements;
        
        // Find the active gameweek
        const activeEvent = data.events.find(e => e.is_current);
        if (activeEvent) {
            currentGW = activeEvent.id;
            console.log(`Current Gameweek: ${currentGW}`);
        }

        // Load Dark Mode Preference
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            const darkToggle = document.getElementById('dark-mode-toggle');
            if (darkToggle) darkToggle.checked = true;
        }
    } catch (e) {
        console.error("Initialization failed. Make sure your Netlify Function is deployed.", e);
    }
}

// 3. LOGIN LOGIC
async function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Please enter a valid Team ID");

    try {
        // Fetch manager details and leagues
        const res = await fetch(`${PROXY_ENDPOINT}entry/${teamId}/`);
        const data = await res.json();
        
        currentUserLeagues = data.leagues.classic;
        populateLeagueSelector(currentUserLeagues);
        
        // Switch views
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Load the first league in the list by default
        if (currentUserLeagues.length > 0) {
            changeLeague(currentUserLeagues[0].id);
        }
    } catch (e) {
        alert("Could not find manager. Check your Team ID and internet connection.");
    }
}

// 4. LEAGUE & TABLE LOGIC
function populateLeagueSelector(leagues) {
    const select = document.getElementById('league-select');
    select.innerHTML = leagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function changeLeague(leagueId) {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        renderTable(data.standings.results);
    } catch (e) {
        console.error("Error loading league standings:", e);
    }
}

function renderTable(rows) {
    const body = document.getElementById('league-body');
    body.innerHTML = rows.map(r => `
        <tr onclick="loadPitchView(${r.entry})">
            <td>${r.rank}</td>
            <td>
                <strong>${r.entry_name}</strong><br>
                <small>${r.player_name}</small>
            </td>
            <td class="score-text">${r.event_total}</td>
            <td><strong>${r.total}</strong></td>
        </tr>
    `).join('');
}

// 5. PITCH VIEW & LIVE POINTS LOGIC
async function fetchLivePoints() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}event/${currentGW}/live/`);
        const data = await res.json();
        
        // Create a map of [playerID]: points
        data.elements.forEach(item => {
            livePointsMap[item.id] = item.stats.total_points;
        });
    } catch (e) {
        console.error("Failed to fetch live points:", e);
    }
}

async function loadPitchView(managerId) {
    showView('pitch');
    
    try {
        // Fetch the specific team picks for the week
        const res = await fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${currentGW}/picks/`);
        const data = await res.json();
        const picks = data.picks;

        // Ensure we have the latest live points
        await fetchLivePoints();

        // Clear existing rows
        const rows = ['row-gkp', 'row-def', 'row-mid', 'row-fwd'];
        rows.forEach(id => document.getElementById(id).innerHTML = '');

        // Render starters (first 11)
        picks.slice(0, 11).forEach(pick => {
            const playerData = allPlayers.find(p => p.id === pick.element);
            const points = (livePointsMap[playerData.id] || 0) * pick.multiplier;
            
            const playerHtml = `
                <div class="player-card">
                    <div class="img-wrapper">
                        <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerData.code}.png" 
                             onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.42875322.png'" 
                             class="player-img">
                        ${pick.is_captain ? '<span class="c-badge">C</span>' : ''}
                    </div>
                    <div class="player-name-tag">${playerData.web_name}</div>
                    <div class="player-points-tag">${points}</div>
                </div>
            `;

            const rowId = getRowId(playerData.element_type);
            document.getElementById(rowId).innerHTML += playerHtml;
        });
    } catch (e) {
        console.error("Error loading team on pitch:", e);
    }
}

function getRowId(type) {
    switch(type) {
        case 1: return 'row-gkp';
        case 2: return 'row-def';
        case 3: return 'row-mid';
        case 4: return 'row-fwd';
        default: return 'row-mid';
    }
}

// 6. UI UTILITIES
function showView(view) {
    const tableView = document.getElementById('table-view');
    const pitchView = document.getElementById('pitch-view');
    
    if (view === 'table') {
        tableView.style.display = 'block';
        pitchView.style.display = 'none';
    } else {
        tableView.style.display = 'none';
        pitchView.style.display = 'flex';
    }

    // Update Tab UI
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === view);
    });
}

function toggleSettings() {
    document.getElementById('settings-drawer').classList.toggle('open');
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Run init on load
init();
