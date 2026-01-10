/**
 * KOPALA FPL - DefCon Tracker with Match Grouping
 */

const PROXY = "https://api.allorigins.win/raw?url=";
let teamsMap = {}; // ID -> {name, short}
let playerInfoMap = {}; // ID -> {name, pos, teamId}

async function initDefcon() {
    const container = document.getElementById('defcon-list-container');
    
    try {
        // 1. Fetch Basic Data
        const staticRes = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        
        staticData.teams.forEach(t => teamsMap[t.id] = { name: t.name, short: t.short_name });
        staticData.elements.forEach(p => playerInfoMap[p.id] = { name: p.web_name, pos: p.element_type, teamId: p.team });

        // 2. Determine active Gameweek
        const currentEvent = staticData.events.find(e => e.is_current);
        const prevEvent = staticData.events.find(e => e.is_previous);
        const isLive = new Date() >= new Date(currentEvent.deadline_time);
        const activeGW = isLive ? currentEvent.id : prevEvent.id;

        document.getElementById('gw-status-text').innerText = isLive ? `GW ${activeGW} LIVE` : `GW ${activeGW} RESULTS`;

        // 3. Fetch Fixtures and Live Stats
        const [fixRes, liveRes] = await Promise.all([
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/fixtures/?event=${activeGW}`)),
            fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${activeGW}/live/`))
        ]);
        
        const fixtures = await fixRes.json();
        const liveData = await liveRes.json();

        // 4. Map Live Stats to Player IDs
        let statsLookup = {};
        liveData.elements.forEach(el => statsLookup[el.id] = el.stats);

        renderGroupedDefcon(fixtures, statsLookup);
    } catch (err) {
        console.error("DefCon Grouping Error:", err);
    }
}

function renderGroupedDefcon(fixtures, statsLookup) {
    const container = document.getElementById('defcon-list-container');
    container.innerHTML = '';

    fixtures.forEach(fix => {
        const homeTeam = teamsMap[fix.team_h];
        const awayTeam = teamsMap[fix.team_a];
        const score = fix.started ? `${fix.team_h_score} - ${fix.team_a_score}` : "vs";

        // Filter players in this match with defensive actions
        const matchPlayers = Object.keys(statsLookup)
            .map(id => ({ id, ...playerInfoMap[id] }))
            .filter(p => p.teamId === fix.team_h || p.teamId === fix.team_a)
            .map(p => {
                const s = statsLookup[p.id];
                const cbit = s.clearances + s.blocks + s.interceptions + s.tackles;
                const actions = (p.pos === 2) ? cbit : (cbit + s.recoveries);
                const threshold = (p.pos === 2) ? 10 : 12;
                return { ...p, actions, threshold, hasPoints: actions >= threshold, saves: s.saves };
            })
            .filter(p => p.actions > 4 || p.saves > 0)
            .sort((a, b) => b.actions - a.actions);

        if (matchPlayers.length > 0) {
            container.innerHTML += `
                <div class="match-block" style="margin-bottom: 25px; border: 1px solid var(--fpl-border); border-radius: 8px; overflow: hidden;">
                    <div style="background: rgba(255,255,255,0.03); padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--fpl-border);">
                        <span style="font-size: 0.7rem; font-weight: 800;">${homeTeam.name}</span>
                        <span style="font-size: 0.8rem; font-weight: 900; color: var(--fpl-primary);">${score}</span>
                        <span style="font-size: 0.7rem; font-weight: 800;">${awayTeam.name}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 10px; gap: 15px;">
                        <div id="def-${fix.id}">
                            <div style="font-size: 0.55rem; opacity: 0.5; margin-bottom: 8px; font-weight: 800;">DEFENSIVE CONTRIBUTIONS</div>
                            ${renderPlayerList(matchPlayers.filter(p => p.actions > 0), 'def')}
                        </div>
                        <div id="saves-${fix.id}">
                            <div style="font-size: 0.55rem; opacity: 0.5; margin-bottom: 8px; font-weight: 800;">SAVES</div>
                            ${renderPlayerList(matchPlayers.filter(p => p.saves > 0), 'save')}
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

function renderPlayerList(players, type) {
    if (players.length === 0) return '<div style="font-size: 0.6rem; opacity: 0.3;">None</div>';
    return players.map(p => `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.75rem;">
            <span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${p.hasPoints || (type==='save' && p.saves >= 3) ? '#00ff87' : '#444'}"></span>
            <span style="font-weight: 700;">${p.name}</span>
            <span style="opacity: 0.5; font-size: 0.65rem;">(${type === 'def' ? p.actions : p.saves})</span>
            ${p.hasPoints && type === 'def' ? '<span style="color:#00ff87; font-weight:900; font-size:0.6rem;">+2</span>' : ''}
            ${type === 'save' && p.saves >= 3 ? `<span style="color:#e9fc04; font-weight:900; font-size:0.6rem;">+${Math.floor(p.saves/3)}</span>` : ''}
        </div>
    `).join('');
}