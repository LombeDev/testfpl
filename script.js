// --- New Local Proxy Endpoint ---
const PROXY_URL = '/api/fixtures/'; 

// --- Utility function (Simplified for local calls) ---
async function fetchData(url) {
    try {
        // No custom headers needed here, as we are calling our own server
        const response = await fetch(url); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('loading-error').textContent = 'Error fetching data from proxy. Check console for details or redeploy Netlify function.';
        return null;
    }
}

// --- Helper function to get the FDR color (No Change) ---
function getFDRColor(rating) {
    if (rating <= 1) return '#00ff85'; 
    if (rating === 2) return '#10a567';
    if (rating === 3) return '#ffc107'; 
    if (rating === 4) return '#ff8500';
    if (rating >= 5) return '#dc3545';
    return '#6c757d';
}

// --- Main function to get and display fixtures ---
async function getNextGameweekFixtures() {
    const fixturesListEl = document.getElementById('fixtures-list');
    const titleEl = document.getElementById('gameweek-title');
    fixturesListEl.innerHTML = ''; 

    // 1. Fetch data from your local proxy endpoint
    const processedData = await fetchData(PROXY_URL);
    if (!processedData || processedData.error) {
        titleEl.textContent = 'Could not load fixtures.';
        return;
    }

    const { gameweek_id: nextGwId, fixtures: nextGwFixtures } = processedData;

    titleEl.textContent = `Premier League Fixtures: Gameweek ${nextGwId}`;

    if (nextGwFixtures.length === 0) {
        fixturesListEl.innerHTML = '<p>No upcoming fixtures found for this Gameweek.</p>';
        return;
    }

    // 2. Render the pre-processed fixtures
    nextGwFixtures.forEach(fixture => {
        
        const fdrColor = getFDRColor(fixture.fdr);

        // Format the kickoff time
        const kickoffTime = new Date(fixture.kickoff_time);
        const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        
        const dateStr = kickoffTime.toLocaleDateString('en-GB', dateOptions);
        const timeStr = kickoffTime.toLocaleTimeString('en-GB', timeOptions);

        // Create the HTML element using the simplified structure
        const fixtureCard = document.createElement('div');
        fixtureCard.className = 'fixture-card';
        fixtureCard.innerHTML = `
            <span class="team-name home-team">${fixture.home_team_name}</span>
            
            <div class="match-info">
                <span class="vs-fdr">vs</span>
                <span class="location">${fixture.location}</span>
                <span class="date-time">${dateStr} | ${timeStr}</span>
            </div>
            
            <div class="fdr-container">
                <span class="fdr-badge" style="background-color: ${fdrColor};">${fixture.fdr}</span>
            </div>
            
            <span class="team-name away-team">${fixture.away_team_name}</span>
        `;
        
        fixturesListEl.appendChild(fixtureCard);
    });
}

// Execute the function when the page loads
getNextGameweekFixtures();
