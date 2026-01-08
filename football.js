/**
 * KOPALA FPL - Smart Football Dashboard
 * Version: 3.0 (Win Probability & Value Engine)
 */

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

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
            renderAll(parsed.data, parsed.timestamp);
            if (loader) loader.style.display = 'none';
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
    start.setDate(start.getDate() - 3);
    const end = new Date();
    end.setDate(end.getDate() + 10);
    return fetch(`${url}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
}

// --- 3. Probability & Value Engines ---

function calculateProbabilities(homeTeamName, awayTeamName) {
    const home = rawStandingsData.find(t => t.team.shortName === homeTeamName || t.team.name === homeTeamName);
    const away = rawStandingsData.find(t => t.team.shortName === awayTeamName || t.team.name === awayTeamName);

    if (!home || !away) return { homeWin: 33, draw: 34, awayWin: 33 };

    // Power Rating: (PPG * 1.5) + (GD / GamesPlayed) + Home Advantage
    const hPPG = home.points / home.playedGames;
    const aPPG = away.points / away.playedGames;
    
    const homePower = (hPPG * 15) + (home.goalDifference / 2) + 5; 
    const awayPower = (aPPG * 15) + (away.goalDifference / 2);

    const totalPower = homePower + awayPower;
    const drawProb = 26; 
    const remaining = 100 - drawProb;

    return {
        homeWin: Math.round((homePower / totalPower) * remaining),
        draw: drawProb,
        awayWin: Math.round((awayPower / totalPower) * remaining)
    };
}

function detectValue(probs, homeTeamName, awayTeamName) {
    const home = rawStandingsData.find(t => t.team.shortName === homeTeamName);
    const away = rawStandingsData.find(t => t.team.shortName === awayTeamName);
    
    if (!home || !away) return null;

    // Logic: If Away team is lower in table but has >35% win prob
    if (away.position > home.position && probs.awayWin > 35) {
        return { type: 'underdog', label: 'Underdog Value' };
    }
    // Logic: High draw probability in mid-table clashes
    if (probs.draw > 28 && Math.abs(home.position - away.position) < 4) {
        return { type: 'draw', label: 'Value Draw' };
    }
    return null;
}

// --- 4. Rendering ---

function renderAll(data, timestamp) {
    if (data.standings.standings) {
        rawStandingsData = data.standings.standings[0].table;
        renderStandings(rawStandingsData, currentView);
    }
    if (data.scorers.scorers) renderScorers(data.scorers.scorers);
    if (data.fixtures.matches) renderFixtures(data.fixtures.matches);
    updateTimestampUI(timestamp);
}

function renderStandings(tableData, view = 'total') {
    const body = document.getElementById('standings-body');
    if (!body) return;

    body.innerHTML = tableData.map(team => {
        const stats = view === 'home' ? team.home : (view === 'away' ? team.away : team);
        
        let zoneClass = "";
        if (team.position <= 4) zoneClass = "cl-zone";
        else if (team.position >= 18) zoneClass = "rel-zone";

        const formHTML = (team.form || "").split(',').slice(-5).map(res => 
            `<div class="form-pill pill-${res}">${res}</div>`
        ).join('');

        return `
            <tr class="${zoneClass}">
                <td style="text-align:center; font-weight:900;">${team.position}</td>
                <td>
                    <div class="team-cell">
                        <img src="${team.team.crest}" class="crest"> 
                        <span class="t-name"><strong>${team.team.shortName}</strong></span>
                    </div>
                </td>
                <td class="center">${stats.playedGames}</td>
                <td class="center">${stats.won}/${stats.draw}/${stats.lost}</td>
                <td class="center" style="color: ${team.goalDifference >= 0 ? '#00ff87' : '#ff005a'}">
                    ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}
                </td>
                <td class="pts-cell">${stats.points}</td>
                <td><div class="form-container">${formHTML}</div></td>
            </tr>
        `;
    }).join('');
}

function renderScorers(scorers) {
    const body = document.getElementById('scorers-body');
    if (!body) return;
    const leadGoals = scorers[0]?.goals || 1;

    body.innerHTML = scorers.slice(0, 10).map(s => `
        <tr>
            <td>
                <div class="player-name">${s.player.name}</div>
                <div class="player-team">${s.team.shortName}</div>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex-grow:1; background:var(--fpl-border); height:6px; border-radius:10px;">
                        <div style="width:${(s.goals/leadGoals)*100}%; background:var(--fpl-primary); height:100%; border-radius:10px;"></div>
                    </div>
                    <span style="font-weight:bold;">${s.goals}</span>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderFixtures(matches) {
    const list = document.getElementById('fixtures-list');
    if (!list) return;

    list.innerHTML = matches.map(m => {
        const probs = calculateProbabilities(m.homeTeam.shortName, m.awayTeam.shortName);
        const value = detectValue(probs, m.homeTeam.shortName, m.awayTeam.shortName);
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';

        return `
            <div class="fixture-row smart-fixture ${value ? 'has-value' : ''}">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-size:0.7rem; opacity:0.6;">${new Date(m.utcDate).toLocaleDateString([], {day:'numeric', month:'short'})}</span>
                    ${value ? `<span class="value-badge ${value.type}">${value.label}</span>` : ''}
                </div>
                <div class="f-main" style="display:flex; align-items:center; justify-content:space-between;">
                    <div class="f-team" style="text-align:right; flex:1;">
                        <strong>${m.homeTeam.shortName}</strong> <img src="${m.homeTeam.crest}" style="width:20px; vertical-align:middle; margin-left:5px;">
                    </div>
                    <div class="f-score" style="flex:0.5; text-align:center;">
                        ${isLive || m.status === 'FINISHED' 
                            ? `<span class="score-pill ${isLive ? 'live' : ''}">${m.score.fullTime.home} - ${m.score.fullTime.away}</span>` 
                            : '<span class="vs-label">VS</span>'}
                    </div>
                    <div class="f-team" style="text-align:left; flex:1;">
                        <img src="${m.awayTeam.crest}" style="width:20px; vertical-align:middle; margin-right:5px;"> <strong>${m.awayTeam.shortName}</strong>
                    </div>
                </div>
                <div class="prediction-container">
                    <div class="prob-bar">
                        <div class="prob-segment home" style="width: ${probs.homeWin}%"></div>
                        <div class="prob-segment draw" style="width: ${probs.draw}%"></div>
                        <div class="prob-segment away" style="width: ${probs.awayWin}%"></div>
                    </div>
                    <div class="prob-labels">
                        <span>${probs.homeWin}% Home</span>
                        <span>Draw</span>
                        <span>${probs.awayWin}% Away</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- 5. UI Actions ---
function switchLeague(id) {
    activeLeague = id;
    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.innerText = LEAGUE_MAP[id] || id;
    init();
}

function toggleStandings(view) {
    currentView = view;
    renderStandings(rawStandingsData, view);
}

function updateTimestampUI(ts) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const mins = Math.floor((Date.now() - ts) / 60000);
    el.innerHTML = `<i class="fas fa-history"></i> ${mins === 0 ? 'Just now' : mins + 'm ago'}`;
}

document.addEventListener('DOMContentLoaded', init);
