// Mock Player Database (Normally from FPL API)
const players = [
    { id: 1, name: "Salah", pos: "MID", team: "LIV", price: 12.5, fdr: [3, 2, 5, 4] },
    { id: 2, name: "Haaland", pos: "FWD", team: "MCI", price: 15.2, fdr: [2, 3, 2, 2] },
    { id: 3, name: "Gabriel", pos: "DEF", team: "ARS", price: 6.2, fdr: [4, 3, 2, 3] },
    { id: 4, name: "Raya", pos: "GKP", team: "ARS", price: 5.5, fdr: [4, 3, 2, 3] },
    { id: 5, name: "Palmer", pos: "MID", team: "CHE", price: 10.8, fdr: [2, 5, 3, 2] }
];

// Current State
let myTeam = [...players]; // Simplified: putting all mock players in the team

function renderTeam() {
    // Clear rows
    ['GKP', 'DEF', 'MID', 'FWD', 'BENCH'].forEach(pos => {
        document.getElementById(`row-${pos}`).innerHTML = '';
    });

    myTeam.forEach(player => {
        const rowId = player.pos === 'BENCH' ? 'row-BENCH' : `row-${player.pos}`;
        const container = document.getElementById(rowId);
        
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="shirt"></div>
            <div class="info-box">
                <div class="name">${player.name}</div>
                <div class="fixture-strip">
                    ${player.fdr.map(lvl => `<div class="f-box fdr-${lvl}"></div>`).join('')}
                </div>
            </div>
        `;
        
        card.onclick = () => selectPlayer(player);
        container.appendChild(card);
    });
}

function selectPlayer(player) {
    // Highlight sidebar search for replacing this player
    document.getElementById('player-search').placeholder = `Replace ${player.name}...`;
    document.getElementById('player-search').focus();
}

// Initial Run
document.addEventListener('DOMContentLoaded', renderTeam);
