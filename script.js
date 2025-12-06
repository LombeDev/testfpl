// --- Configuration and API Endpoints ---
const BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/';
const LOGO_BASE_PATH = './logos/'; // IMPORTANT: Ensure your logo files are in a folder named 'logos'
const LOGO_EXTENSION = '.png';    // IMPORTANT: Ensure your logo files use the correct extension (.png, .svg, etc.)

// --- Utility function to fetch JSON data ---
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('loading-error').textContent = 'Error fetching data. Check console for details or try again later.';
        return null;
    }
}

// --- Helper function to get the FDR color based on the rating (1=Easiest, 5=Hardest) ---
function getFDRColor(rating) {
    if (rating <= 1) return '#00ff85'; // Easy (Green)
    if (rating === 2) return '#10a567';
    if (rating === 3) return '#ffc107'; // Medium (Yellow/Orange)
    if (rating === 4) return '#ff8500';
    if (rating >= 5) return '#dc3545'; // Hard (Red)
    return '#6c757d'; // Default (Grey)
}

// --- Main function to get and display fixtures ---
async function getNextGameweekFixtures() {
    const fixturesListEl = document.getElementById('fixtures-list');
    const titleEl = document.getElementById('gameweek-title');
    fixturesListEl.innerHTML = ''; // Clear previous content

    // 1. Fetch bootstrap data
    const bootstrapData = await fetchData(BOOTSTRAP_URL);
    if (!bootstrapData) return;

    const { events: gameweeks, teams } = bootstrapData;

    // 2. Find the ID of the next gameweek
    const nextGameweek = gameweeks.find(gw => gw.is_next);

    if (!nextGameweek) {
        titleEl.textContent = 'Could not determine the next Gameweek.';
        return;
    }

    const nextGwId = nextGameweek.id;
    titleEl.textContent = `Premier League Fixtures: Gameweek ${nextGwId}`;

    // 3. Create an ENRICHED map for team IDs to team data
    const teamNameMap = teams.reduce((map, team) => {
        map[team.id] = {
            id: team.id,      // FPL Team ID (for logo URL)
            name: team.name, 
            stadium: team.venue // Stadium name (location)
        };
        return map;
    }, {});
    
    // 4. Fetch ALL fixtures
    const allFixtures = await fetchData(FIXTURES_URL);
    if (!allFixtures) return;

    // 5. Filter and sort fixtures for the next gameweek
    const nextGwFixtures = allFixtures
        .filter(fixture => fixture.event === nextGwId && fixture.finished === false) // Ensure it's the next GW and not finished
        .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));

    if (nextGwFixtures.length === 0) {
        fixturesListEl.innerHTML = '<p>No upcoming fixtures found for this Gameweek.</p>';
        return;
    }

    // 6. Render the fixtures
    nextGwFixtures.forEach(fixture => {
        const homeTeamData = teamNameMap[fixture.team_h];
        const awayTeamData = teamNameMap[fixture.team_a];
        
        const location = homeTeamData.stadium;
        
        // FDR for the home team (team_h) is generally the primary difficulty rating
        const fdr = fixture.team_h_difficulty; 
        const fdrColor = getFDRColor(fdr);

        // Construct logo paths
        const homeLogoPath = `${LOGO_BASE_PATH}${homeTeamData.id}${LOGO_EXTENSION}`;
        const awayLogoPath = `${LOGO_BASE_PATH}${awayTeamData.id}${LOGO_EXTENSION}`;

        // Format the kickoff time
        const kickoffTime = new Date(fixture.kickoff_time);
        const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        
        const dateStr = kickoffTime.toLocaleDateString('en-GB', dateOptions);
        const timeStr = kickoffTime.toLocaleTimeString('en-GB', timeOptions);

        // Create the HTML element
        const fixtureCard = document.createElement('div');
        fixtureCard.className = 'fixture-card';
        fixtureCard.innerHTML = `
            <div class="team-unit home-team">
                <img src="${homeLogoPath}" onerror="this.onerror=null; this.src='';" alt="${homeTeamData.name} Logo" class="team-logo">
                <span class="team-name">${homeTeamData.name}</span>
            </div>
            
            <div class="match-info">
                <span class="vs-fdr">vs</span>
                <span class="location">${location}</span>
                <span class="date-time">${dateStr} | ${timeStr}</span>
            </div>
            
            <div class="fdr-container">
                <span class="fdr-badge" style="background-color: ${fdrColor};">${fdr}</span>
            </div>
            
            <div class="team-unit away-team">
                <span class="team-name">${awayTeamData.name}</span>
                <img src="${awayLogoPath}" onerror="this.onerror=null; this.src='';" alt="${awayTeamData.name} Logo" class="team-logo">
            </div>
        `;
        
        fixturesListEl.appendChild(fixtureCard);
    });
}

// Execute the function when the page loads
getNextGameweekFixtures();
