const proxy = "https://corsproxy.io/?";
const LEAGUE_ID = "101712"; 
let nextDeadlineDate = null;
let countdownInterval = null;
let leagueData = [];
let defaultSortColumn = 'total-points';
let defaultSortDirection = 'desc';

// Initialization
async function initKopala() {
    try {
        const response = await fetch(proxy + "https://fantasy.premierleague.com/api/bootstrap-static/");
        const data = await response.json();
        
        // Process Deadline
        const nextEvent = data.events.find(e => e.is_next || e.is_current);
        if (nextEvent) {
            document.getElementById("current-gw").textContent = nextEvent.id;
            nextDeadlineDate = new Date(nextEvent.deadline_time);
            startCountdown();
        }

        // Load League Data
        await loadMiniLeagueAnalyzer();
        
        // Hide Loader
        document.getElementById("loading-overlay").classList.add('hidden');
    } catch (err) {
        console.error("Initialization failed", err);
    }
}

function startCountdown() {
    const countdownEl = document.getElementById("countdown-timer");
    const update = () => {
        const now = new Date().getTime();
        const distance = nextDeadlineDate.getTime() - now;
        if (distance < 0) {
            countdownEl.textContent = "DEADLINE PASSED";
            return;
        }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        countdownEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
    };
    update();
    setInterval(update, 1000);
}

async function loadMiniLeagueAnalyzer() {
    const tableBody = document.querySelector("#league-analyzer-table tbody");
    try {
        const res = await fetch(proxy + `https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`);
        const data = await res.json();
        leagueData = data.standings.results.map(s => ({
            rank: s.rank,
            rank_change: s.rank_change,
            player_name: s.player_name,
            entry_name: s.entry_name,
            total_points: s.total,
            gw_points: s.event_total,
            transfers: 0, // Placeholder for detail fetch if needed
            value: "---", 
            overall_rank: "---"
        }));
        renderTable();
    } catch (e) { console.error("League Load Error", e); }
}

function renderTable() {
    const body = document.querySelector("#league-analyzer-table tbody");
    body.innerHTML = leagueData.map((m, i) => `
        <tr class="${i === 0 ? 'top-rank' : ''}">
            <td><span class="rank-number">${m.rank}.</span></td>
            <td><strong>${m.player_name}</strong></td>
            <td>${m.entry_name}</td>
            <td>${m.gw_points}</td>
            <td><strong>${m.total_points}</strong></td>
            <td>${m.transfers}</td>
            <td>${m.value}</td>
            <td>${m.overall_rank}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', initKopala);
