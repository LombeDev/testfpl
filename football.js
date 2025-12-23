// --- 1. State & Config ---
const LEAGUE_MAP = {
    'PL': 'English Premier League',
    'PD': 'La Liga',
    'SA': 'Serie A',
    'BL1': 'Bundesliga',
    'FL1': 'Ligue 1',
    'CL': 'Champions League',
    'DED': 'Eredivisie'
};

let activeLeague = 'PL';
let rawStandingsData = [];
let currentView = 'total';

// --- 2. Core Logic ---
async function init() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const PROXY_URL = `/api/competitions/${activeLeague}/`;
    const CACHE_KEY = `fb_data_${activeLeague}`;
    const CACHE_EXPIRY = 60 * 60 * 1000; // 1 Hour

    // Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
            renderAll(parsed.data, parsed.timestamp);
            if (loader) loader.style.display = 'none';
            return;
        }
    }

    // Fetch Fresh Data
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

        const timestamp = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp, data }));
        renderAll(data, timestamp);
    } catch (err) {
        console.error("Dashboard Error:", err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

async function getFixtures(url) {
    const start = new Date();
    start.setDate(start.getDate() - 3); // Results from 3 days ago
    const end = new Date();
    end.setDate(end.getDate() + 10); // Fixtures for next 10 days
    return fetch(`${url}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
}

// --- 3. Rendering ---
function renderAll(data, timestamp) {
    if (data.standings.standings) renderStandings(data.standings.standings[0].table, currentView);
    if (data.scorers.scorers) renderScorers(data.scorers.scorers);
    if (data.fixtures.matches) renderFixtures(data.fixtures.matches);
    updateTimestampUI(timestamp);
}

function renderStandings(tableData, view = 'total') {
    const body = document.getElementById('standings-body');
    if (!body) return;
    rawStandingsData = tableData;

    body.innerHTML = tableData.map(team => {
        const stats = view === 'home' ? team.home : (view === 'away' ? team.away : team);
        return `
            <tr>
                <td style="font-weight:bold;">${team.position}</td>
                <td>
                    <div class="team-cell">
                        <img src="${team.team.crest}" class="crest"> 
                        <span class="t-name">${team.team.shortName}</span>
                    </div>
                </td>
                <td class="center">${stats.won}/${stats.draw}/${stats.lost}</td>
                <td class="center">${team.goalDifference}</td>
                <td class="pts-cell">${stats.points}</td>
            </tr>
        `;
    }).join('');
}

function renderScorers(scorers) {
    const body = document.getElementById('scorers-body');
    if (!body) return;
    body.innerHTML = scorers.slice(0, 10).map(s => `
        <tr>
            <td>
                <div class="player-name">${s.player.name}</div>
                <div class="player-team">${s.team.shortName}</div>
            </td>
            <td class="goal-cell">${s.goals}</td>
        </tr>
    `).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;

    list.innerHTML = matches.map(m => {
        const date = new Date(m.utcDate).toLocaleDateString([], {day:'numeric', month:'short'});
        const time = new Date(m.utcDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
        const isFinished = m.status === 'FINISHED';

        let scoreHTML = `<div class="vs-label">VS</div>`;
        if (isLive || isFinished) {
            scoreHTML = `<div class="score-pill ${isLive ? 'live' : ''}">${m.score.fullTime.home} - ${m.score.fullTime.away}</div>`;
        }

        return `
            <div class="fixture-row">
                <div class="f-time">${date}<br>${time}</div>
                <div class="f-home">${m.homeTeam.shortName} <img src="${m.homeTeam.crest}"></div>
                <div class="f-score">${scoreHTML}</div>
                <div class="f-away"><img src="${m.awayTeam.crest}"> ${m.awayTeam.shortName}</div>
            </div>
        `;
    }).join('');
}

// --- 4. UI Actions ---
function switchLeague(id) {
    activeLeague = id;
    document.getElementById('section-title').innerText = LEAGUE_MAP[id] || id;
    document.querySelectorAll('.league-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(id)));
    init();
}

function toggleStandings(view) {
    currentView = view;
    renderStandings(rawStandingsData, view);
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(view)));
}

async function forceRefresh() {
    const btn = document.querySelector('.search-btn i');
    btn.classList.add('fa-spin');
    localStorage.removeItem(`fb_data_${activeLeague}`);
    await init();
    btn.classList.remove('fa-spin');
}

function updateTimestampUI(ts) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const mins = Math.floor((Date.now() - ts) / 60000);
    el.innerHTML = `<i class="fas fa-history"></i> ${mins === 0 ? 'Just now' : mins + 'm ago'}`;
}

document.addEventListener('DOMContentLoaded', init);
