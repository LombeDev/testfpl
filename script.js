// Function to fetch data from FPL API with necessary headers
async function fetchFPLData(url) {
    const options = {
        // Use an appropriate User-Agent to avoid being blocked
        headers: {
            'User-Agent': 'Node.js/18 (Web Scraping/Fixture Fetcher)'
        }
    };
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        throw new Error(`FPL API fetch failed for ${url} with status: ${response.status}`);
    }
    return response.json();
}

exports.handler = async (event, context) => {
    try {
        const BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
        const FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/';
        
        // 1. Fetch both datasets simultaneously
        const [bootstrapData, allFixtures] = await Promise.all([
            fetchFPLData(BOOTSTRAP_URL),
            fetchFPLData(FIXTURES_URL)
        ]);

        const { events: gameweeks, teams } = bootstrapData;

        // 2. Find the next Gameweek ID
        const nextGameweek = gameweeks.find(gw => gw.is_next);

        if (!nextGameweek) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Next Gameweek not found" })
            };
        }

        const nextGwId = nextGameweek.id;

        // 3. Create team map for easy lookup
        const teamNameMap = teams.reduce((map, team) => {
            map[team.id] = {
                name: team.name, 
                stadium: team.venue 
            };
            return map;
        }, {});
        
        // 4. Filter fixtures for the next gameweek
        const nextGwFixtures = allFixtures
            .filter(fixture => fixture.event === nextGwId && fixture.finished === false)
            // Attach team names/stadium and FDR to each fixture object before sending
            .map(fixture => ({
                ...fixture,
                home_team_name: teamNameMap[fixture.team_h].name,
                away_team_name: teamNameMap[fixture.team_a].name,
                location: teamNameMap[fixture.team_h].stadium,
                fdr: fixture.team_h_difficulty
            }))
            .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));

        // 5. Return the cleaned, combined data
        return {
            statusCode: 200,
            headers: {
                // Allow the browser to read the data from the serverless function
                'Access-Control-Allow-Origin': '*' 
            },
            body: JSON.stringify({ 
                gameweek_id: nextGwId,
                fixtures: nextGwFixtures 
            })
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to process FPL data." })
        };
    }
};
