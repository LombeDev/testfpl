/**
 * FPL AI Engine - Ultimate Emotional Edition
 * Features: Smart Transfers, Manager Personas, Story Engine, Rank Oracle, H2H Rivalries
 */

const API_BASE = "/fpl-api/";

// Configuration
const LEAGUES_LIST = [
    { name: "Kopala FPL", id: "101712" },
    { name: "Bayporteers", id: "147133" },
    { name: "Zedian Premier League", id: "1745660" },
    { name: "Zambia", id: "258" },
    { name: "Second Chance", id: "333" }
];

let playerMap = {};
let teamMap = {};
let managerSquads = {}; 
let globalManagers = []; // For cross-functional access

/**
 * 1. CORE FETCH & INITIALIZATION
 */
async function fetchProLeague(leagueId) {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.classList.remove("hidden");

    try {
        const [staticRes, leagueRes, fixRes] = await Promise.all([
            fetch(`${API_BASE}bootstrap-static/`),
            fetch(`${API_BASE}leagues-classic/${leagueId}/standings/`),
            fetch(`${API_BASE}fixtures/`)
        ]);

        const staticData = await staticRes.json();
        const leagueData = await leagueRes.json();
        const fixData = await fixRes.json();

        // Map Teams
        staticData.teams.forEach(t => {
            teamMap[t.id] = { short_name: t.short_name, strength: t.strength };
        });

        // Map Players with "Smart" Metrics (VAPM + FDR)
        staticData.elements.forEach(p => {
            const nextFix = fixData.find(f => !f.finished && (f.team_a === p.team || f.team_h === p.team));
            const isHome = nextFix?.team_h === p.team;
            const diff = nextFix ? (isHome ? nextFix.team_h_difficulty : nextFix.team_a_difficulty) : 3;

            playerMap[p.id] = { 
                name: p.web_name, 
                points: p.event_points, 
                team: p.team, 
                pos: p.element_type,
                price: p.now_cost / 10,
                form: parseFloat(p.form),
                vapm: (parseFloat(p.points_per_game) / (p.now_cost / 10)).toFixed(2),
                fdr_next: diff,
                next_fixture: nextFix
            };
        });

        globalManagers = leagueData.standings.results;
        const currentEvent = staticData.events.find(e => e.is_current || e.is_next).id;
        document.getElementById("active-gw-label").textContent = `GW ${currentEvent}`;

        renderTable(globalManagers);
        await loadLeagueIntelligence(globalManagers, currentEvent);

    } catch (err) { 
        console.error("AI Engine Error:", err); 
        if (loader) loader.classList.add("hidden");
    }
}

/**
 * 2. EMOTIONAL & INTELLIGENCE LOGIC
 */

// Smart Transfer Score: (Form * 0.5) + (VAPM * 1.5) + (FDR Inverse * 0.5)
function getSmartReplacements(elementId, maxPrice) {
    const current = playerMap[elementId];
    return Object.values(playerMap)
        .filter(p => p.pos === current.pos && p.price <= maxPrice && p.name !== current.name)
        .map(p => ({ ...p, smartScore: (p.form * 0.5) + (p.vapm * 1.5) + ((5 - p.fdr_next) * 0.5) }))
        .sort((a, b) => b.smartScore - a.smartScore)
        .slice(0, 3);
}

function getManagerPersona(m, picks, history) {
    const hits = history.event_transfer_cost;
    const benchPts = history.points_on_bench;
    if (hits > 8) return { label: "The Chaotic Gambler", icon: "🎲", color: "#ff2882" };
    if (benchPts > 12) return { label: "The Bench Sufferer", icon: "😭", color: "#ffa500" };
    if (m.rank_sort < m.last_rank) return { label: "The Rising Star", icon: "🚀", color: "#01ef80" };
    return { label: "The Tactical Master", icon: "🧠", color: "#3d195d" };
}

