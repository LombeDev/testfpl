/* -----------------------------------------
    BONUS POINTS MODULE: bonus_points.js
    A completely separate script to fetch and display the Top Bonus Point scorers.
    It relies on the 'bps-list' container in the HTML.
----------------------------------------- */

// 🌐 CRITICAL: Proxy for CORS issues (using the stable one)
const proxy = "https://corsproxy.io/?"; 

// Global maps to hold static data fetched from the bootstrap-static API
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
let currentGameweekId = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Start the process
    loadBonusPointsData(); 
});

/**
 * Main function to coordinate data loading and display.
 */
async function loadBonusPointsData() {
    const container = document.getElementById("bps-list");
    if (!container) return; // Exit if the required container is missing

    // 1. Initial Fetch of Static Data (bootstrap-static)
    try {
        container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading FPL data...</p></div>`;
        
        const bootstrapResponse = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        );
        const data = await bootstrapResponse.json();

        // Populate global maps and find current Gameweek ID
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });
        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });
        
        const currentEvent = data.events.find(e => e.is_current);

        if (currentEvent) {
            currentGameweekId = currentEvent.id;
        } else {
            // Fallback: If no event is 'current', find the last finished one
            const finishedEvents = data.events.filter(e => e.finished);
            if (finishedEvents.length > 0) {
                finishedEvents.sort((a, b) => b.id - a.id);
                currentGameweekId = finishedEvents[0].id;
            }
        }
        
        // 2. Fetch and Display Bonus Points using the live endpoint
        if (currentGameweekId) {
            await fetchAndDisplayBonusPoints(data.elements, currentGameweekId, container);
        } else {
            container.innerHTML = `<h3>Bonus Points (Current GW) 🌟</h3><p>Could not determine the current Gameweek ID.</p>`;
        }

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        container.innerHTML = `<h3>Bonus Points (Current GW) 🌟</h3><p class="error-message">❌ Failed to load FPL data. Check API/Proxy connection.</p>`;
    }
}


/**
 * Fetches the live gameweek data and displays the top bonus points scorers.
 * @param {Array<Object>} allPlayers - The player list from bootstrap-static.
 * @param {number} gwId - The current Gameweek ID.
 * @param {HTMLElement} container - The DOM element to render the list in.
 */
async function fetchAndDisplayBonusPoints(allPlayers, gwId, container) {
    // Update container for the second fetch
    container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Fetching live GW ${gwId} bonus data...</p></div>`;

    try {
        const gwDataResponse = await fetch(
            proxy + `https://fantasy.premierleague.com/api/event/${gwId}/live/`
        );
        
        if (!gwDataResponse.ok) {
            throw new Error(`API returned status ${gwDataResponse.status}`);
        }
        
        const gwData = await gwDataResponse.json();
        const playerStats = gwData.elements;

        // Map and FILTER STRICTLY by actual bonus points awarded (> 0)
        const bonusPlayers = playerStats
            .map(stat => {
                // Find the actual bonus points awarded (0-3)
                const bonusAwarded = stat.stats.find(s => s.identifier === 'bonus')?.value || 0;
                
                if (bonusAwarded > 0) {
                    const fullPlayer = allPlayers.find(p => p.id === stat.id);
                    if (fullPlayer) {
                        const bpsValue = stat.stats.find(s => s.identifier === 'bps')?.value || 0;
                        
                        return {
                            ...fullPlayer,
                            gw_bps: bpsValue,
                            gw_bonus: bonusAwarded
                        };
                    }
                }
                return null;
            })
            .filter(p => p !== null); // Remove players who didn't get bonus points or are null

        // Sort: Primary sort by Bonus (3, 2, 1), Secondary sort by BPS score
        bonusPlayers.sort((a, b) => {
            if (b.gw_bonus !== a.gw_bonus) {
                return b.gw_bonus - a.gw_bonus; 
            }
            return b.gw_bps - a.gw_bps; 
        });

        // --- Render the list ---
        container.innerHTML = `<h3>Bonus Points (GW ${gwId}) 🌟</h3>`;

        if (bonusPlayers.length === 0) {
            container.innerHTML += `<p>No bonus points have been finalized yet for GW ${gwId}.</p>`;
            return;
        }

        const bonusList = document.createElement('div');
        bonusList.classList.add('bonus-points-list');

        bonusPlayers.forEach((p, index) => {
            const div = document.createElement("div");
            const teamAbbreviation = teamMap[p.team] || 'N/A';
            
            div.innerHTML = `
                <span class="bonus-icon">⭐</span>
                <span class="bonus-awarded-value">${p.gw_bonus}</span> 
                Pts - 
                <strong>${p.first_name} ${p.second_name}</strong> (${teamAbbreviation})
                <span class="bps-score">(${p.gw_bps} BPS)</span>
            `;
            
            if (p.gw_bonus === 3) div.classList.add("top-rank"); 

            bonusList.appendChild(div);
        });
        
        container.appendChild(bonusList);

    } catch (err) {
        console.error(`Error loading GW ${gwId} live data:`, err);
        container.innerHTML = `<h3>Bonus Points (GW ${gwId}) 🌟</h3><p class="error-message">❌ Failed to load live Gameweek data (API/Proxy error).</p>`;
    }
}
