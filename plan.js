async function fetchFDR() {
    // Proxy added to bypass CORS issues during local development
    const proxy = "https://corsproxy.io/?";
    const baseUrl = "https://fantasy.premierleague.com/api/";

    try {
        const [teamsRes, fixturesRes] = await Promise.all([
            fetch(`${proxy}${baseUrl}bootstrap-static/`),
            fetch(`${proxy}${baseUrl}fixtures/`)
        ]);

        const staticData = await teamsRes.json();
        const fixtures = await fixturesRes.json();

        // Map Teams for quick lookup
        const teams = {};
        staticData.teams.forEach(t => {
            teams[t.id] = { name: t.name, short: t.short_name };
        });

        renderTable(teams, fixtures);
    } catch (error) {
        document.getElementById('fdr-container').innerHTML = "Error loading data.";
        console.error(error);
    }
}

function renderTable(teams, fixtures) {
    const container = document.getElementById('fdr-container');
    let html = `<table><tr><th class="team-name">Team</th>`;
    
    // Set how many Gameweeks to show (e.g., next 5)
    const startGW = 20; // You can calculate this dynamically from staticData.events
    const endGW = 25;

    for (let i = startGW; i <= endGW; i++) html += `<th>GW${i}</th>`;
    html += `</tr>`;

    Object.keys(teams).forEach(teamId => {
        html += `<tr><td class="team-name">${teams[teamId].name}</td>`;
        
        for (let gw = startGW; gw <= endGW; gw++) {
            // Find fixture for this team in this GW
            const fix = fixtures.find(f => f.event === gw && (f.team_h == teamId || f.team_a == teamId));
            
            if (fix) {
                const isHome = fix.team_h == teamId;
                const opponentId = isHome ? fix.team_a : fix.team_h;
                const diff = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;
                const venue = isHome ? "(H)" : "(A)";
                
                html += `<td class="diff-${diff}">${teams[opponentId].short} ${venue}</td>`;
            } else {
                html += `<td>-</td>`; // Blank Gameweek
            }
        }
        html += `</tr>`;
    });

    html += `</table>`;
    container.innerHTML = html;
}

fetchFDR();
