const PROXY = "https://corsproxy.io/?url=";
const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";

async function initPredictor() {
    const loader = document.getElementById('loader');
    try {
        const response = await fetch(PROXY + encodeURIComponent(API_URL));
        const data = await response.json();
        
        // FPL API Data Processing
        const players = data.elements
            .filter(p => p.transfers_in_event > 3000 || p.transfers_out_event > 3000)
            .map(p => {
                const netTransfers = p.transfers_in_event - p.transfers_out_event;
                // Simplified Prediction Logic (Threshold ~50k net transfers)
                const progress = (netTransfers / 45000) * 100; 
                
                return {
                    name: p.web_name,
                    team: data.teams.find(t => t.id === p.team).name,
                    price: (p.now_cost / 10).toFixed(1),
                    progress: progress.toFixed(2),
                    prediction: (progress * 1.05).toFixed(2), // Estimated trend to tonight
                    rate: (Math.random() * 5).toFixed(2), // Mock hourly rate
                    pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type]
                };
            })
            .sort((a, b) => Math.abs(b.progress) - Math.abs(a.progress));

        renderTable(players);
        loader.style.display = 'none';
    } catch (e) {
        loader.textContent = "⚠️ API Limit reached. Try again later.";
    }
}

function renderTable(players) {
    const body = document.getElementById('predictor-body');
    body.innerHTML = players.map(p => {
        const isRising = p.prediction >= 100;
        const isFalling = p.prediction <= -100;
        const cellClass = isRising ? 'rise-cell' : (isFalling ? 'fall-cell' : '');
        const trendClass = p.progress >= 0 ? 'trend-up' : 'trend-down';
        const arrows = p.progress >= 0 ? '^^^' : 'vvv';

        return `
            <tr>
                <td><strong>${p.name}</strong><br><small>${p.pos} £${p.price}</small></td>
                <td>${p.team}</td>
                <td>${p.progress}%</td>
                <td class="${cellClass}">
                    ${p.prediction}%
                    ${(isRising || isFalling) ? '<span class="tonight-tag">⚠️ Tonight</span>' : ''}
                </td>
                <td>
                    <span class="${trendClass}">${p.progress >= 0 ? '+' : ''}${p.rate}%</span><br>
                    <span class="${trendClass}">${arrows}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Countdown Logic
function updateTimer() {
    const now = new Date();
    const target = new Date();
    target.setUTCHours(2, 30, 0, 0); // FPL Daily Update Time
    if (now > target) target.setDate(target.getDate() + 1);

    const diff = target - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    document.getElementById('timer').textContent = 
        `${h.toString().padStart(2, '0')} hr ${m.toString().padStart(2, '0')} min ${s.toString().padStart(2, '0')} sec`;
}

setInterval(updateTimer, 1000);
initPredictor();
