let allFixtures = [];
let allTeams = [];
let currentViewedGW = 1;

async function initFixtures() {
    try {
        const [staticRes, fixRes] = await Promise.all([
            fetch('/fpl-api/bootstrap-static/'),
            fetch('/fpl-api/fixtures/')
        ]);
        
        const data = await staticRes.json();
        allFixtures = await fixRes.json();
        allTeams = data.teams;
        
        // Find the actual upcoming/current Gameweek from FPL
        const activeGW = data.events.find(ev => ev.is_next || (!ev.finished && ev.is_current));
        currentViewedGW = activeGW ? activeGW.id : 1;

        renderFixtures();
    } catch (err) {
        console.error("Load Error:", err);
    }
}

function renderFixtures() {
    const container = document.getElementById('fdrBody');
    const title = document.getElementById('gw-title');
    
    // Update Title text
    if (title) title.innerText = `Gameweek ${currentViewedGW}`;
    container.innerHTML = ""; 

    // Filter for chosen Gameweek
    const gwFixtures = allFixtures.filter(f => f.event === currentViewedGW);

    // Grouping logic
    const fixturesByDate = {};
    gwFixtures.forEach(fix => {
        const date = new Date(fix.kickoff_time).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        if (!fixturesByDate[date]) fixturesByDate[date] = [];
        fixturesByDate[date].push(fix);
    });

    for (const [date, matches] of Object.entries(fixturesByDate)) {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-banner';
        dateHeader.innerText = date;
        container.appendChild(dateHeader);

        matches.forEach(match => {
            const home = allTeams.find(t => t.id === match.team_h);
            const away = allTeams.find(t => t.id === match.team_a);
            
            // 1. LIVE INDICATOR LOGIC
            // Match is live if it started and isn't finished yet
            const isLive = match.started && !match.finished;
            const timeDisplay = isLive 
                ? `<span class="live-badge">LIVE</span>` 
                : new Date(match.kickoff_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            const fixtureRow = document.createElement('div');
            fixtureRow.className = 'fixture-list-row';
            fixtureRow.innerHTML = `
                <div class="team-side home">
                    <span>${home.name}</span>
                    <img src="https://resources.premierleague.com/premierleague/badges/t${home.code}.png">
                </div>
                <div class="match-time">${timeDisplay}</div>
                <div class="team-side away">
                    <img src="https://resources.premierleague.com/premierleague/badges/t${away.code}.png">
                    <span>${away.name}</span>
                </div>
            `;
            container.appendChild(fixtureRow);
        });
    }
}

// 2. NEXT BUTTON LOGIC
function loadNextGW() {
    if (currentViewedGW < 38) {
        currentViewedGW++;
        renderFixtures();
    }
}

document.addEventListener('DOMContentLoaded', initFixtures);
