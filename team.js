/**
 * KOPALA FPL - AI MASTER ENGINE (v3.6.1)
 * The team.js file with small runtime DOM bootstrapping:
 * - Automatically creates a player inspect modal if missing
 * - Optionally injects picker filter controls if not present (non-destructive)
 * - Ensures formation select has id="formation-select" so script bindings work
 *
 * Drop-in replacement for the existing team.js. It will not overwrite your HTML,
 * only create missing elements it depends on so you don't have to edit markup.
 */

const API_BASE = "/fpl-api/"; 
let playerDB = [];
let teamsDB = {}; 
let fixturesDB = [];
let selectedSlotId = null;

// Player picker filter state (controlled by UI elements if present)
const pickerFilters = {
    maxPrice: 15.0,
    minPrice: 4.0,
    minOwnership: 0.0,
    sortBy: 'xp' // 'xp' | 'price' | 'ownership' | 'vapm'
};

// Initial 15-man squad structure
let squad = [
    { id: 0, pos: 'GKP', name: '', isBench: false },
    { id: 1, pos: 'DEF', name: '', isBench: false },
    { id: 2, pos: 'DEF', name: '', isBench: false },
    { id: 3, pos: 'DEF', name: '', isBench: false },
    { id: 4, pos: 'DEF', name: '', isBench: false },
    { id: 5, pos: 'MID', name: '', isBench: false },
    { id: 6, pos: 'MID', name: '', isBench: false },
    { id: 7, pos: 'MID', name: '', isBench: false },
    { id: 8, pos: 'MID', name: '', isBench: false },
    { id: 9, pos: 'FWD', name: '', isBench: false },
    { id: 10, pos: 'FWD', name: '', isBench: false },
    { id: 11, pos: 'GKP', name: '', isBench: true },
    { id: 12, pos: 'DEF', name: '', isBench: true },
    { id: 13, pos: 'MID', name: '', isBench: true },
    { id: 14, pos: 'FWD', name: '', isBench: true }
];

// --- UI BOOTSTRAP HELPERS ---
// Create minimal required UI elements at runtime if they're missing on the page.
// This keeps integration friction low: you don't need to edit your HTML to get player modal or picker controls.

function ensureUIElements() {
    ensurePlayerModal();
    ensurePickerControls();
    ensureFormationSelectId();
    // Ensure analysis modal results container exists
    const analysisResults = document.getElementById('analysis-results');
    if (!analysisResults) {
        // If #analysis-modal exists but missing #analysis-results, create it inside
        const analysisModal = document.getElementById('analysis-modal');
        if (analysisModal) {
            const container = document.createElement('div');
            container.id = 'analysis-results';
            analysisModal.querySelector('.modal-content')?.appendChild(container);
        }
    }
}

