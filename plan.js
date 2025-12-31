const FPL_DATA = "https://corsproxy.io/?https://fantasy.premierleague.com/api/bootstrap-static/";
let squad = Array(15).fill(null);
let selectedSlot = null;

async function loadData() {
    const res = await fetch(FPL_DATA);
    const data = await res.json();
    setupMarket(data.elements);
    renderPitch();
}

function renderPitch() {
    // Clear rows
    [1, 2, 3, 4].forEach(r => document.getElementById(`row-${r}`).innerHTML = '');
    document.getElementById('row-bench').innerHTML = '';

    squad.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = "player-card";
        if(player) {
            card.innerHTML = `
                <div class="shirt-container">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-66.webp" width="50">
                </div>
                <div class="player-label">${player.web_name}</div>
                <div class="fix-label">CHE (H)</div>
            `;
        } else {
            card.innerHTML = `<div class="shirt-container" style="opacity:0.4"></div><div class="player-label">Empty</div>`;
        }
        
        card.onclick = () => {
            selectedSlot = index;
            document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        };

        // Auto-sorting into positions (Basic 15-man layout)
        if (index < 11 && player) {
            document.getElementById(`row-${player.element_type}`).appendChild(card);
        } else {
            document.getElementById('row-bench').appendChild(card);
        }
    });
}

function setupMarket(players) {
    const list = document.getElementById('market-results');
    players.slice(0, 20).forEach(p => {
        const item = document.createElement('div');
        item.style.padding = "10px";
        item.style.borderBottom = "1px solid #fff";
        item.innerHTML = `${p.web_name} - £${p.now_cost/10}`;
        item.onclick = () => {
            if(selectedSlot !== null) {
                squad[selectedSlot] = p;
                renderPitch();
            }
        };
        list.appendChild(item);
    });
}

loadData();
