// --- 1. Configuration & State ---
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
let rawStandingsData = [];
let currentView = 'total';
let lastFetchTime = null;

// --- 2. Navigation & Drawer ---
const menuBtn = document.getElementById('menu-btn');
const closeBtn = document.getElementById('close-btn');
const drawer = document.getElementById('side-drawer');
const backdrop = document.getElementById('backdrop');

const toggleDrawer = (open) => {
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('active', open);
};

if(menuBtn) menuBtn.onclick = () => toggleDrawer(true);
if(closeBtn) closeBtn.onclick = () => toggleDrawer(false);
if(backdrop) backdrop.onclick = () => toggleDrawer(false);

// --- 3. Core Initialization & Caching ---
async function init() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('hidden');

    const PROXY_URL = `/api/competitions/${activeLeague}/`;
    const CACHE_KEY = `football_data_${activeLeague}`;
    const CACHE_EXPIRY = 60 * 60 * 1000; // 1 Hour

    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const now = Date.now();

        if (now - parsed.timestamp < CACHE_EXPIRY) {
            lastFetchTime = parsed.timestamp;
            renderAllSections(parsed.data, parsed.timestamp);
            if (loader) loader.classList.add('hidden');
            return;
        }
    }

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

        lastFetchTime = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: lastFetchTime,
            data: data
        }));

        renderAllSections(data, lastFetchTime);
    } catch (err) {
        console.error("Sync Error:", err);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

async function getFixtures(url) {
    const start = new Date();
    start.setDate(start.getDate() - 3); // 3 days ago for results
    const end = new Date();
    end.setDate(end.getDate() + 7); // 7 days ahead
    return fetch(`${url}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
}

// --- 4. Rendering Logic ---
function renderAllSections(data, timestamp) {
    if (data.standings.standings) {
        renderStandings(data.standings.standings[0].table, currentView);
    }
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
        const formHtml = team.form ? team.form.split(',').map(res => {
            const color = res === 'W' ? '#00ff87' : (res === 'D' ? '#ffaa00' : '#ff005a');
            return `<span class="form-dot" style="background:${color}"></span>`;
        }).join('') : '';

        return `
            <tr>
                <td style="font-weight:bold;">${team.position}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${team.team.crest}" style="width:18px;"> 
                        <span>${team.team.shortName}</span>
                    </div>
                </td>
                <td style="text-align:center;">${stats.played}</td>
                <td style="text-align:right; font-weight:900;">${stats.points}</td>
                <td><div class="form-container">${formHtml}</div></td>
            </tr>
        `;
    }).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;

    list.innerHTML = matches.map(m => {
        const date = new Date(m.utcDate).toLocaleDateString([], {day:'numeric', month:'short'});
        const time = new Date(m.utcDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const isFinished = m.status === 'FINISHED';
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';

        let scoreDisplay = `<div style="width:40px; text-align:center; color:#ccc;">VS</div>`;
        if (isFinished || isLive) {
            scoreDisplay = `<div class="score-pill ${isLive ? 'live' : ''}">${m.score.fullTime.home} - ${m.score.fullTime.away}</div>`;
        }

        return `
            <div class="fixture-row">
                <div class="f-date">${date}<br>${time}</div>
                <div class="f-team right">${m.homeTeam.shortName} <img src="${m.homeTeam.crest}"></div>
                ${scoreDisplay}
                <div class="f-team left"><img src="${m.awayTeam.crest}"> ${m.awayTeam.shortName}</div>
            </div>
        `;
    }).join('');
}

// --- 5. Interactive UI Helpers ---
function toggleStandings(view) {
    renderStandings(rawStandingsData, view);
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
}

async function forceRefresh() {
    const icon = document.querySelector('.search-btn i');
    if (icon) icon.classList.add('fa-spin');
    localStorage.removeItem(`football_data_${activeLeague}`);
    await init();
    if (icon) icon.classList.remove('fa-spin');
}

function updateTimestampUI(timestamp) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    el.innerHTML = `<i class="fas fa-history"></i> ${mins === 0 ? 'Just now' : mins + 'm ago'}`;
}

async function switchLeague(leagueId) {
    activeLeague = leagueId;
    const title = document.getElementById('active-gw-label');
    if (title) title.innerText = leagueId;
    toggleDrawer(false);
    init();
}

// Initialize
document.addEventListener("DOMContentLoaded", init);