function ensurePlayerModal() {
    if (document.getElementById('player-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'player-modal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="padding:16px; max-width:640px; margin:48px auto; position:relative;">
            <button id="close-player-modal" style="position:absolute; right:12px; top:12px; background:none; border:none; font-size:1.4rem; cursor:pointer;">&times;</button>
            <div id="player-modal-content"></div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-player-modal').onclick = () => {
        const m = document.getElementById('player-modal');
        if (m) m.style.display = 'none';
    };

    // click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function ensurePickerControls() {
    // If any picker control exists, we assume the set is present; otherwise inject a small non-invasive control set
    const anyPickerPresent = document.getElementById('picker-min-price') || document.getElementById('picker-max-price') || document.getElementById('picker-sort');
    if (anyPickerPresent) return;

    // Try to append near the formation select or into .status-bar
    const statusBar = document.querySelector('.status-bar') || document.querySelector('.main-container') || document.body;
    if (!statusBar) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'center';
    wrapper.style.marginLeft = '12px';

    wrapper.innerHTML = `
        <label style="font-weight:700; font-size:0.85rem; margin-right:4px;">Min Price</label>
        <input id="picker-min-price" type="number" step="0.1" value="${pickerFilters.minPrice}" style="width:72px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Max Price</label>
        <input id="picker-max-price" type="number" step="0.1" value="${pickerFilters.maxPrice}" style="width:72px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Min Own</label>
        <input id="picker-min-ownership" type="number" step="0.1" value="${pickerFilters.minOwnership}" style="width:62px;" />
        <label style="font-weight:700; font-size:0.85rem; margin-left:6px; margin-right:4px;">Sort</label>
        <select id="picker-sort" style="width:100px;">
            <option value="xp">xP</option>
            <option value="vapm">VAPM</option>
            <option value="price">Price</option>
            <option value="ownership">Ownership</option>
        </select>
    `;

    // Append near the formation select if available, otherwise into statusBar
    const formation = document.getElementById('formation-select') || document.querySelector('select[onchange*="changeFormation"]');
    if (formation && formation.parentElement) {
        formation.parentElement.insertBefore(wrapper, formation.nextSibling);
    } else {
        statusBar.appendChild(wrapper);
    }
}

function ensureFormationSelectId() {
    let formSelect = document.getElementById('formation-select');
    if (!formSelect) {
        // try to find any select that calls changeFormation inline and give it id for binding
        formSelect = document.querySelector('select[onchange*="changeFormation"]');
        if (formSelect) formSelect.id = 'formation-select';
    }
}

// --- 1. DATA SYNC & INITIALIZATION ---

async function syncData() {
    const ticker = document.getElementById('ticker');
    const TIME_KEY = 'kopala_cache_timestamp';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; 

    const cachedPlayers = localStorage.getItem('kopala_player_cache');
    const cachedFixtures = localStorage.getItem('kopala_fixtures_cache');
    const cachedTeams = localStorage.getItem('kopala_teams_cache');
    const cachedTime = localStorage.getItem(TIME_KEY);
    
    const isCacheFresh = cachedTime && (Date.now() - cachedTime < TWENTY_FOUR_HOURS);

    if (cachedPlayers && cachedFixtures) {
        playerDB = JSON.parse(cachedPlayers);
        fixturesDB = JSON.parse(cachedFixtures);
        teamsDB = JSON.parse(cachedTeams || '{}');
        loadSquad();
        renderPitch();
        if (isCacheFresh && ticker) {
            ticker.innerHTML = "🚨 <span style='color:#00ff87'>AI Analysis Ready: Target Differentials</span>";
            return; 
        }
    }

    try {
        if (ticker) ticker.textContent = "Syncing live Premier League data...";
        const [bootRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}fixtures/`)
        ]);
        const data = await bootRes.json();
        const rawFixtures = await fixRes.json();

        // Map Team IDs to Slugs
        data.teams.forEach(t => {
            let slug = t.name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            teamsDB[t.id] = slug;
        });

        // Enhanced Player Mapping including Ownership (selected_by_percent)
        playerDB = data.elements.map(p => ({
            id: p.id,
            name: p.web_name,
            teamId: p.team,
            teamShort: teamsDB[p.team] || 'default',
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type],
            price: (p.now_cost / 10).toFixed(1),
            xp: parseFloat(p.ep_next) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0
        })).sort((a,b) => b.xp - a.xp);

        fixturesDB = rawFixtures;

        localStorage.setItem('kopala_player_cache', JSON.stringify(playerDB));
        localStorage.setItem('kopala_fixtures_cache', JSON.stringify(fixturesDB));
        localStorage.setItem('kopala_teams_cache', JSON.stringify(teamsDB));
        localStorage.setItem(TIME_KEY, Date.now().toString());
        
        loadSquad();
        renderPitch();
        if (ticker) ticker.innerHTML = "✨ <span style='color:#00ff87'>AI Engine: Differential Engine Active</span>";
    } catch (e) {
        console.error("Sync Error:", e);
        if (ticker) ticker.textContent = "Offline Mode Active";
    }
}

// --- 2. SQUAD RULES & INTERACTION ---

function handleSwap(id) {
    if (selectedSlotId === null) {
        selectedSlotId = id;
    } else {
        const p1 = squad.find(s => s.id === selectedSlotId);
        const p2 = squad.find(s => s.id === id);

        if (p1.id !== p2.id) {
            if ((p1.pos === 'GKP' || p2.pos === 'GKP') && p1.pos !== p2.pos) {
                alert("Goalkeepers can only be swapped with other Goalkeepers.");
            } else {
                const tempBench = p1.isBench;
                p1.isBench = p2.isBench;
                p2.isBench = tempBench;

                if (!isValidFormation()) {
                    alert("Invalid Formation! FPL requires 3-5 DEF, 2-5 MID, 1-3 FWD.");
                    // revert
                    p2.isBench = p1.isBench; 
                    p1.isBench = tempBench; 
                } else {
                    saveSquad();
                }
            }
        }
        selectedSlotId = null;
    }
    renderPitch();
}

function updatePlayer(id, name) {
    if (!name) {
        squad.find(s => s.id === id).name = "";
        saveSquad(); renderPitch(); return;
    }

    const player = playerDB.find(p => p.name === name);
    if (!player) { alert("Player not found"); return; }

    const teamCount = squad.filter(s => {
        if (s.id === id) return false;
        const p = playerDB.find(pdb => pdb.name === s.name);
        return p && p.teamId === player.teamId;
    }).length;

    if (teamCount >= 3) {
        alert(`Rule Violation: Max 3 players from ${player.teamShort.toUpperCase()}.`);
        renderPitch(); 
        return;
    }

    squad.find(s => s.id === id).name = name;
    saveSquad();
    renderPitch();
}

function changeFormation(formationStr) {
    const [d, m, f] = formationStr.split('-').map(Number);
    squad.forEach(s => s.isBench = true);
    // keep first goalkeeper as starter
    const gkStarters = squad.filter(s => s.pos === 'GKP').slice(0,1);
    gkStarters.forEach(g => g.isBench = false);

    const activate = (pos, limit) => {
        let count = 0;
        squad.filter(s => s.pos === pos).forEach(s => {
            if (count < limit) { s.isBench = false; count++; }
        });
    };

    activate('DEF', d); activate('MID', m); activate('FWD', f);
    saveSquad();
    renderPitch();
}

function isValidFormation() {
    const active = squad.filter(s => !s.isBench);
    const d = active.filter(s => s.pos === 'DEF').length;
    const m = active.filter(s => s.pos === 'MID').length;
    const f = active.filter(s => s.pos === 'FWD').length;
    return d >= 3 && d <= 5 && m >= 2 && m <= 5 && f >= 1 && f <= 3;
}

// --- 3. ADVANCED AI CALCULATIONS ---

function getThreeWeekXP(player) {
    if (!player) return 0;
    const fixtures = getNextFixtures(player.teamId);
    let totalXP = player.xp; 
    
    fixtures.slice(0, 3).forEach((f, index) => {
        // Multiplier: easier fixtures get lower diff value -> higher multiplier
        let multiplier = (6 - f.diff) / 3;
        if (f.isHome) multiplier *= 1.1; // Home bias
        
        // Decay logic: Future weeks are weighted slightly less
        const decay = [1.0, 0.9, 0.8][index] || 0.7;
        totalXP += (player.xp * multiplier * decay);
    });
    
    return parseFloat(totalXP.toFixed(1));
}

function vapor(player) {
    // shorthand VAPM: value added per million (approx)
    const price = parseFloat(player.price);
    if (!price) return 0;
    return getThreeWeekXP(player) / price;
}

function simulateSingleTransfer(outName, inName) {
    // returns an object with delta XP, delta price, and validity
    const outSlot = squad.find(s => s.name === outName);
    if (!outSlot) return null;
    const inPlayer = playerDB.find(p => p.name === inName);
    if (!inPlayer) return null;

    // Basic team count check
    const teamCount = squad.filter(s => s.name !== outName).map(s => {
        const p = playerDB.find(pp => pp.name === s.name);
        return p ? p.teamId : null;
    }).filter(Boolean).reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1; return acc;
    }, {});
    teamCount[inPlayer.teamId] = (teamCount[inPlayer.teamId] || 0) + 1;
    if (teamCount[inPlayer.teamId] > 3) {
        return { valid: false, reason: 'Max 3 players per club would be exceeded' };
    }

    // budget check
    const currentVal = squad.reduce((acc, s) => {
        const p = playerDB.find(pp => pp.name === s.name);
        return acc + (p ? parseFloat(p.price) : 0);
    }, 0);
    const budgetLeft = 100 - currentVal;
    const outPrice = parseFloat(playerDB.find(p => p.name === outName)?.price || 0);
    const inPrice = parseFloat(inPlayer.price);
    const newBudgetLeft = (100 - (currentVal - outPrice + inPrice));

    const outXP = playerDB.find(p => p.name === outName) ? getThreeWeekXP(playerDB.find(p => p.name === outName)) : 0;
    const inXP = getThreeWeekXP(inPlayer);
    return {
        valid: true,
        deltaXP: parseFloat((inXP - outXP).toFixed(1)),
        deltaPrice: parseFloat((inPrice - outPrice).toFixed(1)),
        newITB: parseFloat(newBudgetLeft.toFixed(1))
    };
}

// --- 4. ANALYSIS & SUGGESTIONS ---

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
            ownership: p.ownership,
            vapm: parseFloat((threeWk / price).toFixed(2))
        };
    });

    const cap = [...analysis].sort((a, b) => b.threeWk - a.threeWk)[0];
    const budget = (100 - analysis.reduce((acc, p) => acc + p.price, 0));
    const tips = [];

    // 1. DIFFERENTIAL SWORD LOGIC (improved)
    const templatePlayer = analysis.filter(p => p.ownership > 20).sort((a,b) => a.threeWk - b.threeWk)[0];
    if (templatePlayer) {
        const gem = playerDB.find(p => 
            p.pos === templatePlayer.pos && 
            p.ownership < 10 && 
            getThreeWeekXP(p) > templatePlayer.threeWk &&
            parseFloat(p.price) <= (templatePlayer.price + Math.max(0, budget))
        );
        if (gem) tips.push(`🗡️ DIFFERENTIAL SWORD: ${templatePlayer.name} ➔ ${gem.name} (${gem.ownership}% owned)`);
    }

    // 2. STANDARD AI UPGRADES
    const sortedLow = [...analysis].sort((a, b) => a.threeWk - b.threeWk);
    sortedLow.slice(0, 2).forEach(weak => {
        const up = playerDB.find(p => 
            p.pos === weak.pos && !squad.some(s => s.name === p.name) &&
            parseFloat(p.price) <= (weak.price + Math.max(0, budget)) &&
            getThreeWeekXP(p) > (weak.threeWk + 1.5)
        );
        if (up) tips.push(`🔄 AI UPGRADE: ${weak.name} ➔ ${up.name}`);
    });

    // Bench Logic
    const gkpBench = analysis.filter(p => p.pos === 'GKP').sort((a,b) => a.threeWk - b.threeWk)[0];
    const bench = [gkpBench ? gkpBench.name : '', ...sortedLow.filter(p => p.id !== (gkpBench ? gkpBench.id : -1) && p.isBench).slice(0, 3).map(p=>p.name)];

    // Captain confidence (very simple combination)
    const captainCandidates = [...analysis].sort((a,b) => b.threeWk - a.threeWk).slice(0,3);
    const captain = captainCandidates[0].name;
    const capConfidence = Math.round((captainCandidates[0].threeWk / (captainCandidates[1] ? captainCandidates[1].threeWk : 1)) * 100);

    // Transfer simulation for tips: show delta for each suggested transfer
    const transferSimulations = tips.map(t => {
        // if string contains "➔", try to parse out names
        const match = t.match(/:\s*([^ ]+)\s+➔\s+([^ ]+)/);
        if (match) {
            const outName = match[1];
            const inName = match[2];
            const sim = simulateSingleTransfer(outName, inName);
            return { text: t, sim };
        }
        return { text: t, sim: null };
    });

    // Show modal with richer output
    displayModal(captain, capConfidence, bench, transferSimulations, analysis, tips);
}

function displayModal(cap, capConfidence, bench, transfers, analysis, transfersText) {
    const modal = document.getElementById('analysis-modal');
    const content = document.getElementById('analysis-results');
    if(!modal || !content) return;

    content.innerHTML = `
        <div class="analysis-section"><h3>👑 Captain Suggestion</h3><p>${cap} — Confidence: ${capConfidence}%</p></div>
        <div class="analysis-section"><h3>🪑 Bench Priority</h3><p>${bench.filter(b => b).join(', ')}</p></div>
        <div class="analysis-section"><h3>🚀 AI Smart Transfers</h3>
            ${transfers && transfers.length ? transfers.map(t => {
                if (t.sim) {
                    return `<div class="transfer-item">${t.text} — ΔxP: ${t.sim.deltaXP} — Δ£: ${t.sim.deltaPrice} — ITB: £${t.sim.newITB}m</div>`;
                } else {
                    return `<div class="transfer-item">${t.text}</div>`;
                }
            }).join('') : '<p>Your team is currently AI-Optimal.</p>'}
        </div>
        <div class="analysis-section"><h3>📊 Squad Summary</h3>
            <p>Estimated ITB: £${(100 - (analysis.reduce((acc,p)=>acc+p.price,0))).toFixed(1)}m (approx)</p>
        </div>
        <div style="text-align:right"><button id="close-modal-dyn" class="btn">Close</button></div>
    `;
    modal.style.display = "block";

    // Hook close button inside results (some HTML has its own close button)
    const closeBtn = document.getElementById('close-modal') || document.getElementById('close-modal-dyn');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
}

// Quick player modal to inspect a player
function openPlayerModal(name) {
    const player = playerDB.find(p => p.name === name);
    if (!player) return;
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    if (!modal || !content) return;

    const nextFix = getNextFixtures(player.teamId);
    content.innerHTML = `
        <h3 style="margin:0 0 8px 0;">${player.name} — £${player.price}m</h3>
        <p style="margin:4px 0;">Position: ${player.pos} — Ownership: ${player.ownership}%</p>
        <p style="margin:4px 0;">Projected 3wk xP: ${getThreeWeekXP(player)}</p>
        <div class="card-fixtures" style="display:flex;gap:6px;margin-top:8px;">${nextFix.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}${f.isHome ? '(H)' : '(A)'}</div>`).join('')}</div>
    `;
    modal.style.display = "block";
}

// --- 5. WILDCARD & RENDERERS ---

function runAIWildcard() {
    let budget = 100.0;
    const newSquad = [];
    const teamCounts = {};
    const posLimits = { 'GKP': 2, 'DEF': 5, 'MID': 5, 'FWD': 3 };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        for (let i = 0; i < posLimits[pos]; i++) {
            const buffer = 4.2 * (15 - newSquad.length);
            // Select players with high VAPM (efficiency) for Wildcard
            const choice = playerDB.filter(p => 
                p.pos === pos && !newSquad.some(s => s.name === p.name) && 
                (teamCounts[p.teamId] || 0) < 3 && parseFloat(p.price) <= (budget - buffer)
            ).sort((a, b) => (getThreeWeekXP(b)/parseFloat(b.price)) - (getThreeWeekXP(a)/parseFloat(a.price)))[0];

            if (choice) {
                newSquad.push({ id: newSquad.length, pos: pos, name: choice.name, isBench: false });
                teamCounts[choice.teamId] = (teamCounts[choice.teamId] || 0) + 1;
                budget -= parseFloat(choice.price);
            }
        }
    });
    squad = newSquad; 
    changeFormation('4-4-2');
}

