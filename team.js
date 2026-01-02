/**
 * KOPALA FPL - AI MASTER ENGINE (v3.4)
 * UPGRADE: Advanced Form & Value Logic
 */

// ... [Existing variables: API_BASE, playerDB, etc. remain the same] ...

// --- UPGRADED AI CALCULATIONS ---

/**
 * Enhanced XP Calculation
 * Incorporates: Base XP + Fixture Difficulty + Home/Away Bias
 */
function getThreeWeekXP(player) {
    if (!player) return 0;
    
    const fixtures = getNextFixtures(player.teamId);
    // Base form: We use the player's current XP as a baseline
    let totalXP = player.xp; 
    
    fixtures.slice(0, 3).forEach((f, index) => {
        // 1. Fixture Difficulty Multiplier (1-5 scale)
        // A diff of 2 (easy) gives ~1.33x boost, diff of 5 (hard) gives ~0.33x
        let multiplier = (5 - f.diff + 2) / 4; 

        // 2. Home/Away Bias (Small 10% boost for home games)
        if (f.isHome) multiplier *= 1.1;

        // 3. Decay Factor: Gameweek +1 and +2 are slightly less predictable
        const decay = index === 0 ? 1.0 : (index === 1 ? 0.9 : 0.8);

        totalXP += (player.xp * multiplier * decay);
    });
    
    return parseFloat(totalXP.toFixed(1));
}

/**
 * Enhanced Analysis
 * Features: VAPM (Value Added Per Million) to find the best "Bang for buck"
 */
function analyzeTeam() {
    if (squad.some(s => s.name === "")) return alert("Finish your squad first!");
    
    const analysis = squad.map(slot => {
        const p = playerDB.find(pdb => pdb.name === slot.name);
        const threeWk = getThreeWeekXP(p);
        const price = parseFloat(p.price);
        
        return { 
            ...slot, 
            xp: p.xp, 
            price: price, 
            threeWk: threeWk,
            // VAPM Calculation: High XP relative to price
            vapm: (threeWk / price).toFixed(2) 
        };
    });

    // 1. Captain: Best 3-week XP
    const cap = [...analysis].sort((a, b) => b.threeWk - a.threeWk)[0];
    
    // 2. Weakest Links: Sort by VAPM (Efficiency) rather than just raw score
    const sortedByEfficiency = [...analysis].sort((a, b) => a.vapm - b.vapm);
    
    const budget = (100 - analysis.reduce((acc, p) => acc + p.price, 0));
    const tips = [];
    
    // 3. AI Smart Transfers: Suggesting high VAPM alternatives
    sortedByEfficiency.slice(0, 3).forEach(weak => {
        const up = playerDB.find(p => 
            p.pos === weak.pos && 
            parseFloat(p.price) <= (weak.price + budget) && 
            !squad.some(s => s.name === p.name) &&
            (getThreeWeekXP(p) / p.price) > weak.vapm && // Must be more efficient
            (squad.filter(s => playerDB.find(pdb => pdb.name === s.name)?.teamId === p.teamId).length < 3)
        );
        if (up) {
            tips.push(`🔥 UPGRADE: ${weak.name} ➔ ${up.name} (Higher Value)`);
        }
    });

    // Bench logic (Original IDs preserved)
    const gkpBench = analysis.filter(p => p.pos === 'GKP').sort((a,b) => a.threeWk - b.threeWk)[0];
    const bench = [gkpBench.name, ...sortedByEfficiency.filter(p => p.id !== gkpBench.id && p.isBench).map(p=>p.name)];

    displayModal(cap.name, bench, tips);
}

// --- UPDATED FIXTURE DATA HELPER ---
function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return { 
                opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), 
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty,
                isHome: isHome // Added for the new multiplier
            };
        });
}

// ... [Rest of your rendering and event listener code remains exactly the same] ...
