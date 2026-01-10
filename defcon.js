/**
 * KOPALA FPL - Intelligent DefCon Tracker
 * Shows previous GW data until the new one is live.
 */

let pNames = {};
let pPos = {}; 

async function initDefcon() {
    const container = document.getElementById('defcon-list-container');
    const PROXY = "https://api.allorigins.win/raw?url=";

    try {
        // 1. Get General FPL Data
        const staticRes = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        
        staticData.elements.forEach(p => {
            pNames[p.id] = p.web_name;
            pPos[p.id] = p.element_type;
        });

        // 2. Logic: Should we show Current or Previous?
        const currentEvent = staticData.events.find(e => e.is_current);
        const prevEvent = staticData.events.find(e => e.is_previous);
        
        // If current GW hasn't started (deadline is in future), use Previous
        const now = new Date();
        const deadline = new Date(currentEvent.deadline_time);
        const activeGW = (now < deadline) ? prevEvent.id : currentEvent.id;
        const isLive = (now >= deadline);

        // Update UI Header
        document.getElementById('gw-status-text').innerText = isLive ? `GW ${activeGW} LIVE` : `GW ${activeGW} RESULTS`;

        // 3. Fetch Data for the decided Gameweek
        const liveRes = await fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${activeGW}/live/`));
        const liveData = await liveRes.json();

        // 4. Process and Filter
        const processed = liveData.elements
            .map(p => {
                const s = p.stats;
                const pos = pPos[p.id];
                // CBIT: Clearances, Blocks, Interceptions, Tackles
                const cbit = s.clearances + s.blocks + s.interceptions + s.tackles;
                // CBIRT: Mids/Fwds get Ball Recoveries too
                const totalActions = (pos === 2) ? cbit : (cbit + s.recoveries);
                const target = (pos === 2) ? 10 : 12;

                return {
                    name: pNames[p.id],
                    actions: totalActions,
                    target: target,
                    hasPoints: totalActions >= target,
                    saves: s.saves,
                    savePts: Math.floor(s.saves / 3)
                };
            })
            .filter(p => p.actions > 0 || p.saves > 0)
            .sort((a, b) => b.actions - a.actions);

        renderDefcon(processed);
    } catch (err) {
        console.error("DefCon Load Error:", err);
    }
}

function renderDefcon(players) {
    const defList = document.getElementById('def-list');
    const savesList = document.getElementById('saves-list');
    
    defList.innerHTML = '';
    savesList.innerHTML = '';

    // Filter to show only notable performers (e.g., top 15) to keep it clean
    players.slice(0, 30).forEach(p => {
        if (p.actions >= 5) {
            defList.innerHTML += `
                <div class="player-stat-row">
                    <span class="status-icon ${p.hasPoints ? 'success' : 'pending'}">
                        ${p.hasPoints ? '✔' : p.actions}
                    </span>
                    <span class="p-name">${p.name}</span>
                    <span class="p-val"></span>
                    ${p.hasPoints ? '<span class="bonus-tag">+2</span>' : ''}
                </div>`;
        }

        if (p.saves > 0) {
            savesList.innerHTML += `
                <div class="player-stat-row">
                    <span class="status-icon ${p.savePts > 0 ? 'save-success' : 'pending'}">
                        ${p.savePts > 0 ? '+' + p.savePts : p.saves}
                    </span>
                    <span class="p-name">${p.name}</span>
                </div>`;
        }
    });
}

document.addEventListener('DOMContentLoaded', initDefcon);