function renderPitch() {
    const pitch = document.getElementById('pitch-container');
    const bench = document.getElementById('bench-container');
    if(!pitch || !bench) return;
    pitch.innerHTML = ''; bench.innerHTML = '';

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        const row = document.createElement('div');
        row.className = 'row';
        squad.filter(s => !s.isBench && s.pos === pos).forEach(p => row.appendChild(createSlotUI(p)));
        pitch.appendChild(row);
    });

    const bRow = document.createElement('div');
    bRow.className = 'row';
    squad.filter(s => s.isBench).forEach(p => bRow.appendChild(createSlotUI(p)));
    bench.appendChild(bRow);
    updateStats();
}

function buildPlayerOptions(pos, selectedName) {
    // Build options respecting pickerFilters and allow clicking to open modal via onchange
    let candidates = playerDB.filter(p => p.pos === pos
        && parseFloat(p.price) >= pickerFilters.minPrice
        && parseFloat(p.price) <= pickerFilters.maxPrice
        && p.ownership >= pickerFilters.minOwnership
    );
    // annotate vapm
    candidates = candidates.map(c => ({ ...c, vapm: vapor(c) }));

    switch (pickerFilters.sortBy) {
        case 'price':
            candidates.sort((a,b)=> parseFloat(a.price) - parseFloat(b.price)); break;
        case 'ownership':
            candidates.sort((a,b)=> b.ownership - a.ownership); break;
        case 'vapm':
            candidates.sort((a,b)=> b.vapm - a.vapm); break;
        case 'xp':
        default:
            candidates.sort((a,b)=> getThreeWeekXP(b) - getThreeWeekXP(a)); break;
    }

    return [
        `<option value="">-- Pick --</option>`,
        ...candidates.map(c => `<option value="${c.name}" ${selectedName === c.name ? 'selected' : ''}>${c.name} (£${c.price}m) — ${getThreeWeekXP(c)} xP — ${c.ownership}%</option>` )
    ].join('');
}

