/* -----------------------------------------
    BONUS POINTS MODULE: bonus_points.js
----------------------------------------- */

// 🌐 CRITICAL: Proxy for CORS issues
const proxy = "https://thingproxy.freeboard.io/fetch/";

// Global maps to hold static data fetched from the bootstrap-static API
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
let currentGameweekId = null;
let teamFDRMap = {}; // Team strength/FDR data

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    loadBonusPointsData(); 
});

/**
 * Main function to coordinate data loading and display.
 */
async function loadBonusPointsData() {
    const bonusContainer = document.getElementById("bps-list");
    const nextFixturesContainer = document.getElementById("next-fixtures-list"); 
    const standingsContainer = document.getElementById("fpl-standings-container"); // New container
    
    if (!bonusContainer) return; 

    // 1. Initial Fetch of Static Data (bootstrap-static)
    try {
        bonusContainer.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading FPL data...</p></div>`;
        
        const bootstrapResponse = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        );
        const data = await bootstrapResponse.json();

        let nextGameweekId = null;

        // Populate global maps, find current and next Gameweek ID
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
            teamFDRMap[team.id] = team.strength;
        });
        
        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });
        
        const currentEvent = data.events.find(e => e.is_current);
        const nextEvent = data.events.find(e => e.is_next);

        if (currentEvent) {
            currentGameweekId = currentEvent.id;
        } else {
            const finishedEvents = data.events.filter(e => e.finished);
            if (finishedEvents.length > 0) {
                finishedEvents.sort((a, b) => b.id - a.id);
                currentGameweekId = finishedEvents[0].id;
            }
        }

        if (nextEvent) {
            nextGameweekId = nextEvent.id;
        }

        // --- STEP 2: DISPLAY FPL STANDINGS ---
        if (standingsContainer) {
            displayFPLStandings(data.teams, standingsContainer);
        }

        // 3. Fetch and Display Bonus Points
        if (currentGameweekId) {
            await fetchAndDisplayBonusPoints(data.elements, currentGameweekId, bonusContainer);
        } else {
            bonusContainer.innerHTML = `<h3>Bonus Points (Current GW) 🌟</h3><p>Could not determine the current Gameweek ID.</p>`;
        }

        // 4. Fetch and Display Next Fixtures and FDR
        if (nextGameweekId && nextFixturesContainer) {
            await fetchAndDisplayNextFixturesAndFDR(nextGameweekId, nextFixturesContainer);
        } else if (nextFixturesContainer) {
             nextFixturesContainer.innerHTML = `<h3>Next GW Fixtures & FDR</h3><p>Could not determine the next Gameweek ID or end of season.</p>`;
        }


    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const errorMsg = `<p class="error-message">❌ Failed to load FPL data. Check API/Proxy connection.</p>`;
        bonusContainer.innerHTML = `<h3>Bonus Points (Current GW) 🌟</h3>${errorMsg}`;
        if (nextFixturesContainer) nextFixturesContainer.innerHTML = `<h3>Next GW Fixtures & FDR</h3>${errorMsg}`;
        if (standingsContainer) standingsContainer.innerHTML = `<h3>FPL Standings 📊</h3>${errorMsg}`;
    }
}

/**
 * Maps the FPL FDR number (1-5) to a descriptive CSS class for coloring.
 * @param {number} difficulty - The fixture difficulty rating (1-5).
 * @returns {string} The CSS class name.
 */
function getFDRColorClass(difficulty) {
    switch (difficulty) {
        case 1:
            return 'fdr-very-easy'; 
        case 2:
            return 'fdr-easy';      
        case 3:
            return 'fdr-medium';    
        case 4:
            return 'fdr-hard';      
        case 5:
            return 'fdr-very-hard'; 
        default:
            return 'fdr-default';
    }
}


/* -----------------------------------------
    NEW FUNCTION: DISPLAY FPL STANDINGS
----------------------------------------- */

/**
 * Extracts and displays FPL team standings (Rank and Points) from bootstrap data.
 * @param {Array<Object>} teams - The teams array from the FPL bootstrap API.
 * @param {HTMLElement} container - The DOM element to render the table in.
 */
function displayFPLStandings(teams, container) {
    // 1. Sort the teams by their current FPL rank
    const sortedTeams = [...teams].sort((a, b) => a.rank - b.rank);

    container.innerHTML = `<h3>FPL Standings (Current) 📊</h3>`;

    const table = document.createElement('table');
    table.classList.add('fpl-standings-table');
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>Rank</th>
                <th class="team-name-col">Team</th>
                <th>Played</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody>
            ${sortedTeams.map(team => `
                <tr ${team.rank <= 4 ? 'class="top-4"' : ''}>
                    <td class="pos-col">${team.rank}</td>
                    <td class="team-name-col">${team.name} (${team.short_name})</td>
                    <td>${team.played}</td>
                    <td class="pts-col"><strong>${team.points}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    `;

    container.appendChild(table);
}


/* -----------------------------------------
    FUNCTION: NEXT FIXTURES + FDR
----------------------------------------- */

async function fetchAndDisplayNextFixturesAndFDR(nextGameweekId, container) {
    container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Fetching GW ${nextGameweekId} fixtures and FDR...</p></div>`;

    try {
        const fixturesResponse = await fetch(
            proxy + "https://fantasy.premierleague.com/api/fixtures/"
        );
        
        if (!fixturesResponse.ok) {
             throw new Error(`Fixtures API returned status ${fixturesResponse.status}`);
        }
        
        const data = await fixturesResponse.json();

        const nextGWFixtures = data.filter(f => f.event === nextGameweekId);

        if (nextGWFixtures.length === 0) {
            container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR</h3><p>No fixtures found for Gameweek ${nextGameweekId}.</p>`;
            return;
        }

        container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR 🗓️</h3>`;

        const list = document.createElement('ul');
        list.classList.add('next-fixtures-list-items');
        
        nextGWFixtures.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));


        nextGWFixtures.forEach(fixture => {
            const homeTeamAbbr = teamMap[fixture.team_h] || `T${fixture.team_h}`;
            const awayTeamAbbr = teamMap[fixture.team_a] || `T${fixture.team_a}`;
            
            const homeFDR = fixture.team_h_difficulty;
            const awayFDR = fixture.team_a_difficulty;

            const homeFDRClass = getFDRColorClass(homeFDR);
            const awayFDRClass = getFDRColorClass(awayFDR);

            const kickoffDate = new Date(fixture.kickoff_time);
            const timeDisplay = kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateDisplay = kickoffDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

            const listItem = document.createElement('li');
            listItem.classList.add('upcoming-fixture');

            listItem.innerHTML = `
                <div class="fixture-summary">
                    <span class="fixture-team home-team">
                        <span class="team-label home-label">${homeTeamAbbr}</span> 
                        <span class="fdr-badge ${homeFDRClass}">${homeFDR}</span>
                    </span> 
                    <span class="vs-label">vs</span>
                    <span class="fixture-team away-team">
                        <span class="fdr-badge ${awayFDRClass}">${awayFDR}</span>
                        <span class="team-label away-label">${awayTeamAbbr}</span> 
                    </span>
                </div>
                <div class="fixture-datetime">
                    <span class="kickoff-date">${dateDisplay}</span>
                    <span class="kickoff-time">${timeDisplay}</span>
                </div>
            `;

            list.appendChild(listItem);
        });

        container.appendChild(list);

    } catch (err) {
        console.error("Error loading next fixtures/FDR:", err);
        container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR</h3><p class="error-message">❌ Failed to load fixture data. (Network/API Error)</p>`;
    }
}


/* -----------------------------------------
    FUNCTION: BONUS POINTS
----------------------------------------- */

async function fetchAndDisplayBonusPoints(allPlayers, gwId, container) {
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

        const bonusPlayers = playerStats
            .map(stat => {
                // FIX: Use optional chaining to safely find stats
                const bonusAwarded = stat.stats?.find(s => s.identifier === 'bonus')?.value || 0;
                
                if (bonusAwarded > 0) {
                    const fullPlayer = allPlayers.find(p => p.id === stat.id);
                    if (fullPlayer) {
                        const bpsValue = stat.stats?.find(s => s.identifier === 'bps')?.value || 0;
                        
                        return {
                            ...fullPlayer,
                            gw_bps: bpsValue,
                            gw_bonus: bonusAwarded
                        };
                    }
                }
                return null;
            })
            .filter(p => p !== null); 

        // Sort: Bonus (3, 2, 1) then BPS score
        bonusPlayers.sort((a, b) => {
            if (b.gw_bonus !== a.gw_bonus) {
                return b.gw_bonus - a.gw_bonus; 
            }
            return b.gw_bps - a.gw_bps; 
        });

        container.innerHTML = `<h3>Bonus Points (GW ${gwId}) 🌟</h3>`;

        if (bonusPlayers.length === 0) {
            container.innerHTML += `<p>No bonus points have been finalized yet for GW ${gwId}.</p>`;
            return;
        }

        const bonusList = document.createElement('div');
        bonusList.classList.add('bonus-points-list');

        bonusPlayers.forEach((p) => {
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