function calculateProjectedRank(manager) {
    const avgGw = globalManagers.reduce((s, m) => s + m.event_total, 0) / globalManagers.length;
    const momentum = manager.event_total / (avgGw || 1);
    if (momentum > 1.2) return { rank: Math.max(1, Math.floor(manager.rank * 0.8)), status: "CLIMBING 🚀" };
    if (momentum < 0.8) return { rank: Math.ceil(manager.rank * 1.2), status: "SINKING ⚓" };
    return { rank: manager.rank, status: "STABLE 🛡️" };
}

/**
 * 3. NARRATIVE & RIVALRY ENGINES
 */
function generateLeagueStory(managers, eventId) {
    const sorted = [...managers].sort((a, b) => b.event_total - a.event_total);
    const hero = sorted[0];
    const biggestHit = managers.reduce((prev, curr) => 
        (managerSquads[curr.entry]?.entry_history.event_transfer_cost > 
         managerSquads[prev.entry]?.entry_history.event_transfer_cost) ? curr : prev
    );

    return `
        <h3>GW${eventId} Narrative</h3>
        <p>🏆 <strong>${hero.player_name}</strong> is dominating the field with ${hero.event_total} pts!</p>
        <p>💸 <strong>${biggestHit.player_name}</strong> took a brave -${managerSquads[biggestHit.entry].entry_history.event_transfer_cost} hit today.</p>
    `;
}

function renderRivalryArena(managers) {
    const sorted = [...managers].sort((a, b) => a.rank - b.rank);
    const arena = document.getElementById("rivalry-arena");
    if (!arena) return;

    let html = `<h3 style="color:#01ef80; font-size:10px; margin-bottom:10px;">LIVE RIVALRY BATTLES</h3><div class="matchup-slider" style="display:flex; gap:10px; overflow-x:auto;">`;
    for (let i = 0; i < sorted.length; i += 2) {
        if (sorted[i+1]) {
            const m1 = sorted[i], m2 = sorted[i+1];
            html += `
                <div class="h2h-card" style="min-width:200px; background:#1a1a1a; padding:10px; border-radius:8px; border:1px solid #333;">
                    <div style="display:flex; justify-content:space-between; color:white; font-weight:bold;">
                        <span>${m1.player_name}</span> <span>${m1.event_total}</span>
                    </div>
                    <div style="text-align:center; color:#ff2882; font-size:10px; font-weight:900;">VS</div>
                    <div style="display:flex; justify-content:space-between; color:white; font-weight:bold;">
                        <span>${m2.player_name}</span> <span>${m2.event_total}</span>
                    </div>
                </div>`;
        }
    }
    arena.innerHTML = html + `</div>`;
}

/**
 * 4. UI RENDERING
 */
async function loadLeagueIntelligence(managers, eventId) {
    const ownership = {};
    const managerDetails = {};

    await Promise.all(managers.map(async (m) => {
        try {
            const [picksRes, transRes] = await Promise.all([
                fetch(`${API_BASE}entry/${m.entry}/event/${eventId}/picks/`),
                fetch(`${API_BASE}entry/${m.entry}/transfers/`)
            ]);
            const picks = await picksRes.json();
            const trans = await transRes.json();
            
            managerDetails[m.entry] = { picks, trans: trans.filter(t => t.event === eventId) };
            managerSquads[m.entry] = picks;
            picks.picks.forEach(p => ownership[p.element] = (ownership[p.element] || 0) + 1);
        } catch (e) { console.warn(e); }
    }));

    managers.forEach(m => {
        const data = managerDetails[m.entry];
        if (!data) return;

        const cap = data.picks.picks.find(p => p.is_captain);
        const capCell = document.getElementById(`cap-${m.entry}`);
        if(capCell) capCell.innerHTML = `${playerMap[cap.element].name} ${data.picks.active_chip ? `<span class="chip-badge">${data.picks.active_chip}</span>` : ''}`;

        const diffs = data.picks.picks.filter(p => ownership[p.element] === 1);
        document.getElementById(`diffs-${m.entry}`).innerHTML = diffs.map(p => `<span class="mini-tag tag-diff">${playerMap[p.element].name}</span>`).join('') || '—';
        
        const hits = data.picks.entry_history.event_transfer_cost;
        if(hits > 0) document.getElementById(`hits-${m.entry}`).innerText = `-${hits}`;
    });

    // Run Story & Rivalry Engines
    const storyBox = document.getElementById("league-story-container");
    if(storyBox) {
        storyBox.innerHTML = generateLeagueStory(managers, eventId);
        storyBox.classList.remove("hidden");
    }
    renderRivalryArena(managers);

    document.getElementById("loading-overlay").classList.add("hidden");
}

