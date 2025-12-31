async function fetchFDR() {
    const container = document.getElementById('fdr-container');
    
    // Using a different, more permissive proxy
    const proxy = "https://corsproxy.io/?";
    const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
    const fixUrl = "https://fantasy.premierleague.com/api/fixtures/";

    try {
        console.log("Fetching data...");
        
        const [staticRes, fixturesRes] = await Promise.all([
            fetch(proxy + encodeURIComponent(url)),
            fetch(proxy + encodeURIComponent(fixUrl))
        ]);

        if (!staticRes.ok || !fixturesRes.ok) throw new Error("API Limit Reached or Proxy Down");

        const staticData = await staticRes.json();
        const fixtures = await fixturesRes.json();

        // Check if data actually exists
        if (!staticData.teams || !fixtures.length) {
            throw new Error("Data received was empty.");
        }

        // 1. Identify the current/next Gameweek
        const nextEvent = staticData.events.find(e => e.is_next);
        const currentGW = nextEvent ? nextEvent.id : 1;
        const endGW = currentGW + 5;

        // 2. Map Teams
        const teams = {};
        staticData.teams.forEach(t => {
            teams[t.id] = { name: t.name, short: t.short_name };
        });

        // 3. Render
        renderTable(teams, fixtures, currentGW, endGW);
        console.log("Success!");

    } catch (error) {
        container.innerHTML = `
            <div style="background: #fee; color: #b00; padding: 20px; border-radius: 8px;">
                <strong>Error:</strong> ${error.message}<br>
                <small>Check the browser console (F12) for more details.</small>
            </div>`;
        console.error("Full Error:", error);
    }
}

function renderTable(teams, fixtures, startGW, endGW) {
    const container = document.getElementById('fdr-container');
    let html = `<table><thead><tr><th class="team-name">Team</th>`;
    
    for (let i = startGW; i <= endGW; i++) html += `<th>GW ${i}</th>`;
    html += `</tr></thead><tbody>`;

    const teamIds = Object.keys(teams);

    teamIds.forEach(teamId => {
        html += `<tr><td class="team-name"><strong>${teams[teamId].name}</strong></td>`;
        
        for (let gw = startGW; gw <= endGW; gw++) {
            const match = fixtures.find(f => f.event === gw && (f.team_h == teamId || f.team_a == teamId));
            
            if (match) {
                const isHome = match.team_h == teamId;
                const opponentId = isHome ? match.team_a : match.team_h;
                const diff = isHome ? match.team_h_difficulty : match.team_a_difficulty;
                const venue = isHome ? "H" : "A";
                
                html += `<td class="diff-${diff}">${teams[opponentId].short} (${venue})</td>`;
            } else {
                html += `<td class="diff-3">-</td>`;
            }
        }
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

fetchFDR();