function createSlotUI(slotData) {
    const div = document.createElement('div');
    div.className = `slot ${selectedSlotId === slotData.id ? 'selected' : ''}`;
    const p = playerDB.find(p => p.name === slotData.name);
    const jersey = p ? (p.pos === 'GKP' ? 'gkp_color' : p.teamShort) : 'default';
    const fixtures = p ? getNextFixtures(p.teamId) : [];
    const xP3 = p ? getThreeWeekXP(p) : 0;

    // create select element programmatically (so innerHTML strings are simpler to manage)
    const jerseyDiv = document.createElement('div');
    jerseyDiv.className = `jersey ${jersey}`;
    jerseyDiv.onclick = () => handleSwap(slotData.id);

    const cardDiv = document.createElement('div');
    cardDiv.className = 'player-card';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'p-name';
    nameSpan.textContent = slotData.name || slotData.pos;
    if (slotData.name) nameSpan.style.cursor = 'pointer';
    nameSpan.onclick = () => slotData.name && openPlayerModal(slotData.name);

    const xpSpan = document.createElement('span');
    xpSpan.className = 'p-xp';
    xpSpan.textContent = p ? `3-Wk xP: ${xP3}` : '';

    const fixtureDiv = document.createElement('div');
    fixtureDiv.className = 'card-fixtures';
    fixtureDiv.innerHTML = fixtures.map(f => `<div class="fix-item diff-${f.diff}">${f.opp}${f.isHome ? '(H)' : '(A)'}</div>`).join('');

    cardDiv.appendChild(nameSpan);
    cardDiv.appendChild(xpSpan);
    cardDiv.appendChild(fixtureDiv);

    const selectEl = document.createElement('select');
    selectEl.className = 'hidden-picker';
    selectEl.onchange = (e) => updatePlayer(slotData.id, e.target.value);
    // add options (buildPlayerOptions uses pickerFilters)
    selectEl.innerHTML = buildPlayerOptions(slotData.pos, slotData.name);

    div.appendChild(jerseyDiv);
    div.appendChild(cardDiv);
    div.appendChild(selectEl);

    return div;
}

