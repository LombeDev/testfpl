/**
 * KOPALA FPL - Ultimate Football Dashboard
 * Features: Title Predictor, 3-Week Run-In, Short Names, Top Transfers
 * Version: 6.0
 */

// 1. CONFIGURATION & DICTIONARIES
const LEAGUE_MAP = {
    'PL': 'English Premier League', 'PD': 'La Liga', 'SA': 'Serie A',
    'BL1': 'Bundesliga', 'FL1': 'Ligue 1', 'CL': 'Champions League', 'DED': 'Eredivisie'
};

const TEAM_SHORT_CODES = {
    "Manchester City FC": "MCI", "Manchester United FC": "MUN", "Arsenal FC": "ARS",
    "Liverpool FC": "LIV", "Chelsea FC": "CHE", "Tottenham Hotspur FC": "TOT",
    "Aston Villa FC": "AVL", "Newcastle United FC": "NEW", "Real Madrid CF": "RMA",
    "FC Barcelona": "BAR", "Atletico Madrid": "ATM", "Bayern München": "BAY",
    "Bayer Leverkusen": "B04", "Borussia Dortmund": "BVB", "Inter Milan": "INT",
    "Juventus FC": "JUV", "AC Milan": "MIL", "Paris Saint-Germain FC": "PSG"
};

let activeLeague = 'PL';
let rawStandingsData = [];
let rawFixturesData = [];
let currentView = 'total';

