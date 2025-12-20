// 1. Mobile Menu Toggle
const menuToggle = document.getElementById('mobile-menu');
const mainNav = document.getElementById('main-nav');

menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('active');
});

// 2. League Mapping Configuration
const LEAGUE_MAP = {
    'PL': 'English Premier League',
    'PD': 'La Liga',
    'SA': 'Serie A',
    'BL1': 'Bundesliga',
    'FL1': 'Ligue 1',
    'CL': 'Champions League',
    'DED': 'Eredivisie',
    'ELC': 'Championship'
};

// State variable to track the active league (defaults to EPL)
let activeLeague = 'PL';

// 3. The Switcher Function
// This is called when a user clicks a league button
async function switchLeague(leagueId) {
    activeLeague = leagueId;

    // Update the UI Header
    const titleElement = document.getElementById('section-title');
    if (titleElement) titleElement.innerText = LEAGUE_MAP[leagueId];

    // Highlight the active button
    document.querySelectorAll('.league-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(leagueId)) {
            btn.classList.add('active');
        }
    });

    // Refresh the data
    init();
}

// 4. API Configuration & Data Fetching
async function init() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';

    // We now build the URL dynamically using the activeLeague variable
    const PROXY_URL = `/api/competitions/${activeLeague}/`; 
    
    try {
        const [standingsRes, scorersRes, fixturesRes] = await Promise.all([
            fetch(`${PROXY_URL}standings`),
            fetch(`${PROXY_URL}scorers`),
            getFixtures(PROXY_URL) // Pass URL to the helper
        ]);

        const sData = await standingsRes.json();
        const scData = await scorersRes.json();
        const fData = await fixturesRes.json();

        // Standard Table Rendering
        if (sData.standings) {
            // Champions League has a different data structure (multiple groups)
            // This line ensures we grab the first table available
            renderStandings(sData.standings[0].table);
        }
        
        if (scData.scorers) renderScorers(scData.scorers);
        if (fData.matches) renderFixtures(fData.matches);

    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    } finally {
        loader.style.display = 'none';
    }
}

// Helper to get fixtures based on current league
async function getFixtures(url) {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 10);
    return fetch(`${url}matches?dateFrom=${today}&dateTo=${nextWeek.toISOString().split('T')[0]}`);
}

// 5. Render Functions (Your working logic, kept intact)
function renderStandings(data) {
    const body = document.getElementById('standings-body');
    body.innerHTML = data.map(team => `
        <tr>
            <td>${team.position}</td>
            <td><img src="${team.team.crest}" class="crest" alt=""> ${team.team.shortName}</td>
            <td>${team.won}/${team.draw}/${team.lost}</td>
            <td>${team.goalDifference}</td>
            <td class="pts">${team.points}</td>
        </tr>
    `).join('');
}

function renderScorers(data) {
    const body = document.getElementById('scorers-body');
    body.innerHTML = data.slice(0, 10).map(s => `
        <tr>
            <td><strong>${s.player.name}</strong><br><small style="color:var(--text-dim)">${s.team.name}</small></td>
            <td class="pts">${s.goals}</td>
        </tr>
    `).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!matches || matches.length === 0) {
        list.innerHTML = '<p style="color:var(--text-dim); text-align:center;">No upcoming matches.</p>';
        return;
    }

    list.innerHTML = matches.map(m => {
        const date = new Date(m.utcDate).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="fixture-row">
                <div style="font-size:0.75rem; background:#2a2a35; padding:2px 8px; border-radius:4px;">${date}</div>
                <div style="flex:1; text-align:right;"><img src="${m.homeTeam.crest}" class="crest"> ${m.homeTeam.shortName}</div>
                <div style="padding:0 10px; color:var(--text-dim)">vs</div>
                <div style="flex:1; text-align:left;">${m.awayTeam.shortName} <img src="${m.awayTeam.crest}" class="crest"></div>
            </div>
        `;
    }).join('');
}

// Start the app with default league
init();
