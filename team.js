/**
 * KOPALA FPL - MASTER ENGINE (v4.3.9)
 * Feature: Dynamic Formation Switching & Animated Subs
 */

// ... (Keep your API_BASE, playerDB, teamsDB, fixturesDB, and initial squad array as they are) ...

// --- CORE SUBSTITUTION ENGINE ---
async function startSubstitution(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
        renderPitch(); 
    } else {
        const id1 = selectedSlotId;
        const id2 = id;
        selectedSlotId = null;

        const s1 = squad.find(s => s.id === id1);
        const s2 = squad.find(s => s.id === id2);

        if (id1 === id2) { renderPitch(); return; }

        // 1. RULE: Goalkeepers can ONLY swap with Goalkeepers
        const involvesGK = s1.pos === 'GKP' || s2.pos === 'GKP';
        if (involvesGK && s1.pos !== s2.pos) {
            alert("Goalkeepers can only be swapped with other Goalkeepers.");
            renderPitch();
            return;
        }

        // 2. PRE-VALIDATION: Check if this swap breaks formation rules
        // We simulate the swap first
        const originalPos1 = s1.pos;
        const originalPos2 = s2.pos;
        const originalName1 = s1.name;
        const originalName2 = s2.name;

        // Execute "Official FPL" Style Swap: Swap Names AND Positions
        s1.name = originalName2;
        s1.pos = originalPos2;
        s2.name = originalName1;
        s2.pos = originalPos1;

        if (!validateFormation()) {
            alert("Invalid Formation! You must have at least 3 DEF, 2 MID, and 1 FWD on the pitch.");
            // Revert data
            s1.name = originalName1;
            s1.pos = originalPos1;
            s2.name = originalName2;
            s2.pos = originalPos2;
            renderPitch();
            return;
        }

        // 3. ANIMATION: If valid, show the slide effect
        const el1 = document.getElementById(`slot-${id1}`);
        const el2 = document.getElementById(`slot-${id2}`);
        if (el1 && el2) {
            const rect1 = el1.getBoundingClientRect();
            const rect2 = el2.getBoundingClientRect();

            el1.style.transform = `translate(${rect2.left - rect1.left}px, ${rect2.top - rect1.top}px)`;
            el2.style.transform = `translate(${rect1.left - rect2.left}px, ${rect1.top - rect2.top}px)`;
        }

        setTimeout(() => {
            saveSquad();
            renderPitch(); // This re-draws the pitch with the new formation
        }, 400);
    }
}

/**
 * Validates the starting 11 (Non-bench players)
 * Official FPL Minimums: 1 GKP, 3 DEF, 2 MID, 1 FWD
 */
function validateFormation() {
    const starters = squad.filter(s => !s.isBench);
    const counts = { 'GKP': 0, 'DEF': 0, 'MID': 0, 'FWD': 0 };
    
    starters.forEach(s => {
        counts[s.pos]++;
    });

    return (
        counts['GKP'] === 1 && 
        counts['DEF'] >= 3 && 
        counts['MID'] >= 2 && 
        counts['FWD'] >= 1
    );
}

// --- UPDATED RENDERER ---
// We must ensure the pitch re-orders itself based on the new positions
function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    
    calculateStats(); 
    pitch.innerHTML = ''; 
    bench.innerHTML = '';

    // Pitch: Dynamic Rows
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(posType => {
        const playersInPos = squad.filter(s => !s.isBench && s.pos === posType);
        if (playersInPos.length > 0) {
            const row = document.createElement('div');
            row.className = 'row';
            playersInPos.forEach(slot => {
                row.appendChild(createSlotUI(slot));
            });
            pitch.appendChild(row);
        }
    });

    // Bench: Fixed Order
    const bRow = document.createElement('div');
    bRow.className = 'row bench-row';
    // We sort bench by ID to keep the GKP first, then others
    squad.filter(s => s.isBench).sort((a,b) => a.id - b.id).forEach(slot => {
        bRow.appendChild(createSlotUI(slot));
    });
    bench.appendChild(bRow);
}

// ... (Keep the rest of your createSlotUI, updatePlayer, and syncData functions) ...
