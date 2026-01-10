/**
 * KOPALA FPL - DefCon & Match Grouping Final
 * Shows previous GW until the next one kicks off.
 */

const PROXY = "https://api.allorigins.win/raw?url=";
let teams = {}; 
let players = {}; 

async function initDefcon() {
    const container = document.getElementById('defcon-list-container');
    const statusHeader = document.getElementById('gw-status-text');

    try {
        // 1. Fetch Static Data
        const staticRes = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const sData = await staticRes.json();
        
        sData.teams.forEach(t => teams[t.id] = { name: t.name, short: t.short_name });
        sData.elements.forEach(p => players[p.id] = { name: p.web_name, pos: p.element_type, team: p.team });

        // 2. Logic: Show Previous GW if current hasn't started
        const current = sData.events.find(e => e.is_current) || sData.events.find(e => e.is_next);
        const prev = sData.events.find(e => e.is_previous);
        const isLive = new Date() >= new Date(current.deadline_time);
        const activeGW = isLive ? current.id : prev.id;

        statusHeader.innerText = isLive ? `GW ${activeGW} LIVE` : `GW ${activeGW} FINAL`;

        // 3. Fetch Fixtures & Live Stats
        const [fRes, lRes] = await Promise.all([
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/fixtures/?event=${activeGW}`)),
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${activeGW}/live/`))
        ]);
        
        const fixtures = await fRes.json();
        const liveData = await lRes.json();
        
        // Map stats to IDs for fast lookup
        let liveStats = {};
        liveData.elements.forEach(el => liveStats[el.id] = el.stats);

        // 4. Group by Match
        container.innerHTML = '';
        const activeFix = fixtures.filter(f => f.started);

        if (activeFix.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;">No live matches. Showing GW ${activeGW} summary soon.</div>`;
            return;
        }

        activeFix.forEach(fix => {
            const matchPlayers = Object.keys(liveStats)
                .map(id => ({ id: parseInt(id), ...players[id] }))
                .filter(p => p.team === fix.team_h || p.team === fix.team_a)
                .map(p => {
                    const s = liveStats[p.id];
                    const cbit = s.clearances + s.blocks + s.interceptions + s.tackles;
                    const total = (p.pos === 2) ? cbit : (cbit + s.recoveries);
                    const target = (p.pos === 2) ? 10 : 12;
                    return { ...p, val: total, goal: target, hasPts: total >= target, saves: s.saves };
                })
                .filter(p => p.val > 3 || p.saves > 0) // Minimum threshold to show
                .sort((a, b) => b.val - a.val);

            if (matchPlayers.length > 0) {
                renderMatchCard(container, fix, matchPlayers);
            }
        });
    } catch (e) {
        container.innerHTML = `<div style="color:red; font-size:10px;">Sync Error. Check Proxy.</div>`;
    }
}

function renderMatchCard(container, fix, matchPlayers) {
    const h = teams[fix.team_h].short;
    const a = teams[fix.team_a].short;
    
    container.innerHTML += `
        <div class="match-group" style="margin-bottom:15px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; background:rgba(255,255,255,0.02);">
            <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.05); font-weight:800; font-size:0.7rem;">
                <span>${h}</span>
                <span style="color:#00ff87;">${fix.team_h_score} - ${fix.team_a_score}</span>
                <span>${a}</span>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; padding:10px; gap:10px;">
                <div>
                    <div style="font-size:0.5rem; opacity:0.4; margin-bottom:5px;">DEFENSIVE ACTIONS</div>
                    ${matchPlayers.filter(p => p.val > 0).slice(0,4).map(p => `
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:3px;">
                            <span style="color:${p.hasPts ? '#00ff87' : '#fff'}">${p.name}</span>
                            <span style="opacity:0.5;">${p.val} ${p.hasPts ? '✔' : ''}</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <div style="font-size:0.5rem; opacity:0.4; margin-bottom:5px;">SAVES</div>
                    ${matchPlayers.filter(p => p.saves > 0).slice(0,2).map(p => `
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                            <span>${p.name}</span>
                            <span style="color:#e9fc04;">${p.saves}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', initDefcon);