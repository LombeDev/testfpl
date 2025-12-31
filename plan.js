async function fetchFDR() {
    const container = document.getElementById('fdr-container');
    
    // This proxy wraps the FPL response in a way that bypasses browser security
    const proxy = "https://api.allorigins.win/get?url=";
    const baseUrl = "https://fantasy.premierleague.com/api/";

    try {
        // Fetching both datasets through the proxy
        const [staticRes, fixturesRes] = await Promise.all([
            fetch(`${proxy}${encodeURIComponent(baseUrl + 'bootstrap-static/')}`),
            fetch(`${proxy}${encodeURIComponent(baseUrl + 'fixtures/')}`)
        ]);

        const staticDataRaw = await staticRes.json();
        const fixturesRaw = await fixturesRes.json();

        // AllOrigins wraps data in a 'contents' string, so we must parse it
        const staticData = JSON.parse(staticDataRaw.contents);
        const fixtures = JSON.parse(fixturesRaw.contents);

        // 1. Get Current Gameweek
        const currentGW = staticData.events.find(e => e.is_next)?.id || 1;
        
        // 2. Map Teams (ID -> Name & Short Name)
        const teams = {};
        staticData.teams.forEach(t => {
            teams[t.id] = { name: t.name, short: t.short_name };
        });

        renderTable(teams, fixtures, currentGW, currentGW + 5);
    } catch (error) {
        container.innerHTML = `<p style="color:red">Failed to load FPL data. Check your connection.</p>`;
        console.error("Error:", error);
    }
}

function renderTable(teams, fixtures, startGW, endGW) {
    const container = document.getElementById('fdr-container');
    let html = `<table><thead><tr><th class="team-name">Team</th>`;
    
    for (let i = startGW; i <= endGW; i++) html += `<th>GW ${i}</th>`;
    html += `</tr></thead><tbody>`;

    // Sort teams alphabetically
    const teamIds = Object.keys(teams).sort((a, b) => teams[a].name.localeCompare(teams[b].name));

    teamIds.forEach(teamId => {
        html += `<tr><td class="team-name">${teams[teamId].name}</td>`;
        
        for (let gw = startGW; gw <= endGW; gw++) {
            const match = fixtures.find(f => f.event === gw && (f.team_h == teamId || f.team_a == teamId));
            
            if (match) {
                const isHome = match.team_h == teamId;
                const opponentId = isHome ? match.team_a : match.team_h;
                const diff = isHome ? match.team_h_difficulty : match.team_a_difficulty;
                const venue = isHome ? "H" : "A";
                
                // We use the 'diff' number to apply the CSS class for coloring
                html += `<td class="diff-${diff}">${teams[opponentId].short} (${venue})</td>`;
            } else {
                html += `<td class="diff-3">---</td>`; // Blank Gameweek
            }
        }
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

fetchFDR();
