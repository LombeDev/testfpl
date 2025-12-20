// --- 1. Navigation & Drawer Logic ---
const openBtn = document.getElementById('open-drawer');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

// Toggle Drawer (Re-using logic from AI page for consistency)
const toggleMenu = (open) => {
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('active', open);
};

if (openBtn) openBtn.onclick = () => toggleMenu(true);
if (backdrop) backdrop.onclick = () => toggleMenu(false);

// --- 2. League Configuration ---
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

let activeLeague = 'PL';

// --- 3. The Switcher Function ---
async function switchLeague(leagueId) {
    activeLeague = leagueId;

    // Update Header Text
    const titleElement = document.getElementById('section-title');
    if (titleElement) titleElement.innerText = LEAGUE_MAP[leagueId];

    // Update Active Button UI
    document.querySelectorAll('.league-btn').forEach(btn => {
        btn.classList.remove('active');
        // Check if the button's text or attribute matches
        if (btn.innerText.includes(leagueId) || btn.outerHTML.includes(`'${leagueId}'`)) {
            btn.classList.add('active');
        }
    });

    // Reset view and fetch new data
    init();
}

// --- 4. API & Data Fetching ---
async function init() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    // Note: Update this URL to match your server/proxy environment
    const PROXY_URL = `/api/competitions/${activeLeague}/`; 
    
    try {
        const [standingsRes, scorersRes, fixturesRes] = await Promise.all([
            fetch(`${PROXY_URL}standings`),
            fetch(`${PROXY_URL}scorers`),
            getFixtures(PROXY_URL)
        ]);

        const sData = await standingsRes.json();
        const scData = await scorersRes.json();
        const fData = await fixturesRes.json();

        // Render sections
        if (sData.standings) {
            // Standard leagues use index 0; CL may require group logic
            renderStandings(sData.standings[0].table);
        }
        
        if (scData.scorers) renderScorers(scData.scorers);
        if (fData.matches) renderFixtures(fData.matches);

    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

async function getFixtures(url) {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 10);
    return fetch(`${url}matches?dateFrom=${today}&dateTo=${nextWeek.toISOString().split('T')[0]}`);
}

// --- 5. Updated Render Functions (Clean White Style) ---

function renderStandings(data) {
    const body = document.getElementById('standings-body');
    if (!body) return;
    
    body.innerHTML = data.map(team => `
        <tr>
            <td style="font-weight:bold; color:#666;">${team.position}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${team.team.crest}" class="crest" style="width:20px; height:20px;"> 
                    <span class="team-name">${team.team.shortName}</span>
                </div>
            </td>
            <td style="color:#666;">${team.won}/${team.draw}/${team.lost}</td>
            <td style="color:#666;">${team.goalDifference > 0 ? '+' + team.goalDifference : team.goalDifference}</td>
            <td class="pts" style="font-weight:900; color:var(--fpl-purple);">${team.points}</td>
        </tr>
    `).join('');
}

function renderScorers(data) {
    const body = document.getElementById('scorers-body');
    if (!body) return;
    
    body.innerHTML = data.slice(0, 10).map(s => `
        <tr>
            <td>
                <div style="font-weight:bold;">${s.player.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${s.team.name}</div>
            </td>
            <td class="pts" style="text-align:right; font-weight:900;">${s.goals}</td>
        </tr>
    `).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;
    
    if (!matches || matches.length === 0) {
        list.innerHTML = '<p style="padding:20px; text-align:center; color:#999;">No upcoming matches.</p>';
        return;
    }

    list.innerHTML = matches.map(m => {
        const dateObj = new Date(m.utcDate);
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = dateObj.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        
        return `
            <div class="fixture-row" style="display:flex; align-items:center; padding:15px 0; border-bottom:1px solid #f1f5f9;">
                <div style="width:70px; font-size:0.7rem; color:var(--text-muted); font-weight:bold;">
                    ${date}<br>${time}
                </div>
                <div style="flex:1; text-align:right; font-weight:700;">
                    ${m.homeTeam.shortName} <img src="${m.homeTeam.crest}" style="width:18px; margin-left:5px; vertical-align:middle;">
                </div>
                <div style="width:40px; text-align:center; font-size:0.7rem; color:#ccc;">VS</div>
                <div style="flex:1; text-align:left; font-weight:700;">
                    <img src="${m.awayTeam.crest}" style="width:18px; margin-right:5px; vertical-align:middle;"> ${m.awayTeam.shortName}
                </div>
            </div>
        `;
    }).join('');
}

// Initial Run
init();