function getNextFixtures(teamId) {
    if (!fixturesDB.length) return [];
    return fixturesDB.filter(f => !f.finished && (f.team_h === teamId || f.team_a === teamId))
        .slice(0, 3).map(f => {
            const isHome = f.team_h === teamId;
            return { 
                opp: (teamsDB[isHome ? f.team_a : f.team_h] || "???").substring(0,3).toUpperCase(), 
                diff: isHome ? f.team_h_difficulty : f.team_a_difficulty,
                isHome: isHome
            };
        });
}

function updateStats() {
    let currentXp = 0, threeWeekXp = 0, val = 0;
    
    squad.forEach(s => {
        const p = playerDB.find(x => x.name === s.name);
        if (p) {
            val += parseFloat(p.price);
            if (!s.isBench) {
                currentXp += p.xp;
                threeWeekXp += getThreeWeekXP(p);
            }
        }
    });

    const itb = (100 - val).toFixed(1);
    const rating = Math.min(100, (threeWeekXp / 185) * 100).toFixed(0);
    
    const budgetEl = document.getElementById('budget-val');
    if(budgetEl) { budgetEl.textContent = `£${itb}m`; budgetEl.style.color = itb < 0 ? '#ff005a' : '#00ff87'; }
    if(document.getElementById('v-xp')) document.getElementById('v-xp').textContent = currentXp.toFixed(1);
    if(document.getElementById('three-week-xp')) document.getElementById('three-week-xp').textContent = threeWeekXp.toFixed(1);
    if(document.getElementById('team-rating')) {
        document.getElementById('team-rating').textContent = `${rating}%`;
        document.getElementById('team-rating').style.color = rating > 75 ? '#00ff87' : (rating > 50 ? '#e1ff00' : '#ff005a');
    }
}

