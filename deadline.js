const proxy = "https://corsproxy.io/?";
let teamMap = {};

async function init() {
    try {
        const response = await fetch(proxy + "https://fantasy.premierleague.com/api/bootstrap-static/");
        const data = await response.json();

        // 1. Build Team Map
        data.teams.forEach(t => teamMap[t.id] = t.short_name);

        // 2. Handle Countdown
        renderDeadline(data.events);

        // 3. Handle Price Changes
        renderPrices(data.elements);

        document.getElementById("loading-overlay").style.display = 'none';
    } catch (err) {
        document.getElementById("loading-overlay").textContent = "Error loading data.";
    }
}

function renderDeadline(events) {
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    const el = document.getElementById("countdown-timer");
    const card = document.getElementById("deadline-card");
    card.style.display = 'block';

    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const now = new Date().getTime();
        const diff = deadline - now;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        el.innerHTML = `
            <div class="timer-grid">
                <div>${d}<span class="timer-unit">DAYS</span></div>
                <div>${h}<span class="timer-unit">HRS</span></div>
                <div>${m}<span class="timer-unit">MIN</span></div>
                <div>${s}<span class="timer-unit">SEC</span></div>
            </div>
            <div style="margin-top:10px; font-size:12px; font-weight:600;">GW ${nextGW.id}</div>
        `;
    };

    update();
    setInterval(update, 1000);
}

function renderPrices(players) {
    const list = document.getElementById("price-changes-list");
    const card = document.getElementById("price-card");
    
    const risersFallers = players
        .filter(p => p.cost_change_event !== 0)
        .sort((a, b) => b.cost_change_event - a.cost_change_event);

    if (risersFallers.length === 0) return;
    card.style.display = 'block';

    list.innerHTML = risersFallers.map(p => {
        const change = p.cost_change_event / 10;
        const colorClass = change > 0 ? 'change-up' : 'change-down';
        const sign = change > 0 ? '+' : '';

        return `
            <div class="price-row">
                <div class="player-info">
                    <span class="player-name">${p.web_name}</span>
                    <span class="team-name">${teamMap[p.team]}</span>
                </div>
                <div class="price-data">
                    <span class="price-val">£${(p.now_cost / 10).toFixed(1)}m</span><br>
                    <span class="${colorClass}">${sign}${change.toFixed(1)}</span>
                </div>
            </div>
        `;
    }).join('');
}

init();
