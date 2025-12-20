const proxy = "https://corsproxy.io/?";
const LEAGUE_ID = "101712";
let leagueData = [];

async function initLeague() {
    const tableBody = document.querySelector("#league-analyzer-table tbody");
    const loader = document.getElementById("loading-overlay");

    try {
        const response = await fetch(proxy + `https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`);
        const data = await response.json();
        
        leagueData = data.standings.results;
        renderLeagueTable(leagueData);
        
        loader.classList.add("hidden");
    } catch (err) {
        console.error("Failed to fetch league data", err);
        tableBody.innerHTML = "<tr><td colspan='7'>Error loading league data.</td></tr>";
    }
}

function renderLeagueTable(data) {
    const tableBody = document.querySelector("#league-analyzer-table tbody");
    tableBody.innerHTML = "";

    data.forEach((manager, index) => {
        const row = document.createElement("tr");
        if (index === 0) row.classList.add("top-rank");

        row.innerHTML = `
            <td><span class="rank-num">${manager.rank}</span></td>
            <td><strong>${manager.player_name}</strong></td>
            <td>${manager.entry_name}</td>
            <td>${manager.event_total}</td>
            <td><strong>${manager.total}</strong></td>
            <td>-</td>
            <td>-</td>
        `;
        tableBody.appendChild(row);
    });
}

// Event Listeners
document.getElementById("update-analyzer-btn").addEventListener("click", () => {
    document.getElementById("loading-overlay").classList.remove("hidden");
    initLeague();
});

document.addEventListener("DOMContentLoaded", initLeague);