function saveSquad() { localStorage.setItem('kopala_saved_squad', JSON.stringify(squad)); }
function loadSquad() {
    const saved = localStorage.getItem('kopala_saved_squad');
    if (saved) squad = JSON.parse(saved);
}

// --- 6. EVENT LISTENERS & BINDINGS ---

document.addEventListener('DOMContentLoaded', () => {
    // Create any missing UI pieces the script needs so you don't have to edit HTML (option B)
    ensureUIElements();

    // Initialize picker filter elements (they may have been created programmatically above)
    const maxPriceEl = document.getElementById('picker-max-price');
    const minPriceEl = document.getElementById('picker-min-price');
    const minOwnershipEl = document.getElementById('picker-min-ownership');
    const sortSelectEl = document.getElementById('picker-sort');

    const refreshPickers = () => {
        // update pickerFilters from DOM (if present)
        if (maxPriceEl) pickerFilters.maxPrice = parseFloat(maxPriceEl.value || pickerFilters.maxPrice);
        if (minPriceEl) pickerFilters.minPrice = parseFloat(minPriceEl.value || pickerFilters.minPrice);
        if (minOwnershipEl) pickerFilters.minOwnership = parseFloat(minOwnershipEl.value || pickerFilters.minOwnership);
        if (sortSelectEl) pickerFilters.sortBy = sortSelectEl.value || pickerFilters.sortBy;
        renderPitch();
    };

    if (maxPriceEl) { maxPriceEl.value = pickerFilters.maxPrice; maxPriceEl.onchange = refreshPickers; }
    if (minPriceEl) { minPriceEl.value = pickerFilters.minPrice; minPriceEl.onchange = refreshPickers; }
    if (minOwnershipEl) { minOwnershipEl.value = pickerFilters.minOwnership; minOwnershipEl.onchange = refreshPickers; }
    if (sortSelectEl) { sortSelectEl.value = pickerFilters.sortBy; sortSelectEl.onchange = refreshPickers; }

    // Bind buttons & formation select
    if (document.getElementById('wildcard-btn')) document.getElementById('wildcard-btn').onclick = runAIWildcard;
    if (document.getElementById('analyze-btn')) document.getElementById('analyze-btn').onclick = analyzeTeam;
    if (document.getElementById('formation-select')) document.getElementById('formation-select').onchange = (e) => changeFormation(e.target.value);

    // Ensure analysis modal close button (if exists) closes properly
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.onclick = () => {
        const m = document.getElementById('analysis-modal');
        if (m) m.style.display = 'none';
    };

    // Finally sync data and render
    syncData();
});
