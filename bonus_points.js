// ---------------------------
// Proxy & Helpers (robust)
// ---------------------------

// Primary proxy (your current)
let proxy = "https://thingproxy.freeboard.io/fetch/";

// Fallback proxy (no API key required)
const proxyFallback = "https://api.allorigins.win/raw?url=";

// Wrap fetch so it tries the primary proxy then fallback (if allowed)
async function proxiedFetch(url, useFallbackOnFail = true, options = {}) {
    try {
        // first attempt: primary proxy
        const r = await fetch(proxy + url, options);
        if (r.ok) return r;
        // non-ok: try fallback if allowed
        console.warn(`Primary proxy returned status ${r.status}, trying fallback...`);
    } catch (err) {
        console.warn("Primary proxy fetch failed:", err);
    }

    if (!useFallbackOnFail) throw new Error("Primary proxy failed and fallback disabled.");

    // attempt fallback (AllOrigins expects the full URL encoded)
    try {
        const fallbackUrl = proxyFallback + encodeURIComponent(url);
        const rf = await fetch(fallbackUrl, options);
        if (rf.ok) return rf;
        throw new Error(`Fallback returned status ${rf.status}`);
    } catch (err) {
        console.error("Both primary and fallback proxies failed:", err);
        throw err;
    }
}

// ---------------------------
// BONUS POINTS (fixed)
// ---------------------------
async function fetchAndDisplayBonusPoints(allPlayers, gwId, container) {
    container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Fetching live GW ${gwId} bonus data...</p></div>`;

    try {
        // Use proxiedFetch which tries primary proxy then fallback
        const gwUrl = `https://fantasy.premierleague.com/api/event/${gwId}/live/`;
        const gwDataResponse = await proxiedFetch(gwUrl);
        const gwData = await gwDataResponse.json();

        // gwData.elements is an array of live element objects
        // each element: { id: <player id>, stats: { bps: <num>, bonus: <num>, ... } , ... }
        const playerStats = gwData.elements || [];

        // For quick lookup, convert allPlayers to a map by id (if not already)
        const playersById = {};
        allPlayers.forEach(p => { playersById[p.id] = p; });

        const bonusPlayers = playerStats
            .map(stat => {
                const bpsValue = stat?.stats?.bps ?? 0;      // direct property
                const bonusAwarded = stat?.stats?.bonus ?? 0;

                if (bonusAwarded > 0) {
                    const fullPlayer = playersById[stat.id];
                    // sometimes the bootstrap player id may be missing; guard it
                    if (fullPlayer) {
                        return {
                            id: stat.id,
                            first_name: fullPlayer.first_name,
                            second_name: fullPlayer.second_name,
                            team: fullPlayer.team,
                            gw_bps: bpsValue,
                            gw_bonus: bonusAwarded
                        };
                    } else {
                        // still include minimal info if mapping not found
                        return {
                            id: stat.id,
                            first_name: stat.first_name || "Unknown",
                            second_name: stat.second_name || "",
                            team: stat.team || null,
                            gw_bps: bpsValue,
                            gw_bonus: bonusAwarded
                        };
                    }
                }
                return null;
            })
            .filter(Boolean);

        // Sort: highest bonus (3,2,1) first, then by bps
        bonusPlayers.sort((a, b) => {
            if (b.gw_bonus !== a.gw_bonus) return b.gw_bonus - a.gw_bonus;
            return b.gw_bps - a.gw_bps;
        });

        container.innerHTML = `<h3>Bonus Points (GW ${gwId}) 🌟</h3>`;

        if (bonusPlayers.length === 0) {
            container.innerHTML += `<p>No bonus points have been finalized yet for GW ${gwId}.</p>`;
            return;
        }

        const bonusList = document.createElement('div');
        bonusList.classList.add('bonus-points-list');

        bonusPlayers.forEach(p => {
            const div = document.createElement('div');
            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.innerHTML = `
                <span class="bonus-icon">⭐</span>
                <span class="bonus-awarded-value">${p.gw_bonus}</span> 
                Pts - 
                <strong>${p.first_name} ${p.second_name}</strong> (${teamAbbreviation})
                <span class="bps-score">(${p.gw_bps} BPS)</span>
            `;
            if (p.gw_bonus === 3) div.classList.add('top-rank');

            bonusList.appendChild(div);
        });

        container.appendChild(bonusList);

    } catch (err) {
        console.error(`Error loading GW ${gwId} live data:`, err);
        container.innerHTML = `<h3>Bonus Points (GW ${gwId}) 🌟</h3>
            <p class="error-message">❌ Failed to load live Gameweek data (API/Proxy error). See console for details.</p>`;
    }
}

// ---------------------------
// NEXT FIXTURES + FDR (improved)
// ---------------------------
async function fetchAndDisplayNextFixturesAndFDR(nextGameweekId, container) {
    container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Fetching GW ${nextGameweekId} fixtures and FDR...</p></div>`;

    try {
        const fixturesUrl = "https://fantasy.premierleague.com/api/fixtures/";
        const fixturesResponse = await proxiedFetch(fixturesUrl);

        if (!fixturesResponse.ok) {
            throw new Error(`Fixtures API returned status ${fixturesResponse.status}`);
        }

        const data = await fixturesResponse.json();
        // data should be an array of fixtures
        if (!Array.isArray(data)) {
            throw new Error("Fixtures API returned unexpected format.");
        }

        // Filter: fixtures where event === nextGameweekId
        // Some fixtures may have event===null (unassigned) — skip them
        const nextGWFixtures = data.filter(f => f.event === nextGameweekId);

        if (nextGWFixtures.length === 0) {
            container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR</h3><p>No fixtures found for Gameweek ${nextGameweekId}. They may not be assigned yet.</p>`;
            return;
        }

        container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR 🗓️</h3>`;

        const list = document.createElement('ul');
        list.classList.add('next-fixtures-list-items');

        // safe sort: some kickoff_time may be null — coerce to timestamp or Infinity
        nextGWFixtures.sort((a, b) => {
            const ta = a.kickoff_time ? new Date(a.kickoff_time).getTime() : Infinity;
            const tb = b.kickoff_time ? new Date(b.kickoff_time).getTime() : Infinity;
            return ta - tb;
        });

        nextGWFixtures.forEach(fixture => {
            const homeTeamAbbr = teamMap[fixture.team_h] || `T${fixture.team_h}`;
            const awayTeamAbbr = teamMap[fixture.team_a] || `T${fixture.team_a}`;

            const homeFDR = fixture.team_h_difficulty ?? fixture.difficulty ?? 'N/A';
            const awayFDR = fixture.team_a_difficulty ?? fixture.difficulty ?? 'N/A';

            const homeFDRClass = Number.isInteger(homeFDR) ? getFDRColorClass(homeFDR) : 'fdr-default';
            const awayFDRClass = Number.isInteger(awayFDR) ? getFDRColorClass(awayFDR) : 'fdr-default';

            const kickoffDate = fixture.kickoff_time ? new Date(fixture.kickoff_time) : null;
            const timeDisplay = kickoffDate ? kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
            const dateDisplay = kickoffDate ? kickoffDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBD';

            const li = document.createElement('li');
            li.classList.add('upcoming-fixture');

            li.innerHTML = `
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

            list.appendChild(li);
        });

        container.appendChild(list);

    } catch (err) {
        console.error("Error loading next fixtures/FDR:", err);
        container.innerHTML = `<h3>GW ${nextGameweekId} Fixtures & FDR</h3><p class="error-message">❌ Failed to load fixture data. (Network/API Error)</p>`;
    }
}
