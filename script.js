// Function to fetch FPL data based on a team ID
async function fetchFplData(teamId) {
    // FPL Endpoint for a specific manager's team details
    const apiUrl = `https://fantasy.premierleague.com/api/entry/${teamId}/`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            // Check if the response failed (e.g., 404 Not Found)
            if (response.status === 404) {
                 throw new Error("FPL Team ID not found.");
            }
            throw new Error(`Failed to fetch FPL data (Status: ${response.status}).`);
        }

        const data = await response.json();
        
        // You will need to process this data to extract the live rank, 
        // net points, and team name. The exact key names depend on 
        // what you need (e.g., current_event_rank, summary_overall_points).

        // For this example, we'll map the basic data fields.
        const processedData = {
            managerName: data.player_first_name + ' ' + data.player_last_name,
            teamName: data.name,
            
            // NOTE: These are overall stats, not 'live' in the true sense. 
            // To get *live* rank/points, a more complex call is required, 
            // often involving /event/{gw_id}/live/ data.
            netPoints: data.summary_overall_points,
            liveRank: data.summary_overall_rank.toLocaleString(),
            
            // Transfers data is harder to pull from this single endpoint
            // For now, let's set transfers to a placeholder.
            transfers: 'N/A' 
        };

        return processedData;

    } catch (error) {
        // Log the actual error for debugging
        console.error("FPL API Fetch Error:", error.message);
        
        // Re-throw a user-friendly error
        throw new Error("Could not retrieve FPL data. Check the ID and ensure you have an active internet connection.");
    }
}

// Function to update the DOM with fetched data (remains the same)
function updateLiveRankCard(data) {
    document.getElementById('team-manager-name').textContent = `${data.teamName} (${data.managerName})`;
    document.getElementById('net-points-value').textContent = data.netPoints.toLocaleString();
    document.getElementById('transfers-value').textContent = data.transfers;
    document.getElementById('live-rank-value').textContent = data.liveRank;
}

// Function to reset the card to its default state (remains the same)
function resetLiveRankCard() {
    document.getElementById('fpl-id-input').value = '';
    document.getElementById('team-manager-name').textContent = 'Team name (Player name)';
    document.getElementById('net-points-value').textContent = '-';
    document.getElementById('transfers-value').textContent = '-';
    document.getElementById('live-rank-value').textContent = '-';
    document.getElementById('go-btn').disabled = false;
}

// Main function to initialize event listeners (remains the same)
function initLiveRankFeature() {
    const goButton = document.getElementById('go-btn');
    const resetButton = document.getElementById('reset-btn');
    const inputField = document.getElementById('fpl-id-input');

    goButton.addEventListener('click', async () => {
        const teamId = inputField.value.trim();

        if (teamId === "" || isNaN(teamId) || parseInt(teamId) <= 0) {
            alert("Please enter a valid FPL Team ID (a positive number).");
            return;
        }

        goButton.disabled = true;
        goButton.textContent = 'Loading...';

        try {
            const data = await fetchFplData(teamId);
            updateLiveRankCard(data);
        } catch (error) {
            alert(error.message);
            resetLiveRankCard();
        } finally {
            goButton.disabled = false;
            goButton.textContent = 'Go';
        }
    });
    
    resetButton.addEventListener('click', resetLiveRankCard);
    
    document.addEventListener('DOMContentLoaded', resetLiveRankCard);
}

// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', initLiveRankFeature);