function renderTable(managers) {
    const body = document.getElementById("league-body");
    body.innerHTML = managers.map((m) => `
        <tr id="row-${m.entry}" onclick="handleManagerClick(${m.entry}, '${m.player_name}')">
            <td class="rank-col">${m.rank}</td>
            <td class="manager-col">
                <span class="m-name">${m.player_name}</span>
                <span class="t-name">${m.entry_name}</span>
            </td>
            <td class="pts-col">
                <div class="live-pts">${m.event_total}</div>
                <div id="hits-${m.entry}" style="color:#ff2882; font-size:9px;"></div>
            </td>
            <td class="total-col"><strong>${m.total}</strong></td>
            <td id="cap-${m.entry}" class="cap-col">—</td>
            <td class="diff-col"><div id="diffs-${m.entry}" class="diff-col-scroll"></div></td>
            <td class="trans-col"><div id="trans-${m.entry}"></div></td>
        </tr>
    `).join('');
}

function handleManagerClick(id, name) {
    const data = managerSquads[id];
    const managerObj = globalManagers.find(m => m.entry === id);
    if (!data || !managerObj) return;

    const modal = document.getElementById("team-modal");
    const list = document.getElementById("modal-squad-list");
    document.getElementById("modal-manager-name").innerText = name;

    const persona = getManagerPersona(managerObj, data.picks, data.entry_history);
    const oracle = calculateProjectedRank(managerObj);
    
    let transferAdvice = [];
    data.picks.forEach(p => {
        const player = playerMap[p.element];
        if (player.form < 2.5 || player.fdr_next >= 4) {
            const recs = getSmartReplacements(p.element, player.price + 0.5);
            if (recs.length > 0) {
                transferAdvice.push(`<div>Sell <b>${player.name}</b> ➔ Buy <b>${recs[0].name}</b> (Smart Score: ${recs[0].smartScore.toFixed(1)})</div>`);
            }
        }
    });

    list.innerHTML = `
        <div class="persona-badge" style="background:${persona.color}; color:white; padding:10px; border-radius:8px; text-align:center; margin-bottom:10px;">
            ${persona.icon} ${persona.label}
        </div>
        <div class="oracle-box" style="background:#000; padding:10px; border-radius:8px; border:1px solid #01ef80; margin-bottom:15px;">
            <div style="color:#01ef80; font-size:10px;">RANK ORACLE</div>
            <div style="color:white; font-weight:900;">Projected Finish: #${oracle.rank} (${oracle.status})</div>
        </div>
        <div class="advice-section" style="background:#222; padding:10px; border-radius:8px; font-size:11px; color:#ccc;">
            <h4 style="color:#01ef80; margin-top:0;">AI Insights</h4>
            ${transferAdvice.slice(0, 2).join('') || "Squad is optimized."}
        </div>
        <p style="text-align:center; font-size:10px; color:#666; margin-top:10px;">Click outside to close</p>
    `;

    modal.classList.remove("hidden");
    document.body.style.overflow = 'hidden'; 
}

// Global UI helpers
function renderLeagueSelector() {
    const body = document.getElementById("league-body");
    body.innerHTML = LEAGUES_LIST.map(league => `
        <tr>
            <td colspan="7" style="padding: 20px; background: #1a1a1a; border-radius:10px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-weight:bold; color:white;">${league.name}</span>
                    <button onclick="fetchProLeague('${league.id}')" style="background:#01ef80; border:none; padding:5px 15px; border-radius:4px; font-weight:bold; cursor:pointer;">ENTER</button>
                </div>
            </td>
        </tr>
    `).join('');
}

document.getElementById("close-modal").onclick = () => {
    document.getElementById("team-modal").classList.add("hidden");
    document.body.style.overflow = ''; 
};

document.addEventListener("DOMContentLoaded", renderLeagueSelector);