// 2. CORE INITIALIZATION
async function init() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.innerText = LEAGUE_MAP[activeLeague] || activeLeague;

    // We use a proxy to avoid CORS issues with the Football-Data.org API
    const PROXY_URL = `/api/competitions/${activeLeague}/`;
    
    try {
        const [standingsRes, scorersRes, fixturesRes] = await Promise.all([
            fetch(`${PROXY_URL}standings`),
            fetch(`${PROXY_URL}scorers`),
            getFixtures(PROXY_URL)
        ]);

        const data = {
            standings: await standingsRes.json(),
            scorers: await scorersRes.json(),
            fixtures: await fixturesRes.json()
        };

        renderAll(data, Date.now());
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

async function getFixtures(url) {
    const start = new Date();
    start.setDate(start.getDate() - 3);
    const end = new Date();
    end.setDate(end.getDate() + 21); // 3-week window for Run-In analysis
    return fetch(`${url}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
}

// 3. LOGIC HELPERS
function getShortName(team) {
    if (!team) return "???";
    return TEAM_SHORT_CODES[team.name] || team.shortName || team.name.substring(0, 3).toUpperCase();
}

function getNextThree(teamId) {
    return rawFixturesData
        .filter(m => m.status === 'TIMED' || m.status === 'SCHEDULED')
        .filter(m => m.homeTeam.id === teamId || m.awayTeam.id === teamId)
        .slice(0, 3)
        .map(m => {
            const isHome = m.homeTeam.id === teamId;
            const opponent = isHome ? m.awayTeam : m.homeTeam;
            // Difficulty logic: Red if opponent is Top 6
            const oppStanding = rawStandingsData.find(t => t.team.id === opponent.id);
            const isHard = oppStanding && oppStanding.position <= 6;
            return `<span class="run-in-dot ${isHard ? 'diff-hard' : 'diff-easy'}">${getShortName(opponent)}</span>`;
        }).join('');
}

// 4. RENDERING FUNCTIONS
function renderAll(data, timestamp) {
    if (data.standings.standings) {
        rawStandingsData = data.standings.standings[0].table;
        rawFixturesData = data.fixtures.matches || [];
        renderStandings(rawStandingsData, currentView);
        renderTitlePredictor(rawStandingsData);
    }
    if (data.scorers.scorers) renderScorers(data.scorers.scorers);
    if (data.fixtures.matches) renderFixtures(data.fixtures.matches);
    
    // For PL, we can mock/fetch transfer trends (FPL specific)
    if (activeLeague === 'PL') renderTransfers();
    
    updateTimestampUI(timestamp);
}

function renderTitlePredictor(table) {
    const container = document.querySelector('.container');
    let predictorCard = document.getElementById('title-predictor');
    if (!predictorCard) {
        predictorCard = document.createElement('div');
        predictorCard.id = 'title-predictor';
        container.insertBefore(predictorCard, document.querySelector('.dashboard-grid'));
    }

    // Formula: Points + (Goal Difference / 2)
    const sorted = [...table].sort((a, b) => (b.points + b.goalDifference*0.5) - (a.points + a.goalDifference*0.5));
    const favorite = sorted[0];

    predictorCard.innerHTML = `
        <div class="card predictor-gradient">
            <div class="predictor-content">
                <div>
                    <span class="label">AI TITLE PREDICTION</span>
                    <h2 class="winner-name">${favorite.team.name}</h2>
                    <p class="stat">Proj. Win Chance: ${Math.round((favorite.points/table[1].points)*55)}%</p>
                </div>
                <img src="${favorite.team.crest}" class="predictor-crest">
            </div>
        </div>
    `;
}

function renderStandings(tableData, view = 'total') {
    const body = document.getElementById('standings-body');
    if (!body) return;
    body.innerHTML = tableData.map(team => {
        const stats = view === 'home' ? team.home : (view === 'away' ? team.away : team);
        const runInHTML = team.position <= 4 ? `<div class="run-in-container">${getNextThree(team.team.id)}</div>` : '';

        return `
            <tr class="${team.position <= 4 ? 'cl-zone' : (team.position >= 18 ? 'rel-zone' : '')}">
                <td class="center-text">${team.position}</td>
                <td>
                    <div class="team-cell">
                        <img src="${team.team.crest}" class="table-crest"> 
                        <span class="team-name-text"><strong>${getShortName(team.team)}</strong></span>
                        ${runInHTML}
                    </div>
                </td>
                <td class="center-text gd-cell">${team.goalDifference}</td>
                <td class="pts-cell center-text"><strong>${stats.points}</strong></td>
            </tr>
        `;
    }).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;
    list.innerHTML = matches.slice(0, 10).map(m => {
        const isLive = m.status === 'IN_PLAY';
        return `
            <div class="fixture-mini-row">
                <div class="f-team-side right">${getShortName(m.homeTeam)} <img src="${m.homeTeam.crest}"></div>
                <div class="f-score-side">
                    ${isLive || m.status === 'FINISHED' ? `<span class="score-badge">${m.score.fullTime.home}-${m.score.fullTime.away}</span>` : '<span class="vs-text">VS</span>'}
                </div>
                <div class="f-team-side left"><img src="${m.awayTeam.crest}"> ${getShortName(m.awayTeam)}</div>
            </div>
        `;
    }).join('');
}

function renderScorers(scorers) {
    const body = document.getElementById('scorers-body');
    if (!body) return;
    body.innerHTML = scorers.slice(0, 8).map(s => `
        <tr>
            <td class="player-cell"><strong>${s.player.name}</strong><br><small>${getShortName(s.team)}</small></td>
            <td class="goal-count">${s.goals}</td>
        </tr>
    `).join('');
}

function renderTransfers() {
    // This targets a specific div for FPL Market Trends
    const transferBox = document.getElementById('transfer-trends');
    if (!transferBox) return;

    const mockTransfers = [
        { name: "Haaland", status: "in", count: "142k" },
        { name: "Salah", status: "in", count: "98k" },
        { name: "Saka", status: "out", count: "54k" }
    ];

    transferBox.innerHTML = `
        <h3 class="card-title">FPL Market Trends</h3>
        <div class="transfer-list">
            ${mockTransfers.map(t => `
                <div class="transfer-item">
                    <span>${t.name}</span>
                    <span class="trend-${t.status}">${t.status === 'in' ? '▲' : '▼'} ${t.count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// 5. UTILS
function switchLeague(id) {
    activeLeague = id;
    init();
}

function toggleStandings(view) {
    currentView = view;
    renderStandings(rawStandingsData, view);
}

function updateTimestampUI(ts) {
    const el = document.getElementById('last-updated');
    if (el) {
        const mins = Math.floor((Date.now() - ts) / 60000);
        el.innerHTML = `<i class="fas fa-history"></i> ${mins === 0 ? 'Just now' : mins + 'm ago'}`;
    }
}

document.addEventListener('DOMContentLoaded', init);
