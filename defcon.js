const PROXY = "https://api.allorigins.win/raw?url=";
let teams = {}; let players = {}; 
let liveGW = 0; let prevGW = 0;
let activeView = 0;

async function initDefCon() {
    try {
        const res = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const data = await res.json();
        
        // Map data
        data.teams.forEach(t => teams[t.id] = { name: t.name, short: t.short_name });
        data.elements.forEach(p => players[p.id] = { name: p.web_name, pos: p.element_type, team: p.team });

        // Logic for current vs previous
        const curr = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        liveGW = curr.id;
        prevGW = data.events.find(e => e.is_previous)?.id || liveGW;
        
        // Initial Load
        activeView = liveGW;
        fetchStats(activeView);
    } catch (e) { console.error("FPL Init Failed", e); }
}

async function fetchStats(gwId) {
    const container = document.getElementById('defcon-list-container');
    const status = document.getElementById('gw-status-text');
    container.innerHTML = '<div style="font-size:0.7rem; opacity:0.5; padding:20px;">Fetching Live Data...</div>';

    try {
        const [fRes, lRes] = await Promise.all([
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/fixtures/?event=${gwId}`)),
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${gwId}/live/`))
        ]);
        
        const fixtures = await fRes.json();
        const liveData = await lRes.json();
        let statsMap = {};
        liveData.elements.forEach(el => statsMap[el.id] = el.stats);

        status.innerText = `GAMEWEEK ${gwId} ${gwId === liveGW ? 'LIVE' : 'FINAL'}`;
        container.innerHTML = '';

        const started = fixtures.filter(f => f.started);
        if (started.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.3; font-size:0.8rem;">No matches started yet.</div>`;
            return;
        }

        started.forEach(fix => {
            const matchPlayers = Object.keys(statsMap)
                .map(id => ({ id: parseInt(id), ...players[id] }))
                .filter(p => p.team === fix.team_h || p.team === fix.team_a)
                .map(p => {
                    const s = statsMap[p.id];
                    // 2025/26 Rules: Defenders 10 CBIT, Mids/Fwds 12 CBIRT
                    const cbit = s.clearances + s.blocks + s.interceptions + s.tackles;
                    const total = (p.pos === 2) ? cbit : (cbit + s.recoveries);
                    const target = (p.pos === 2) ? 10 : 12;
                    return { ...p, val: total, goal: target, hasPts: total >= target, saves: s.saves };
                })
                .filter(p => p.val > 2 || p.saves > 0)
                .sort((a, b) => b.val - a.val);

            if (matchPlayers.length > 0) renderMatch(container, fix, matchPlayers);
        });
    } catch (e) { container.innerHTML = "Sync Error."; }
}

function renderMatch(container, fix, matchPlayers) {
    container.innerHTML += `
        <div class="match-block">
            <div class="match-header">
                <span>${teams[fix.team_h].short}</span>
                <span style="color:#00ff87;">${fix.team_h_score} - ${fix.team_a_score}</span>
                <span>${teams[fix.team_a].short}</span>
            </div>
            <div class="stats-grid">
                <div>
                    <div class="col-label">DEFENSIVE ACTIONS (+2)</div>
                    ${matchPlayers.filter(p => p.val > 0).slice(0,4).map(p => `
                        <div class="player-row">
                            <span style="opacity:0.8">${p.name}</span>
                            <span class="${p.hasPts ? 'success-text' : ''}">${p.val}${p.hasPts ? '✔' : ''}</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <div class="col-label">SAVES (+1)</div>
                    ${matchPlayers.filter(p => p.saves > 0).slice(0,2).map(p => `
                        <div class="player-row">
                            <span style="opacity:0.8">${p.name}</span>
                            <span class="save-text">${p.saves}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function toggleGW(mode) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'prev') {
        document.getElementById('btn-prev').classList.add('active');
        fetchStats(prevGW);
    } else {
        document.getElementById('btn-curr').classList.add('active');
        fetchStats(liveGW);
    }
}

document.addEventListener('DOMContentLoaded', initDefCon);