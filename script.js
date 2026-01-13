const PROXY = "https://cors-anywhere.herokuapp.com/";
const BASE_URL = "https://fantasy.premierleague.com/api/";

let currentUserLeagues = [];

async function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Enter ID");

    try {
        const res = await fetch(`${PROXY}${BASE_URL}entry/${teamId}/`);
        const data = await res.json();
        
        currentUserLeagues = data.leagues.classic;
        populateLeagueSelector(currentUserLeagues);
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Load first league by default
        changeLeague(currentUserLeagues[0].id);
    } catch (e) { alert("Error fetching manager data. Check CORS proxy."); }
}

function populateLeagueSelector(leagues) {
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
        <tr>
            <td>${r.rank}</td>
            <td>${r.entry_name}<br><small>${r.player_name}</small></td>
            <td class="score-text">${r.event_total}</td>
            <td>${r.total}</td>
        </tr>
    `).join('');
}

function toggleSettings() { document.getElementById('settings-drawer').classList.toggle('open'); }

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'flex' : 'none';
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}
