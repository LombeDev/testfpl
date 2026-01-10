/**
 * KOPALA FPL - Live Defensive Contributions Tracker
 */

let playerNames = {}; 
let playerPositions = {}; // 2=DEF, 3=MID, 4=FWD

async function initDefcon() {
    const container = document.getElementById('defcon-list-container');
    const PROXY = "https://api.allorigins.win/raw?url=";

    try {
        // 1. Get Player Info (Names and Positions)
        const staticRes = await fetch(PROXY + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"));
        const staticData = await staticRes.json();
        staticData.elements.forEach(p => {
            playerNames[p.id] = p.web_name;
            playerPositions[p.id] = p.element_type;
        });
        const currentGW = staticData.events.find(e => e.is_current).id;

        // 2. Get Live Stats for the GW
        const liveRes = await fetch(PROXY + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`));
        const liveData = await liveRes.json();

        // 3. Filter for players with significant defensive actions
        const defconPlayers = liveData.elements
            .map(p => {
                const s = p.stats;
                const pos = playerPositions[p.id];
                const cbit = s.clearances + s.blocks + s.interceptions + s.tackles;
                const totalActions = (pos === 2) ? cbit : (cbit + s.recoveries);
                const threshold = (pos === 2) ? 10 : 12;

                return {
                    name: playerNames[p.id],
                    actions: totalActions,
                    target: threshold,
                    hasPoints: totalActions >= threshold,
                    saves: s.saves,
                    savePts: Math.floor(s.saves / 3)
                };
            })
            .filter(p => p.actions > 5 || p.saves > 0) // Only show active players
            .sort((a, b) => b.actions - a.actions);

        renderDefcon(defconPlayers);
    } catch (err) {
        console.error("DefCon Sync Error:", err);
    }
}

function renderDefcon(players) {
    const defList = document.getElementById('def-list');
    const savesList = document.getElementById('saves-list');
    
    // Clear current lists
    defList.innerHTML = '';
    savesList.innerHTML = '';

    players.forEach(p => {
        // Defensive Contributions Column
        if (p.actions > 0) {
            defList.innerHTML += `
                <div class="player-stat-row">
                    <span class="status-icon ${p.hasPoints ? 'success' : 'pending'}">
                        ${p.hasPoints ? '✔' : '⋯'}
                    </span>
                    <span class="p-name">${p.name}</span>
                    <span class="p-val">(${p.actions})</span>
                    ${p.hasPoints ? '<span class="bonus-tag">+2</span>' : ''}
                </div>`;
        }

        // Saves Column
        if (p.saves > 0) {
            savesList.innerHTML += `
                <div class="player-stat-row">
                    <span class="status-icon ${p.savePts > 0 ? 'save-success' : 'pending'}">
                        ${p.savePts > 0 ? '+' + p.savePts : '⋯'}
                    </span>
                    <span class="p-name">${p.name}</span>
                    <span class="p-val">(${p.saves})</span>
                </div>`;
        }
    });
}

document.addEventListener('DOMContentLoaded', initDefcon);