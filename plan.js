async function initFDRSection() {
    try {
        const [staticRes, fixRes] = await Promise.all([
            fetch('/fpl-api/bootstrap-static/'),
            fetch('/fpl-api/fixtures/')
        ]);
        
        const data = await staticRes.json();
        const allFixtures = await fixRes.json();
        const currentGW = data.events.find(ev => ev.is_current).id;
        const teams = data.teams;

        // Create Headers
        const header = document.getElementById('fdrHeader');
        for (let i = currentGW; i <= 38; i++) {
            const th = document.createElement('th');
            th.innerText = i;
            header.appendChild(th);
        }

        // Create Rows
        const body = document.getElementById('fdrBody');
        teams.forEach(team => {
            const tr = document.createElement('tr');
            
            // Team Name + Logo (Official FPL CDN)
            const logoUrl = `https://resources.premierleague.com/premierleague/badges/t${team.code}.png`;
            let rowHtml = `
                <td class="sticky-team">
                    <img src="${logoUrl}" class="team-logo">
                    <span>${team.name}</span>
                </td>`;

            for (let gw = currentGW; gw <= 38; gw++) {
                const match = allFixtures.find(f => f.event === gw && (f.team_a === team.id || f.team_h === team.id));
                
                if (match) {
                    const isHome = match.team_h === team.id;
                    const opp = teams.find(t => t.id === (isHome ? match.team_a : match.team_h)).short_name;
                    const diff = isHome ? match.team_h_difficulty : match.team_a_difficulty;
                    const venue = isHome ? 'H' : 'a'; // lowercase 'a' as seen in screenshot
                    rowHtml += `<td class="d-${diff}">${opp}<span class="v-label">(${venue})</span></td>`;
                } else {
                    rowHtml += `<td class="d-3">-</td>`; // Blank gameweeks
                }
            }
            tr.innerHTML = rowHtml;
            body.appendChild(tr);
        });

        // Search logic
        document.getElementById('fdrSearch').addEventListener('keyup', (e) => {
            const val = e.target.value.toLowerCase();
            Array.from(body.rows).forEach(row => {
                row.style.display = row.cells[0].innerText.toLowerCase().includes(val) ? "" : "none";
            });
        });

    } catch (err) {
        console.error("FDR Load Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', initFDRSection);