async function renderUpcomingFixtures() {
    try {
        const [staticRes, fixRes] = await Promise.all([
            fetch('/fpl-api/bootstrap-static/'),
            fetch('/fpl-api/fixtures/')
        ]);
        
        const data = await staticRes.json();
        const allFixtures = await fixRes.json();
        
        // Find the next upcoming Gameweek ID
        const currentGW = data.events.find(ev => ev.is_next || (!ev.finished && ev.is_current)).id;
        const teams = data.teams;

        // Filter fixtures for only the next Gameweek
        const gwFixtures = allFixtures.filter(f => f.event === currentGW);

        // Group fixtures by date
        const fixturesByDate = {};
        gwFixtures.forEach(fix => {
            const date = new Date(fix.kickoff_time).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            if (!fixturesByDate[date]) fixturesByDate[date] = [];
            fixturesByDate[date].push(fix);
        });

        const container = document.getElementById('fdrBody'); // Using your existing ID
        container.innerHTML = ""; // Clear existing content

        // Render each date group
        for (const [date, matches] of Object.entries(fixturesByDate)) {
            // Create Date Header (Blue bar in your screenshot)
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-banner';
            dateHeader.innerText = date;
            container.appendChild(dateHeader);

            matches.forEach(match => {
                const homeTeam = teams.find(t => t.id === match.team_h);
                const awayTeam = teams.find(t => t.id === match.team_a);
                const time = new Date(match.kickoff_time).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const fixtureRow = document.createElement('div');
                fixtureRow.className = 'fixture-list-row';
                
                fixtureRow.innerHTML = `
                    <div class="team-side home">
                        <span>${homeTeam.name}</span>
                        <img src="https://resources.premierleague.com/premierleague/badges/t${homeTeam.code}.png">
                    </div>
                    <div class="match-time">${time}</div>
                    <div class="team-side away">
                        <img src="https://resources.premierleague.com/premierleague/badges/t${awayTeam.code}.png">
                        <span>${awayTeam.name}</span>
                    </div>
                `;
                container.appendChild(fixtureRow);
            });
        }

    } catch (err) {
        console.error("Fixture Load Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', renderUpcomingFixtures);
