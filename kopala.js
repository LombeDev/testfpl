const proxy = "https://corsproxy.io/?";
const LEAGUE_ID = "101712";

async function fetchKopalaLeague() {
    const tableBody = document.getElementById("league-body");
    const loader = document.getElementById("loading-overlay");
    
    loader.classList.remove("hidden");

    try {
        const response = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`));
        const data = await response.json();
        
        renderLeague(data.standings.results);
        
        setTimeout(() => loader.classList.add("hidden"), 500);
    } catch (err) {
        console.error("League Error:", err);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px;">⚠️ Failed to sync with FPL. Please refresh.</td></tr>`;
        loader.classList.add("hidden");
    }
}

function renderLeague(standings) {
    const tableBody = document.getElementById("league-body");
    tableBody.innerHTML = standings.map((m, index) => `
        <tr class="${index === 0 ? 'top-rank-row' : ''}">
            <td><span class="rank-badge">${m.rank}</span></td>
            <td><strong>${m.player_name}</strong></td>
            <td>${m.entry_name}</td>
            <td>${m.event_total}</td>
            <td style="color: var(--fpl-purple); font-weight: 800;">${m.total}</td>
        </tr>
    `).join('');
}

// Refresh logic
document.getElementById("refresh-league").addEventListener("click", fetchKopalaLeague);

// Initialize on load
document.addEventListener("DOMContentLoaded", fetchKopalaLeague);
